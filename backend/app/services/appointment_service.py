import asyncio
from datetime import datetime, timezone
from app.firebase_admin import get_db
from app.models.appointment import AppointmentCreate, AppointmentUpdate, AppointmentStatus


async def _advance_queue(clinic_id: str, date: str) -> None:
    """Mark the top scheduled appointment as in-progress if none is currently in-progress."""
    db = get_db()
    all_appts = await list_appointments(clinic_id, date=date)
    already_active = any(a.get("status") == "in-progress" for a in all_appts)
    if already_active:
        return
    scheduled = sorted(
        [a for a in all_appts if a.get("status") == "scheduled"],
        key=lambda x: x.get("queuePosition", 9999),
    )
    if not scheduled:
        return
    top = scheduled[0]
    ref = (
        db.collection("clinics")
        .document(clinic_id)
        .collection("appointments")
        .document(top["id"])
    )
    await asyncio.to_thread(ref.update, {"status": "in-progress"})


async def create_appointment(data: AppointmentCreate) -> dict:
    db = get_db()
    ref = (
        db.collection("clinics")
        .document(data.clinicId)
        .collection("appointments")
        .document()
    )
    now = datetime.now(timezone.utc).isoformat()

    existing = await list_appointments(data.clinicId, date=data.date, doctor_id=data.doctorId)
    active = [
        a
        for a in existing
        if a.get("status") not in ("cancelled", "completed")
    ]
    queue_pos = len(active) + 1
    estimated_time = f"~{queue_pos * 5} min wait"

    doc = {
        **data.model_dump(),
        "id": ref.id,
        "queuePosition": queue_pos,
        "status": AppointmentStatus.scheduled.value,
        "estimatedTime": estimated_time,
        "paymentStatus": "unpaid",
        "createdAt": now,
    }
    await asyncio.to_thread(ref.set, doc)
    # Auto in-progress if this is the only active patient
    if queue_pos == 1:
        ref2 = (
            db.collection("clinics")
            .document(data.clinicId)
            .collection("appointments")
            .document(ref.id)
        )
        await asyncio.to_thread(ref2.update, {"status": "in-progress"})
        doc["status"] = "in-progress"
    return doc


async def get_appointment(clinic_id: str, appointment_id: str) -> dict | None:
    db = get_db()
    doc = await asyncio.to_thread(
        db.collection("clinics")
        .document(clinic_id)
        .collection("appointments")
        .document(appointment_id)
        .get
    )
    return doc.to_dict() if doc.exists else None


async def list_appointments(
    clinic_id: str,
    date: str | None = None,
    doctor_id: str | None = None,
    status: str | None = None,
) -> list:
    db = get_db()
    query = db.collection("clinics").document(clinic_id).collection("appointments")
    if date:
        query = query.where("date", "==", date)
    if doctor_id:
        query = query.where("doctorId", "==", doctor_id)
    if status:
        query = query.where("status", "==", status)
    docs = await asyncio.to_thread(lambda: list(query.stream()))
    appointments = [d.to_dict() for d in docs]
    appointments.sort(key=lambda x: x.get("queuePosition", 0))
    return appointments


async def update_appointment(
    clinic_id: str, appointment_id: str, data: AppointmentUpdate
) -> dict | None:
    db = get_db()
    ref = (
        db.collection("clinics")
        .document(clinic_id)
        .collection("appointments")
        .document(appointment_id)
    )
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if "status" in updates and hasattr(updates["status"], "value"):
        updates["status"] = updates["status"].value
    await asyncio.to_thread(ref.update, updates)
    doc = await asyncio.to_thread(ref.get)
    result = doc.to_dict() if doc.exists else None
    # When an appointment finishes, advance the queue
    if result and updates.get("status") in ("completed", "cancelled"):
        await _advance_queue(clinic_id, result.get("date", ""))
    return result


async def delete_appointment(clinic_id: str, appointment_id: str) -> None:
    db = get_db()
    ref = (
        db.collection("clinics")
        .document(clinic_id)
        .collection("appointments")
        .document(appointment_id)
    )
    await asyncio.to_thread(ref.delete)


async def reorder_queue(clinic_id: str, date: str, ordered_ids: list[str]) -> list:
    db = get_db()
    batch = db.batch()
    for i, appt_id in enumerate(ordered_ids):
        ref = (
            db.collection("clinics")
            .document(clinic_id)
            .collection("appointments")
            .document(appt_id)
        )
        batch.update(ref, {"queuePosition": i + 1})
    await asyncio.to_thread(batch.commit)
    return await list_appointments(clinic_id, date=date)
