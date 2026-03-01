import asyncio
from datetime import datetime, timezone
from app.firebase_admin import get_db
from app.models.prescription import PrescriptionCreate, PrescriptionUpdate


async def create_prescription(data: PrescriptionCreate) -> dict:
    db = get_db()
    ref = (
        db.collection("clinics")
        .document(data.clinicId)
        .collection("prescriptions")
        .document()
    )
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        **data.model_dump(),
        "id": ref.id,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "createdAt": now,
        "updatedAt": now,
    }
    doc["content"] = data.content.model_dump()
    await asyncio.to_thread(ref.set, doc)
    return doc


async def get_prescription(clinic_id: str, prescription_id: str) -> dict | None:
    db = get_db()
    doc = await asyncio.to_thread(
        db.collection("clinics")
        .document(clinic_id)
        .collection("prescriptions")
        .document(prescription_id)
        .get
    )
    return doc.to_dict() if doc.exists else None


async def list_prescriptions(
    clinic_id: str,
    patient_id: str | None = None,
    doctor_id: str | None = None,
) -> list:
    db = get_db()
    query = db.collection("clinics").document(clinic_id).collection("prescriptions")
    if patient_id:
        query = query.where("patientId", "==", patient_id)
    if doctor_id:
        query = query.where("doctorId", "==", doctor_id)
    docs = await asyncio.to_thread(lambda: list(query.stream()))
    return [d.to_dict() for d in docs]


async def update_prescription(
    clinic_id: str, prescription_id: str, data: PrescriptionUpdate
) -> dict | None:
    db = get_db()
    ref = (
        db.collection("clinics")
        .document(clinic_id)
        .collection("prescriptions")
        .document(prescription_id)
    )
    updates: dict = {}
    if data.content is not None:
        updates["content"] = data.content.model_dump()
    if data.status is not None:
        updates["status"] = data.status
    updates["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await asyncio.to_thread(ref.update, updates)
    doc = await asyncio.to_thread(ref.get)
    result = doc.to_dict() if doc.exists else None

    # When finalized, mark patient's today appointment as completed and advance queue
    if result and data.status == "final":
        try:
            from app.services.appointment_service import (
                list_appointments,
                update_appointment,
                _advance_queue,
            )
            from app.models.appointment import AppointmentUpdate, AppointmentStatus

            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            patient_id = result.get("patientId")
            appts = await list_appointments(clinic_id, date=today)
            appt = next(
                (
                    a for a in appts
                    if a.get("patientId") == patient_id
                    and a.get("status") not in ("completed", "cancelled")
                ),
                None,
            )
            if appt:
                upd = AppointmentUpdate(status=AppointmentStatus("completed"))
                await update_appointment(clinic_id, appt["id"], upd)
        except Exception:
            pass

    return result
