"""
Links existing Firestore doctor records to Firebase Auth accounts.
Creates a new Firebase Auth user if none exists for the doctor's email.
Run: python link_doctors.py
"""
import secrets
from dotenv import load_dotenv

load_dotenv()

from app.firebase_admin import initialize_firebase, get_db, get_auth

print("Initializing Firebase...")
initialize_firebase()
auth = get_auth()
db = get_db()

if db is None:
    print("ERROR: Firestore not connected. Check serviceAccount.json and .env")
    exit(1)

print("Fetching clinics...")
clinics = list(db.collection("clinics").stream())
print(f"Found {len(clinics)} clinics\n")

for c in clinics:
    cid = c.id
    cname = c.to_dict().get("name")
    print(f"Clinic: {cname} ({cid})")

    doctors = list(
        db.collection("clinics").document(cid).collection("doctors").stream()
    )

    for doc in doctors:
        dd = doc.to_dict()
        did = doc.id
        email = dd.get("email", "")
        name = dd.get("name", "")

        if dd.get("firebaseUid"):
            print(f"  [SKIP] {name} — already linked (uid={dd['firebaseUid']})")
            continue

        print(f"  [PROCESS] {name} <{email}>")

        # Check if Firebase Auth user exists
        try:
            fb_user = auth.get_user_by_email(email)
            uid = fb_user.uid
            print(f"    Found existing Firebase user: uid={uid}")
        except Exception:
            # Create new Firebase Auth user
            pwd = secrets.token_urlsafe(10)
            fb_user = auth.create_user(
                email=email, password=pwd, display_name=name
            )
            uid = fb_user.uid
            print(f"    Created Firebase user: uid={uid}")
            print(f"    *** SAVE THIS PASSWORD: {pwd} ***")

        # Set custom claims
        auth.set_custom_user_claims(uid, {"clinicId": cid, "doctorId": did})
        print(f"    Claims set: clinicId={cid}, doctorId={did}")

        # Update Firestore
        db.collection("clinics").document(cid).collection("doctors").document(
            did
        ).update({"firebaseUid": uid})
        print(f"    Firestore updated.")

print("\nDone.")
