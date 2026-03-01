#!/usr/bin/env python3
"""Fix Dr. Vivek's Firebase custom claims - wrong clinicId in token."""
import os, sys
os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", "serviceAccount.json")

import firebase_admin
from firebase_admin import credentials, auth

cred = credentials.Certificate("serviceAccount.json")
firebase_admin.initialize_app(cred)

EMAIL = "vivek170101080@gmail.com"
CORRECT_CLINIC_ID = "rtJAnHTSX5jrqyA3wVoG"
CORRECT_DOCTOR_ID = "QmtTTksWfBvi0k6pf67L"

try:
    user = auth.get_user_by_email(EMAIL)
    print(f"Found user: {user.uid}")
    print(f"Current claims: {user.custom_claims}")

    auth.set_custom_user_claims(user.uid, {
        "clinicId": CORRECT_CLINIC_ID,
        "doctorId": CORRECT_DOCTOR_ID,
    })
    print(f"Claims updated: clinicId={CORRECT_CLINIC_ID}, doctorId={CORRECT_DOCTOR_ID}")

    # Also update firebaseUid in Firestore doctor record
    from firebase_admin import firestore
    db = firestore.client()
    dr_ref = db.collection("clinics").document(CORRECT_CLINIC_ID).collection("doctors").document(CORRECT_DOCTOR_ID)
    dr_ref.update({"firebaseUid": user.uid})
    print(f"Firestore doctor record updated with firebaseUid={user.uid}")

except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
