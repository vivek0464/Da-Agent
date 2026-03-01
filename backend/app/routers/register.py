"""Public patient self-registration — no auth required.
QR code for a clinic points to: {PLATFORM_URL}/clinic/{slug}
This router backs that page with clinic info + doctor list + registration.
"""
from fastapi import APIRouter, HTTPException
from app.models.patient import PatientRegister, PatientCreate
from app.services.patient_service import create_patient
from app.services.clinic_service import get_clinic, get_clinic_by_slug, get_doctor, list_doctors

router = APIRouter(prefix="/api/register", tags=["register"])


@router.get("/clinic/{slug}")
async def get_clinic_public(slug: str):
    """Return clinic info + all doctors for the public registration page."""
    clinic = await get_clinic_by_slug(slug)
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    doctors = await list_doctors(clinic["id"])
    return {
        "clinicId": clinic["id"],
        "clinicName": clinic.get("name"),
        "clinicAddress": clinic.get("address"),
        "clinicPhone": clinic.get("phone"),
        "doctors": [
            {
                "id": d["id"],
                "name": d.get("name"),
                "specialization": d.get("specialization"),
            }
            for d in doctors
        ],
    }


@router.post("/clinic/{slug}")
async def register_patient_by_slug(slug: str, data: PatientRegister, doctor_id: str = ""):
    """Register a patient into a doctor's queue for the given clinic (by slug)."""
    clinic = await get_clinic_by_slug(slug)
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic_id = clinic["id"]

    if not doctor_id:
        raise HTTPException(status_code=400, detail="doctor_id query param required")
    doctor = await get_doctor(clinic_id, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    patient_data = PatientCreate(
        clinicId=clinic_id,
        name=data.name,
        phone=data.phone,
        age=data.age,
        gender=data.gender,
    )
    patient = await create_patient(patient_data, doctor_id=doctor_id, date=data.date or None)
    return {
        "patientId": patient.get("id"),
        "patientName": patient.get("name"),
        "queuePosition": patient.get("queuePosition"),
        "date": data.date,
        "doctorName": doctor.get("name"),
        "message": f"Welcome {data.name}! You are registered for Dr. {doctor.get('name')}.",
    }


@router.get("/{clinic_id}/{doctor_id}")
async def get_registration_info(clinic_id: str, doctor_id: str):
    """Return clinic + doctor name (legacy endpoint)."""
    clinic = await get_clinic(clinic_id)
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    doctor = await get_doctor(clinic_id, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return {
        "clinicId": clinic_id,
        "clinicName": clinic.get("name"),
        "doctorId": doctor_id,
        "doctorName": doctor.get("name"),
        "doctorSpecialization": doctor.get("specialization"),
    }


@router.post("/{clinic_id}/{doctor_id}")
async def register_patient(clinic_id: str, doctor_id: str, data: PatientRegister):
    """Register a patient into a doctor's queue (legacy endpoint)."""
    clinic = await get_clinic(clinic_id)
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    doctor = await get_doctor(clinic_id, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    patient_data = PatientCreate(
        clinicId=clinic_id,
        name=data.name,
        phone=data.phone,
        age=data.age,
        gender=data.gender,
    )
    patient = await create_patient(patient_data, doctor_id=doctor_id, date=data.date or None)
    return {
        "patientId": patient.get("id"),
        "patientName": patient.get("name"),
        "queuePosition": patient.get("queuePosition"),
        "message": f"Welcome {data.name}! You are registered for Dr. {doctor.get('name')}.",
    }
