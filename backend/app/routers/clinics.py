import io
import base64
import qrcode
from fastapi import APIRouter, HTTPException, Depends, Body
from app.models.clinic import ClinicCreate, ClinicUpdate, DoctorCreate, DoctorUpdate, StaffCreate
from app.firebase_admin import get_auth
from app.services.clinic_service import (
    create_clinic,
    get_clinic,
    get_clinic_by_slug,
    list_clinics,
    update_clinic,
    update_clinic_qr,
    create_doctor,
    list_doctors,
    get_doctor,
    update_doctor,
    delete_doctor,
    create_staff,
    list_staff,
    delete_staff,
)
from app.dependencies import require_auth, require_platform_admin

router = APIRouter(prefix="/api/clinics", tags=["clinics"])


@router.get("/")
async def list_clinics_endpoint():
    return await list_clinics()


@router.post("/", dependencies=[Depends(require_platform_admin)])
async def create_clinic_endpoint(data: ClinicCreate, base_url: str = ""):
    import os
    clinic = await create_clinic(data)
    clinic_id = clinic["id"]
    slug = clinic.get("slug", clinic_id)
    platform_url = os.getenv("PLATFORM_URL", base_url or "https://dia-clinic.vercel.app")
    booking_url = f"{platform_url}/clinic/{slug}"
    qr_img = qrcode.make(booking_url)
    buf = io.BytesIO()
    qr_img.save(buf, format="PNG")
    qr_b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    await update_clinic_qr(clinic_id, qr_b64, booking_url)
    clinic["qrCodeUrl"] = qr_b64
    clinic["bookingUrl"] = booking_url
    return clinic


@router.get("/by-slug/{slug}")
async def get_clinic_by_slug_endpoint(slug: str):
    """Public endpoint — lookup clinic by URL slug. No auth required."""
    clinic = await get_clinic_by_slug(slug)
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return clinic


@router.get("/{clinic_id}")
async def get_clinic_endpoint(clinic_id: str):
    clinic = await get_clinic(clinic_id)
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return clinic


@router.patch("/{clinic_id}", dependencies=[Depends(require_auth)])
async def update_clinic_endpoint(clinic_id: str, data: ClinicUpdate):
    clinic = await update_clinic(clinic_id, data)
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return clinic


@router.get("/{clinic_id}/doctors")
async def list_doctors_endpoint(clinic_id: str):
    return await list_doctors(clinic_id)


@router.post("/{clinic_id}/doctors", dependencies=[Depends(require_auth)])
async def create_doctor_endpoint(clinic_id: str, data: DoctorCreate):
    return await create_doctor(clinic_id, data)


@router.get("/{clinic_id}/doctors/{doctor_id}")
async def get_doctor_endpoint(clinic_id: str, doctor_id: str):
    doc = await get_doctor(clinic_id, doctor_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doc


@router.patch("/{clinic_id}/doctors/{doctor_id}", dependencies=[Depends(require_auth)])
async def update_doctor_endpoint(clinic_id: str, doctor_id: str, data: DoctorUpdate):
    doc = await update_doctor(clinic_id, doctor_id, data)
    if not doc:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doc


@router.post("/{clinic_id}/doctors/{doctor_id}/link-user", dependencies=[Depends(require_platform_admin)])
async def link_user_to_doctor(clinic_id: str, doctor_id: str, uid: str = Body(..., embed=True)):
    """Assign clinicId + doctorId custom claims to an existing Firebase Auth user."""
    import asyncio
    try:
        await asyncio.to_thread(
            get_auth().set_custom_user_claims,
            uid,
            {"clinicId": clinic_id, "doctorId": doctor_id},
        )
        db_ref = (
            __import__("app.firebase_admin", fromlist=["get_db"]).get_db()
            .collection("clinics").document(clinic_id)
            .collection("doctors").document(doctor_id)
        )
        await asyncio.to_thread(db_ref.update, {"firebaseUid": uid})
        return {"message": "Claims set", "uid": uid, "clinicId": clinic_id, "doctorId": doctor_id}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/{clinic_id}/doctors/{doctor_id}", dependencies=[Depends(require_platform_admin)])
async def delete_doctor_endpoint(clinic_id: str, doctor_id: str):
    await delete_doctor(clinic_id, doctor_id)
    return {"message": "Doctor removed"}


@router.get("/{clinic_id}/staff")
async def list_staff_endpoint(clinic_id: str):
    return await list_staff(clinic_id)


@router.post("/{clinic_id}/staff", dependencies=[Depends(require_auth)])
async def create_staff_endpoint(clinic_id: str, data: StaffCreate):
    return await create_staff(clinic_id, data)


@router.delete("/{clinic_id}/staff/{staff_id}", dependencies=[Depends(require_platform_admin)])
async def delete_staff_endpoint(clinic_id: str, staff_id: str):
    await delete_staff(clinic_id, staff_id)
    return {"message": "Staff removed"}
