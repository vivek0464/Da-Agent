#!/usr/bin/env python3
from dotenv import load_dotenv
load_dotenv()
from app.firebase_admin import initialize_firebase, get_db
from datetime import date

initialize_firebase()
db = get_db()
today = date.today().isoformat()
print(f"Today: {today}")

clinics = list(db.collection("clinics").stream())
print(f"\nTotal clinics: {len(clinics)}")
for clinic in clinics:
    cdata = clinic.to_dict()
    print(f"\nClinic: {cdata.get('name')} (id={clinic.id})")
    doctors = list(db.collection("clinics").document(clinic.id).collection("doctors").stream())
    print(f"  Doctors: {len(doctors)}")
    for d in doctors:
        dd = d.to_dict()
        print(f"    - {dd.get('name')} ({dd.get('email')}) uid={dd.get('firebaseUid','none')} id={d.id}")
    appts = list(db.collection("clinics").document(clinic.id).collection("appointments").where("date", "==", today).stream())
    print(f"  Appointments today: {len(appts)}")
    for a in appts:
        ad = a.to_dict()
        print(f"    - #{ad.get('queuePosition')} {ad.get('patientName')} doctor={ad.get('doctorId')} status={ad.get('status')} paid={ad.get('paymentStatus','unpaid')}")
    patients = list(db.collection("clinics").document(clinic.id).collection("patients").stream())
    print(f"  Patients: {len(patients)}")
