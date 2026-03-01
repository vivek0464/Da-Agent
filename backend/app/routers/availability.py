from fastapi import APIRouter, Depends, Query
from app.models.availability import AvailabilityCreate
from app.services.availability_service import (
    set_availability,
    get_availability,
    list_availability,
    get_available_slots,
)
from app.dependencies import require_auth

router = APIRouter(
    prefix="/api/clinics/{clinic_id}/availability", tags=["availability"]
)


@router.get("/")
async def list_availability_endpoint(
    clinic_id: str,
    doctor_id: str | None = Query(None),
    date: str | None = Query(None),
):
    return await list_availability(clinic_id, doctor_id=doctor_id, date=date)


@router.post("/", dependencies=[Depends(require_auth)])
async def set_availability_endpoint(clinic_id: str, data: AvailabilityCreate):
    data.clinicId = clinic_id
    return await set_availability(data)


@router.get("/slots")
async def available_slots_endpoint(
    clinic_id: str,
    doctor_id: str = Query(...),
    date: str = Query(...),
):
    return await get_available_slots(clinic_id, doctor_id, date)
