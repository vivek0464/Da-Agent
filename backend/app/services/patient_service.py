import re
import asyncio
import logging
from datetime import datetime, timezone
from app.firebase_admin import get_db
from app.models.patient import PatientCreate, PatientUpdate

logger = logging.getLogger(__name__)


def _patient_id(name: str, phone: str) -> str:
    """Deterministic patient ID: {first_name_lower}_{digits_only_phone}."""
    first = re.sub(r"[^a-z]", "", name.strip().split()[0].lower())
    digits = re.sub(r"\D", "", phone)
    return f"{first}_{digits}"


async def create_patient(data: PatientCreate, doctor_id: str | None = None, date: str | None = None) -> dict:
    db = get_db()
    clinic_id = data.clinicId
    now = datetime.now(timezone.utc).isoformat()
    today = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    patient_id = _patient_id(data.name, data.phone)
    ref = (
        db.collection("clinics")
        .document(clinic_id)
        .collection("patients")
        .document(patient_id)
    )

    # Upsert: if patient already exists, increment visits; otherwise create fresh
    existing_doc = await asyncio.to_thread(ref.get)
    if existing_doc.exists:
        from firebase_admin import firestore as _fs
        await asyncio.to_thread(ref.update, {
            "visits": _fs.Increment(1),
            "name": data.name,
            "phone": data.phone,
            **({"age": data.age} if data.age is not None else {}),
            **({"gender": data.gender} if data.gender else {}),
        })
        doc = (await asyncio.to_thread(ref.get)).to_dict()
    else:
        doc = {
            **data.model_dump(),
            "id": patient_id,
            "visits": 1,
            "createdAt": now,
        }
        await asyncio.to_thread(ref.set, doc)

    if doctor_id:
        try:
            from app.services.appointment_service import list_appointments
            # Queue position scoped per doctor for today
            existing = await list_appointments(clinic_id, date=today, doctor_id=doctor_id)
            active = [a for a in existing if a.get("status") not in ("cancelled", "completed")]
            queue_pos = len(active) + 1

            appt_ref = (
                db.collection("clinics")
                .document(clinic_id)
                .collection("appointments")
                .document()
            )
            appt_doc = {
                "id": appt_ref.id,
                "clinicId": clinic_id,
                "patientId": patient_id,
                "patientName": data.name,
                "patientPhone": data.phone,
                "patientEmail": data.email or "",
                "doctorId": doctor_id,
                "date": today,
                "timeSlot": "walk-in",
                "status": "scheduled",
                "queuePosition": queue_pos,
                "estimatedTime": f"~{queue_pos * 15} min wait",
                "createdAt": now,
            }
            await asyncio.to_thread(appt_ref.set, appt_doc)

            patient_info = {
                "name": data.name,
                "phone": data.phone,
                "gender": data.gender or "",
                "age": str(data.age) if data.age is not None else "",
            }
            rx_ref = (
                db.collection("clinics")
                .document(clinic_id)
                .collection("prescriptions")
                .document()
            )
            rx_doc = {
                "id": rx_ref.id,
                "clinicId": clinic_id,
                "patientId": patient_id,
                "doctorId": doctor_id,
                "appointmentId": appt_doc["id"],
                "date": today,
                "status": "draft",
                "content": {
                    "patientInfo": patient_info,
                    "complaints": [],
                    "diagnosis": [],
                    "medications": [],
                    "tests": [],
                    "followUp": "",
                    "notes": "",
                },
                "createdAt": now,
                "updatedAt": now,
            }
            await asyncio.to_thread(rx_ref.set, rx_doc)
            doc["appointmentId"] = appt_doc["id"]
            doc["prescriptionId"] = rx_ref.id
            doc["queuePosition"] = queue_pos
        except Exception as exc:
            logger.warning(f"Auto-queue/prescription failed for patient {patient_id}: {exc}")

    return doc


async def get_patient(clinic_id: str, patient_id: str) -> dict | None:
    db = get_db()
    doc = await asyncio.to_thread(
        db.collection("clinics")
        .document(clinic_id)
        .collection("patients")
        .document(patient_id)
        .get
    )
    return doc.to_dict() if doc.exists else None


async def list_patients(clinic_id: str, search: str | None = None) -> list:
    db = get_db()
    query = db.collection("clinics").document(clinic_id).collection("patients")
    docs = await asyncio.to_thread(lambda: list(query.stream()))
    patients = [d.to_dict() for d in docs]
    if search:
        q = search.lower()
        patients = [
            p
            for p in patients
            if q in (p.get("name") or "").lower() or q in (p.get("phone") or "").lower()
        ]
    return patients


async def update_patient(
    clinic_id: str, patient_id: str, data: PatientUpdate
) -> dict | None:
    db = get_db()
    ref = (
        db.collection("clinics")
        .document(clinic_id)
        .collection("patients")
        .document(patient_id)
    )
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    await asyncio.to_thread(ref.update, updates)
    doc = await asyncio.to_thread(ref.get)
    return doc.to_dict() if doc.exists else None


async def increment_visits(clinic_id: str, patient_id: str) -> None:
    from firebase_admin import firestore

    db = get_db()
    ref = (
        db.collection("clinics")
        .document(clinic_id)
        .collection("patients")
        .document(patient_id)
    )
    await asyncio.to_thread(ref.update, {"visits": firestore.Increment(1)})
