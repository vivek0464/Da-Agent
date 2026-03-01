from fastapi import APIRouter, HTTPException, Depends, Query
from app.models.appointment import AppointmentCreate, AppointmentUpdate, QueueReorderRequest
from app.services.appointment_service import (
    create_appointment,
    get_appointment,
    list_appointments,
    update_appointment,
    reorder_queue,
    delete_appointment,
)
from app.services.sms_service import send_appointment_confirmation
from app.services.clinic_service import get_clinic
from app.dependencies import require_auth

router = APIRouter(prefix="/api/clinics/{clinic_id}/appointments", tags=["appointments"])


@router.get("/")
async def list_appointments_endpoint(
    clinic_id: str,
    date: str | None = Query(None),
    doctor_id: str | None = Query(None),
    status: str | None = Query(None),
):
    return await list_appointments(clinic_id, date=date, doctor_id=doctor_id, status=status)


@router.post("/")
async def create_appointment_endpoint(clinic_id: str, data: AppointmentCreate):
    data.clinicId = clinic_id
    appointment = await create_appointment(data)

    clinic = await get_clinic(clinic_id)
    clinic_name = clinic.get("name", "Clinic") if clinic else "Clinic"
    await send_appointment_confirmation(
        patient_phone=appointment["patientPhone"],
        patient_name=appointment["patientName"],
        date=appointment["date"],
        time_slot=appointment["timeSlot"],
        clinic_name=clinic_name,
        queue_position=appointment["queuePosition"],
        estimated_time=appointment["estimatedTime"],
    )
    return appointment


@router.get("/{appointment_id}", dependencies=[Depends(require_auth)])
async def get_appointment_endpoint(clinic_id: str, appointment_id: str):
    appt = await get_appointment(clinic_id, appointment_id)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


@router.patch("/{appointment_id}", dependencies=[Depends(require_auth)])
async def update_appointment_endpoint(
    clinic_id: str, appointment_id: str, data: AppointmentUpdate
):
    appt = await update_appointment(clinic_id, appointment_id, data)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


@router.delete("/{appointment_id}", dependencies=[Depends(require_auth)])
async def delete_appointment_endpoint(clinic_id: str, appointment_id: str):
    await delete_appointment(clinic_id, appointment_id)
    return {"ok": True}


@router.post("/reorder", dependencies=[Depends(require_auth)])
async def reorder_queue_endpoint(
    clinic_id: str,
    date: str = Query(...),
    data: QueueReorderRequest = ...,
):
    return await reorder_queue(clinic_id, date, data.orderedIds)
