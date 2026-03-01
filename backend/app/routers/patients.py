from fastapi import APIRouter, HTTPException, Depends, Query
from app.models.patient import PatientCreate, PatientUpdate
from app.services.patient_service import (
    create_patient,
    get_patient,
    list_patients,
    update_patient,
)
from app.dependencies import require_auth

router = APIRouter(prefix="/api/clinics/{clinic_id}/patients", tags=["patients"])


@router.get("/", dependencies=[Depends(require_auth)])
async def list_patients_endpoint(
    clinic_id: str,
    search: str | None = Query(None),
):
    return await list_patients(clinic_id, search=search)


@router.post("/", dependencies=[Depends(require_auth)])
async def create_patient_endpoint(
    clinic_id: str,
    data: PatientCreate,
    doctor_id: str | None = Query(None),
):
    data.clinicId = clinic_id
    return await create_patient(data, doctor_id=doctor_id)


@router.get("/{patient_id}", dependencies=[Depends(require_auth)])
async def get_patient_endpoint(clinic_id: str, patient_id: str):
    patient = await get_patient(clinic_id, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.patch("/{patient_id}", dependencies=[Depends(require_auth)])
async def update_patient_endpoint(
    clinic_id: str, patient_id: str, data: PatientUpdate
):
    patient = await update_patient(clinic_id, patient_id, data)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient
