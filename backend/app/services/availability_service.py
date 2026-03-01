import asyncio
from datetime import datetime
from app.firebase_admin import get_db
from app.models.availability import AvailabilityCreate, AvailabilityUpdate


async def set_availability(data: AvailabilityCreate) -> dict:
    db = get_db()
    doc_id = f"{data.doctorId}_{data.date}"
    ref = (
        db.collection("clinics")
        .document(data.clinicId)
        .collection("availability")
        .document(doc_id)
    )
    doc = {
        **data.model_dump(),
        "id": doc_id,
        "clinicId": data.clinicId,
        "slots": [s.model_dump() for s in data.slots],
    }
    await asyncio.to_thread(ref.set, doc)
    return doc


async def get_availability(
    clinic_id: str, doctor_id: str, date: str
) -> dict | None:
    db = get_db()
    doc_id = f"{doctor_id}_{date}"
    doc = await asyncio.to_thread(
        db.collection("clinics")
        .document(clinic_id)
        .collection("availability")
        .document(doc_id)
        .get
    )
    return doc.to_dict() if doc.exists else None


async def list_availability(
    clinic_id: str,
    doctor_id: str | None = None,
    date: str | None = None,
) -> list:
    db = get_db()
    query = db.collection("clinics").document(clinic_id).collection("availability")
    if doctor_id:
        query = query.where("doctorId", "==", doctor_id)
    if date:
        query = query.where("date", "==", date)
    docs = await asyncio.to_thread(lambda: list(query.stream()))
    return [d.to_dict() for d in docs]


async def get_available_slots(
    clinic_id: str, doctor_id: str, date: str
) -> list[str]:
    """Return unbooked time slot strings for a doctor on a given date."""
    from app.services.appointment_service import list_appointments

    availability = await get_availability(clinic_id, doctor_id, date)

    if not availability:
        day = datetime.strptime(date, "%Y-%m-%d").weekday()
        db = get_db()
        recurring_docs = await asyncio.to_thread(
            lambda: list(
                db.collection("clinics")
                .document(clinic_id)
                .collection("availability")
                .where("doctorId", "==", doctor_id)
                .where("recurring", "==", True)
                .where("dayOfWeek", "==", day)
                .stream()
            )
        )
        if recurring_docs:
            availability = recurring_docs[0].to_dict()

    if not availability:
        return []

    booked = await list_appointments(clinic_id, date=date, doctor_id=doctor_id)
    booked_slots = {
        a["timeSlot"] for a in booked if a.get("status") != "cancelled"
    }
    all_slots = [
        f"{s['start']}-{s['end']}" for s in availability.get("slots", [])
    ]
    return [s for s in all_slots if s not in booked_slots]
