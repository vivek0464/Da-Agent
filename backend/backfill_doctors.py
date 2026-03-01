#!/usr/bin/env python3
"""
Backfill existing doctors for the new Google Sign-In auth flow.

For each doctor/staff in Firestore:
  - If they have an existing Firebase Auth account (email/password), delete it so they
    can sign in fresh with Google and get their claims via /api/auth/link.
  - Alternatively (--keep-accounts), just clear the firebaseUid field in Firestore so
    /api/auth/link can re-link them on their next Google sign-in.

Usage:
  python backfill_doctors.py --dry-run       # see what would happen
  python backfill_doctors.py --keep-accounts # only clear firebaseUid, don't delete Auth
  python backfill_doctors.py                 # delete old email/password Auth accounts
"""
import argparse
import sys
from dotenv import load_dotenv

load_dotenv()

from app.firebase_admin import initialize_firebase, get_auth, get_db
initialize_firebase()


def backfill(dry_run: bool, keep_accounts: bool):
    db = get_db()
    auth = get_auth()

    clinics = list(db.collection("clinics").stream())
    print(f"Found {len(clinics)} clinic(s)\n")

    total_doctors = 0
    total_staff = 0

    for clinic_doc in clinics:
        clinic_id = clinic_doc.id
        clinic_name = clinic_doc.to_dict().get("name", clinic_id)
        print(f"─ Clinic: {clinic_name} ({clinic_id})")

        # Doctors
        doctors = list(db.collection("clinics").document(clinic_id).collection("doctors").stream())
        for d in doctors:
            data = d.to_dict()
            email = data.get("email", "")
            name  = data.get("name", "?")
            uid   = data.get("firebaseUid")
            total_doctors += 1

            if uid:
                if keep_accounts:
                    print(f"  [doctor] {name} <{email}>  uid={uid}  → clear firebaseUid only")
                    if not dry_run:
                        d.reference.update({"firebaseUid": None})
                else:
                    print(f"  [doctor] {name} <{email}>  uid={uid}  → delete Firebase Auth account")
                    if not dry_run:
                        try:
                            auth.delete_user(uid)
                        except Exception as e:
                            print(f"    ⚠ Could not delete uid {uid}: {e}")
                        d.reference.update({"firebaseUid": None})
            else:
                print(f"  [doctor] {name} <{email}>  → no auth account (ready for Google sign-in)")

        # Staff
        staff = list(db.collection("clinics").document(clinic_id).collection("staff").stream())
        for s in staff:
            data = s.to_dict()
            email = data.get("email", "")
            name  = data.get("name", "?")
            uid   = data.get("firebaseUid")
            total_staff += 1

            if uid:
                if keep_accounts:
                    print(f"  [staff]  {name} <{email}>  uid={uid}  → clear firebaseUid only")
                    if not dry_run:
                        s.reference.update({"firebaseUid": None})
                else:
                    print(f"  [staff]  {name} <{email}>  uid={uid}  → delete Firebase Auth account")
                    if not dry_run:
                        try:
                            auth.delete_user(uid)
                        except Exception as e:
                            print(f"    ⚠ Could not delete uid {uid}: {e}")
                        s.reference.update({"firebaseUid": None})
            else:
                print(f"  [staff]  {name} <{email}>  → no auth account (ready for Google sign-in)")

        print()

    print(f"Total: {total_doctors} doctor(s), {total_staff} staff member(s)")
    if dry_run:
        print("\n[DRY RUN] No changes made. Re-run without --dry-run to apply.")
    else:
        print("\n✓ Done. Doctors can now sign in with Google → /api/auth/link will assign their claims.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--keep-accounts", action="store_true",
                        help="Don't delete Firebase Auth accounts; just clear firebaseUid so auto-link re-runs")
    args = parser.parse_args()
    backfill(dry_run=args.dry_run, keep_accounts=args.keep_accounts)
