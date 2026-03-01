#!/usr/bin/env python3
"""
Link a Google-authenticated user to a clinic doctor or staff record.

Usage:
  # After a doctor signs in with Google for the first time, look up their Firebase UID,
  # then run this script to assign clinicId + doctorId claims so they can access the dashboard.

  python link_google_doctor.py --uid <firebase_uid> --clinic <clinic_id> --doctor <doctor_id>
  python link_google_doctor.py --uid <firebase_uid> --clinic <clinic_id> --staff <staff_id>

  # Or link by email (looks up UID automatically):
  python link_google_doctor.py --email doctor@gmail.com --clinic <clinic_id> --doctor <doctor_id>
"""
import argparse
import sys
import os

# Load env
from dotenv import load_dotenv
load_dotenv()

from app.firebase_admin import initialize_firebase, get_auth, get_db
import asyncio

initialize_firebase()


def link_doctor(uid: str, clinic_id: str, doctor_id: str):
    auth = get_auth()
    db = get_db()

    # Set custom claims
    auth.set_custom_user_claims(uid, {"clinicId": clinic_id, "doctorId": doctor_id})
    print(f"✓ Claims set: clinicId={clinic_id}, doctorId={doctor_id} for uid={uid}")

    # Update Firestore doctor record with Firebase UID
    ref = db.collection("clinics").document(clinic_id).collection("doctors").document(doctor_id)
    doc = ref.get()
    if doc.exists:
        ref.update({"firebaseUid": uid})
        print(f"✓ Doctor record updated in Firestore: {doc.to_dict().get('name')}")
    else:
        print(f"⚠ Doctor {doctor_id} not found in Firestore — claims set but record not updated")


def link_staff(uid: str, clinic_id: str, staff_id: str):
    auth = get_auth()
    db = get_db()

    auth.set_custom_user_claims(uid, {"clinicId": clinic_id, "staffId": staff_id})
    print(f"✓ Claims set: clinicId={clinic_id}, staffId={staff_id} for uid={uid}")

    ref = db.collection("clinics").document(clinic_id).collection("staff").document(staff_id)
    doc = ref.get()
    if doc.exists:
        ref.update({"firebaseUid": uid})
        print(f"✓ Staff record updated in Firestore: {doc.to_dict().get('name')}")
    else:
        print(f"⚠ Staff {staff_id} not found in Firestore — claims set but record not updated")


def resolve_uid(email: str) -> str:
    auth = get_auth()
    user = auth.get_user_by_email(email)
    print(f"✓ Resolved UID for {email}: {user.uid}")
    return user.uid


def list_doctors(clinic_id: str):
    db = get_db()
    docs = list(db.collection("clinics").document(clinic_id).collection("doctors").stream())
    print(f"\nDoctors in clinic {clinic_id}:")
    for d in docs:
        data = d.to_dict()
        linked = "✓ linked" if data.get("firebaseUid") else "✗ no login"
        print(f"  {data.get('id')}  {data.get('name')} <{data.get('email')}>  [{linked}]")

    docs = list(db.collection("clinics").document(clinic_id).collection("staff").stream())
    print(f"\nStaff in clinic {clinic_id}:")
    for d in docs:
        data = d.to_dict()
        linked = "✓ linked" if data.get("firebaseUid") else "✗ no login"
        print(f"  {data.get('id')}  {data.get('name')} <{data.get('email')}>  [{linked}]")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Link Google user to clinic doctor/staff")
    parser.add_argument("--uid", help="Firebase UID of the Google user")
    parser.add_argument("--email", help="Email to look up UID automatically")
    parser.add_argument("--clinic", required=True, help="Clinic ID")
    parser.add_argument("--doctor", help="Doctor ID to link")
    parser.add_argument("--staff", help="Staff ID to link")
    parser.add_argument("--list", action="store_true", help="List all doctors/staff in clinic")
    args = parser.parse_args()

    if args.list:
        list_doctors(args.clinic)
        sys.exit(0)

    if not args.doctor and not args.staff:
        print("Error: provide --doctor or --staff")
        sys.exit(1)

    uid = args.uid
    if not uid:
        if not args.email:
            print("Error: provide --uid or --email")
            sys.exit(1)
        uid = resolve_uid(args.email)

    if args.doctor:
        link_doctor(uid, args.clinic, args.doctor)
    else:
        link_staff(uid, args.clinic, args.staff)

    print("\nDone. The user must sign out and sign back in for new claims to take effect.")
