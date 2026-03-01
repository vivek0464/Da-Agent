"""
Auto-link endpoint: after any sign-in (especially Google), call this to assign
clinicId + doctorId/staffId custom claims based on the doctor's email in Firestore.

Flow:
  1. Doctor signs in with Google (or email/password)
  2. Frontend calls POST /api/auth/link  (sends Firebase ID token in Authorization header)
  3. Backend verifies token, looks up email across all clinics, sets claims
  4. Frontend calls user.getIdToken(true) to force-refresh the token → claims now available
"""
import asyncio
import logging
from fastapi import APIRouter, HTTPException, Depends
from app.firebase_admin import get_auth, get_db
from app.dependencies import require_auth

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)


async def _find_role_by_email(email: str) -> dict | None:
    """Search every clinic for a doctor or staff record with this email."""
    db = get_db()
    email_lower = email.lower().strip()

    clinics = await asyncio.to_thread(
        lambda: list(db.collection("clinics").stream())
    )

    for clinic_doc in clinics:
        clinic_id = clinic_doc.id

        # Search doctors
        doctors = await asyncio.to_thread(
            lambda cid=clinic_id: list(
                db.collection("clinics").document(cid).collection("doctors")
                .where("email", "==", email_lower).limit(1).stream()
            )
        )
        if doctors:
            d = doctors[0].to_dict()
            return {
                "clinicId": clinic_id,
                "doctorId": d["id"],
                "role": "doctor",
                "name": d.get("name"),
            }

        # Also try case-insensitive fallback
        all_doctors = await asyncio.to_thread(
            lambda cid=clinic_id: list(
                db.collection("clinics").document(cid).collection("doctors").stream()
            )
        )
        for dd in all_doctors:
            data = dd.to_dict()
            if (data.get("email") or "").lower().strip() == email_lower:
                return {
                    "clinicId": clinic_id,
                    "doctorId": data["id"],
                    "role": "doctor",
                    "name": data.get("name"),
                }

        # Search staff
        all_staff = await asyncio.to_thread(
            lambda cid=clinic_id: list(
                db.collection("clinics").document(cid).collection("staff").stream()
            )
        )
        for sd in all_staff:
            data = sd.to_dict()
            if (data.get("email") or "").lower().strip() == email_lower:
                return {
                    "clinicId": clinic_id,
                    "staffId": data["id"],
                    "role": "staff",
                    "name": data.get("name"),
                }

    return None


@router.post("/link")
async def link_account(user=Depends(require_auth)):
    """
    Assign clinic custom claims to the authenticated user by looking up their email.
    Safe to call on every login — idempotent if claims already set.
    """
    uid: str = user["uid"]
    email: str = (user.get("email") or "").lower().strip()
    # Platform admin — never overwrite
    if user.get("platform_admin"):
        return {"role": "platform_admin", "alreadyLinked": True}

    # Already fully linked
    if user.get("clinicId") and (user.get("doctorId") or user.get("staffId")):
        role = "doctor" if user.get("doctorId") else "staff"
        return {
            "role": role,
            "clinicId": user["clinicId"],
            "alreadyLinked": True,
        }

    if not email:
        raise HTTPException(status_code=400, detail="No email on account — cannot auto-link")

    role_info = await _find_role_by_email(email)
    if not role_info:
        raise HTTPException(
            status_code=404,
            detail=f"No doctor or staff record found for {email}. "
                   "Ask your clinic admin to add you with this email address.",
        )

    auth = get_auth()
    claims: dict = {"clinicId": role_info["clinicId"]}
    if role_info["role"] == "doctor":
        claims["doctorId"] = role_info["doctorId"]
    else:
        claims["staffId"] = role_info["staffId"]

    await asyncio.to_thread(auth.set_custom_user_claims, uid, claims)

    # Also store Firebase UID back onto the Firestore record
    db = get_db()
    try:
        if role_info["role"] == "doctor":
            await asyncio.to_thread(
                db.collection("clinics").document(role_info["clinicId"])
                .collection("doctors").document(role_info["doctorId"])
                .update, {"firebaseUid": uid}
            )
        else:
            await asyncio.to_thread(
                db.collection("clinics").document(role_info["clinicId"])
                .collection("staff").document(role_info["staffId"])
                .update, {"firebaseUid": uid}
            )
    except Exception as exc:
        logger.warning(f"Could not update firebaseUid for {email}: {exc}")

    logger.info(f"Auto-linked {email} → {role_info}")
    return {
        "role": role_info["role"],
        "clinicId": role_info["clinicId"],
        "name": role_info.get("name"),
        "linked": True,
    }
