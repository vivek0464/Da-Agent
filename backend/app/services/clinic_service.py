import re
import asyncio
import secrets
import logging
from datetime import datetime, timezone
from app.firebase_admin import get_db, get_auth
from app.models.clinic import ClinicCreate, ClinicUpdate, DoctorCreate, DoctorUpdate, StaffCreate


def _make_slug(name: str) -> str:
    """Convert clinic name to URL-safe slug: 'City Medical Clinic' → 'city-medical-clinic'."""
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s-]+", "-", slug).strip("-")
    return slug or "clinic"

logger = logging.getLogger(__name__)


async def create_clinic(data: ClinicCreate) -> dict:
    db = get_db()
    ref = db.collection("clinics").document()
    now = datetime.now(timezone.utc).isoformat()
    base_slug = _make_slug(data.name)
    # Ensure slug uniqueness by appending ID suffix if needed
    existing = await asyncio.to_thread(
        lambda: list(db.collection("clinics").where("slug", "==", base_slug).limit(1).stream())
    )
    slug = base_slug if not existing else f"{base_slug}-{ref.id[:6]}"
    doc = {
        **data.model_dump(),
        "id": ref.id,
        "slug": slug,
        "qrCodeUrl": None,
        "createdAt": now,
        "updatedAt": now,
    }
    await asyncio.to_thread(ref.set, doc)
    return doc


async def get_clinic(clinic_id: str) -> dict | None:
    db = get_db()
    doc = await asyncio.to_thread(db.collection("clinics").document(clinic_id).get)
    return doc.to_dict() if doc.exists else None


async def get_clinic_by_slug(slug: str) -> dict | None:
    db = get_db()
    docs = await asyncio.to_thread(
        lambda: list(db.collection("clinics").where("slug", "==", slug).limit(1).stream())
    )
    return docs[0].to_dict() if docs else None


async def list_clinics() -> list:
    db = get_db()
    docs = await asyncio.to_thread(lambda: list(db.collection("clinics").stream()))
    return [d.to_dict() for d in docs]


async def update_clinic(clinic_id: str, data: ClinicUpdate) -> dict | None:
    db = get_db()
    ref = db.collection("clinics").document(clinic_id)
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    updates["updatedAt"] = datetime.now(timezone.utc).isoformat()
    await asyncio.to_thread(ref.update, updates)
    doc = await asyncio.to_thread(ref.get)
    return doc.to_dict() if doc.exists else None


async def update_clinic_qr(clinic_id: str, qr_url: str, booking_url: str = "") -> None:
    db = get_db()
    ref = db.collection("clinics").document(clinic_id)
    updates = {"qrCodeUrl": qr_url, "updatedAt": datetime.now(timezone.utc).isoformat()}
    if booking_url:
        updates["bookingUrl"] = booking_url
    await asyncio.to_thread(ref.update, updates)


async def create_doctor(clinic_id: str, data: DoctorCreate) -> dict:
    """Store doctor in Firestore. Firebase Auth / claims are set on first Google Sign-In via /api/auth/link."""
    db = get_db()
    ref = (
        db.collection("clinics").document(clinic_id).collection("doctors").document()
    )
    now = datetime.now(timezone.utc).isoformat()
    doctor_id = ref.id

    doc_data = {k: v for k, v in data.model_dump().items() if k != "password"}
    doc = {
        **doc_data,
        "id": doctor_id,
        "clinicId": clinic_id,
        "firebaseUid": None,
        "createdAt": now,
    }
    await asyncio.to_thread(ref.set, doc)
    logger.info(f"Doctor created in Firestore: {data.email} (clinic={clinic_id}) — will link on first Google sign-in")
    return dict(doc)


async def get_doctor(clinic_id: str, doctor_id: str) -> dict | None:
    db = get_db()
    doc = await asyncio.to_thread(
        db.collection("clinics")
        .document(clinic_id)
        .collection("doctors")
        .document(doctor_id)
        .get
    )
    return doc.to_dict() if doc.exists else None


async def list_doctors(clinic_id: str) -> list:
    db = get_db()
    docs = await asyncio.to_thread(
        lambda: list(
            db.collection("clinics").document(clinic_id).collection("doctors").stream()
        )
    )
    return [d.to_dict() for d in docs]


async def update_doctor(clinic_id: str, doctor_id: str, data: DoctorUpdate) -> dict | None:
    db = get_db()
    ref = (
        db.collection("clinics")
        .document(clinic_id)
        .collection("doctors")
        .document(doctor_id)
    )
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    await asyncio.to_thread(ref.update, updates)
    doc = await asyncio.to_thread(ref.get)
    return doc.to_dict() if doc.exists else None


async def delete_doctor(clinic_id: str, doctor_id: str) -> None:
    db = get_db()
    ref = (
        db.collection("clinics")
        .document(clinic_id)
        .collection("doctors")
        .document(doctor_id)
    )
    await asyncio.to_thread(ref.delete)


async def create_staff(clinic_id: str, data: StaffCreate) -> dict:
    """Store staff in Firestore. Firebase Auth / claims are set on first Google Sign-In via /api/auth/link."""
    db = get_db()
    ref = (
        db.collection("clinics").document(clinic_id).collection("staff").document()
    )
    now = datetime.now(timezone.utc).isoformat()
    staff_id = ref.id

    doc = {
        **data.model_dump(),
        "id": staff_id,
        "clinicId": clinic_id,
        "firebaseUid": None,
        "createdAt": now,
    }
    await asyncio.to_thread(ref.set, doc)
    return dict(doc)


async def list_staff(clinic_id: str) -> list:
    db = get_db()
    docs = await asyncio.to_thread(
        lambda: list(
            db.collection("clinics").document(clinic_id).collection("staff").stream()
        )
    )
    return [d.to_dict() for d in docs]


async def delete_staff(clinic_id: str, staff_id: str) -> None:
    db = get_db()
    ref = (
        db.collection("clinics")
        .document(clinic_id)
        .collection("staff")
        .document(staff_id)
    )
    await asyncio.to_thread(ref.delete)
