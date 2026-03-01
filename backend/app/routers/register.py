"""Public patient self-registration — no auth required.
QR code for a clinic points to: {PLATFORM_URL}/clinic/{slug}
This router backs that page with clinic info + doctor list + registration.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from app.models.patient import PatientRegister, PatientCreate
from app.services.patient_service import create_patient
from app.services.clinic_service import get_clinic, get_clinic_by_slug, get_doctor, list_doctors
from app.services.scheduling_service import get_slots_for_date, calculate_estimated_appointment
from app.services.appointment_service import list_appointments

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


@router.get("/clinic/{slug}/slots")
async def get_doctor_slots_public(
    slug: str,
    doctor_id: str = Query(...),
    date: str = Query(...),
):
    """Public endpoint — return doctor's time slots for a given date (with recurring fallback)."""
    clinic = await get_clinic_by_slug(slug)
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    slots = await get_slots_for_date(clinic["id"], doctor_id, date)
    return {"slots": slots, "date": date, "doctor_id": doctor_id}


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

    reg_date = data.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # ── Scheduling validation ──────────────────────────────────────────────────
    slots = await get_slots_for_date(clinic_id, doctor_id, reg_date)
    if slots:
        # Current queue length for this doctor on this date
        existing = await list_appointments(clinic_id, date=reg_date, doctor_id=doctor_id)
        active = [a for a in existing if a.get("status") not in ("cancelled", "completed")]
        next_pos = len(active) + 1

        sched = calculate_estimated_appointment(reg_date, next_pos, slots)
        if sched["rejected"]:
            raise HTTPException(status_code=422, detail=sched["rejection_reason"])
        estimated_time_str = sched.get("estimated_time_str")
    else:
        sched = None
        estimated_time_str = None

    # ── Create patient + appointment ───────────────────────────────────────────
    patient_data = PatientCreate(
        clinicId=clinic_id,
        name=data.name,
        phone=data.phone,
        age=data.age,
        gender=data.gender,
    )
    patient = await create_patient(
        patient_data,
        doctor_id=doctor_id,
        date=reg_date,
        estimated_time=estimated_time_str,
    )

    response: dict = {
        "patientId": patient.get("id"),
        "patientName": patient.get("name"),
        "queuePosition": patient.get("queuePosition"),
        "date": reg_date,
        "doctorName": doctor.get("name"),
        "message": f"Welcome {data.name}! You are registered for Dr. {doctor.get('name')}.",
    }
    if sched and not sched.get("no_slots"):
        response["estimatedTime"] = sched.get("estimated_time_str")
        response["slotLabel"] = sched.get("slot_label")
        if sched.get("alt_time_str"):
            response["altTime"] = sched["alt_time_str"]
            response["altSlotLabel"] = sched["alt_slot_label"]
    return response


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
