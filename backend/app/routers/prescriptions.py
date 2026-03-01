from fastapi import APIRouter, HTTPException, Depends, Query
from app.models.prescription import PrescriptionCreate, PrescriptionUpdate
from app.services.prescription_service import (
    create_prescription,
    get_prescription,
    list_prescriptions,
    update_prescription,
    list_print_queue,
    mark_printed,
)
from app.dependencies import require_auth

router = APIRouter(
    prefix="/api/clinics/{clinic_id}/prescriptions", tags=["prescriptions"]
)


@router.get("/", dependencies=[Depends(require_auth)])
async def list_prescriptions_endpoint(
    clinic_id: str,
    patient_id: str | None = Query(None),
    doctor_id: str | None = Query(None),
):
    return await list_prescriptions(clinic_id, patient_id=patient_id, doctor_id=doctor_id)


@router.post("/", dependencies=[Depends(require_auth)])
async def create_prescription_endpoint(clinic_id: str, data: PrescriptionCreate):
    data.clinicId = clinic_id
    return await create_prescription(data)


@router.get("/{prescription_id}", dependencies=[Depends(require_auth)])
async def get_prescription_endpoint(clinic_id: str, prescription_id: str):
    rx = await get_prescription(clinic_id, prescription_id)
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    return rx


@router.patch("/{prescription_id}", dependencies=[Depends(require_auth)])
async def update_prescription_endpoint(
    clinic_id: str, prescription_id: str, data: PrescriptionUpdate
):
    rx = await update_prescription(clinic_id, prescription_id, data)
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    return rx


@router.get("/print-queue", dependencies=[Depends(require_auth)])
async def get_print_queue(
    clinic_id: str, doctor_id: str | None = Query(None)
):
    return await list_print_queue(clinic_id, doctor_id=doctor_id)


@router.post("/{prescription_id}/mark-printed", dependencies=[Depends(require_auth)])
async def mark_prescription_printed(clinic_id: str, prescription_id: str):
    rx = await mark_printed(clinic_id, prescription_id)
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    return rx
