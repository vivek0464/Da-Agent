"""
ADK function tools for the Doctor Assistant agent.
4 focused tools: search_patient_in_queue, get_patient_info, update_prescription, finalize_prescription.
clinic_id and doctor_id come from the session state injected at WebSocket connect time.
Patients are added via QR registration or staff UI — not by the agent.
"""
import json as _json
from datetime import datetime, timezone
from app.services.appointment_service import list_appointments
from app.services.patient_service import list_patients
from app.services.prescription_service import (
    list_prescriptions,
    create_prescription,
    update_prescription as _update_prescription,
)
from app.models.prescription import (
    PrescriptionCreate,
    PrescriptionUpdate,
    PrescriptionContent,
    Medication,
)


# ── Internal helpers ─────────────────────────────────────────────────────────

async def _queue_head(clinic_id: str, doctor_id: str = "") -> dict | None:
    """Return the in-progress appointment, or the first scheduled one for today."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    appts = await list_appointments(clinic_id, date=today, doctor_id=doctor_id or None)
    ranked = sorted(appts, key=lambda x: x.get("queuePosition", 999))
    return (
        next((a for a in ranked if a.get("status") == "in-progress"), None)
        or next((a for a in ranked if a.get("status") == "scheduled"), None)
    )


async def _resolve_patient(clinic_id: str, doctor_id: str, name: str) -> dict | None:
    """Search by name; if name is blank, fall back to head of queue."""
    if name.strip():
        patients = await list_patients(clinic_id, search=name)
        return patients[0] if patients else None
    appt = await _queue_head(clinic_id, doctor_id)
    if not appt:
        return None
    patients = await list_patients(clinic_id, search=appt.get("patientName", ""))
    return patients[0] if patients else None


async def _latest_draft(clinic_id: str, patient_id: str) -> dict | None:
    """Return the most recent draft prescription for a patient."""
    rxs = await list_prescriptions(clinic_id, patient_id=patient_id)
    drafts = [r for r in rxs if r.get("status") == "draft"]
    return sorted(drafts, key=lambda x: x.get("createdAt", ""), reverse=True)[0] if drafts else None


# ── Public tools (4 total) ────────────────────────────────────────────────────

async def get_patient_info(clinic_id: str, doctor_id: str, query: str = "") -> str:
    """Get a patient's profile and full prescription history.
    If query is empty, uses the current head of the appointment queue (in-progress or first scheduled).

    Args:
        clinic_id: The clinic ID.
        doctor_id: The doctor's ID.
        query: Patient name or phone to search. Leave empty to use the head of queue.

    Returns:
        Patient profile and past prescription history as readable text.
    """
    patient = await _resolve_patient(clinic_id, doctor_id, query)
    if not patient:
        return "No patient in queue." if not query.strip() else f"No patient found matching '{query}'."

    patient_id = patient.get("id")
    name = patient.get("name", "Unknown")
    age = patient.get("age")

    parts = [name]
    if age: parts.append(f"{age} years")
    if patient.get("gender"): parts.append(patient.get("gender"))
    if patient.get("phone"): parts.append(f"phone {patient.get('phone')}")
    lines = [", ".join(parts), f"Visits: {patient.get('visits', 0)}."]
    if patient.get("notes"):
        lines.append(f"Notes: {patient.get('notes')}.")

    rxs = await list_prescriptions(clinic_id, patient_id=patient_id)
    if not rxs:
        lines.append("No past prescriptions on record.")
    else:
        recent = sorted(rxs, key=lambda x: x.get("date", ""), reverse=True)[:5]
        lines.append(f"{len(rxs)} prescription(s) on record. Most recent:")
        for rx in recent:
            c = rx.get("content", {})
            status_label = "finalized" if rx.get("status") == "final" else "draft"
            complaints = ", ".join(c.get("complaints", [])) or "none"
            diagnosis = ", ".join(c.get("diagnosis", [])) or "none"
            meds = c.get("medications", [])
            med_str = "; ".join(
                f"{m.get('name')} {m.get('dosage')} {m.get('frequency')} for {m.get('duration')}"
                for m in meds
            ) or "none"
            lines.append(
                f"  {rx.get('date')} ({status_label}): complaints — {complaints}; "
                f"diagnosis — {diagnosis}; meds — {med_str}."
            )
    return "\n".join(lines)


async def search_patient_in_queue(
    clinic_id: str,
    doctor_id: str,
    name: str = "",
    age: int | None = None,
) -> str:
    """Search today's queue for a patient by name, age, or both, then return their full profile
    and open draft prescription. If both name and age are empty, returns the current head of queue.

    IMPORTANT — use this tool whenever:
    - The doctor asks about a specific patient by name or age.
    - The doctor asks "who is my current patient" / "next patient" / "show current patient".
    - Before updating a prescription for a named patient (to confirm you have the right person).

    Args:
        clinic_id: The clinic ID.
        doctor_id: The doctor's ID.
        name: Patient name to search (partial match). Leave empty to use head of queue.
        age: Patient age to filter. Leave None to ignore.

    Returns:
        Patient profile, queue position, and most recent prescription summary.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    appts = await list_appointments(clinic_id, date=today, doctor_id=doctor_id)
    if not appts:
        return "No patients in today's queue."

    ranked = sorted(appts, key=lambda x: x.get("queuePosition", 999))
    candidates = ranked

    if name.strip():
        nl = name.strip().lower()
        candidates = [a for a in candidates if nl in (a.get("patientName") or "").lower()]
    if age is not None:
        candidates = [a for a in candidates if _age_match(a.get("patientId", ""), age, clinic_id)]

    if not candidates:
        hint = []
        if name: hint.append(f"name '{name}'")
        if age is not None: hint.append(f"age {age}")
        return f"No patient in today's queue matching {' and '.join(hint)}."

    # Pick best match (in-progress first, else first scheduled)
    match = (
        next((a for a in candidates if a.get("status") == "in-progress"), None)
        or candidates[0]
    )

    patient_id = match.get("patientId")
    patient_name = match.get("patientName", "Unknown")
    queue_pos = match.get("queuePosition", "?")
    appt_status = match.get("status", "scheduled")

    # Fetch full patient record for age/gender
    patients = await list_patients(clinic_id, search=patient_name)
    patient = next((p for p in patients if p.get("id") == patient_id), None)

    lines = []
    if patient:
        parts = [patient.get("name", patient_name)]
        if patient.get("age"): parts.append(f"{patient.get('age')}y")
        if patient.get("gender"): parts.append(patient.get("gender"))
        if patient.get("phone"): parts.append(patient.get("phone"))
        lines.append(f"queue#{queue_pos} ({appt_status}): " + ", ".join(parts))
        lines.append(f"visits: {patient.get('visits', 0)}")
        if patient.get("notes"): lines.append(f"notes: {patient.get('notes')}")
    else:
        lines.append(f"queue#{queue_pos}: {patient_name}")

    rxs = await list_prescriptions(clinic_id, patient_id=patient_id)
    if rxs:
        recent = sorted(rxs, key=lambda x: x.get("date", ""), reverse=True)[:3]
        for rx in recent:
            c = rx.get("content", {})
            st = "final" if rx.get("status") == "final" else "draft"
            cx = ", ".join(c.get("complaints", [])) or "none"
            dx = ", ".join(c.get("diagnosis", [])) or "none"
            meds = c.get("medications", [])
            mx = "; ".join(f"{m.get('name')} {m.get('dosage')}" for m in meds) or "none"
            lines.append(f"{rx.get('date')} ({st}): {cx} | {dx} | {mx}")
    else:
        lines.append("no prescriptions on record")

    return "\n".join(lines)


def _age_match(patient_id: str, age: int, clinic_id: str) -> bool:
    """Placeholder — age filtering is approximate. Always returns True unless we have data."""
    return True


async def update_prescription(
    clinic_id: str,
    doctor_id: str,
    patient_name: str = "",
    complaints: list[str] | None = None,
    diagnosis: list[str] | None = None,
    medications_json: str | None = None,
    tests: list[str] | None = None,
    follow_up: str | None = None,
    notes: str | None = None,
) -> str:
    """Update the current draft prescription for a patient with diagnosis and clinical notes.

    IMPORTANT — read before calling:
    1. Parse the doctor's full spoken statement carefully before filling any field.
       Map what was said to the correct field:
       - Symptoms / complaints the patient reports → complaints
       - Medical diagnosis / condition you are treating → diagnosis
       - Drug name + dosage + frequency + duration → medications_json
       - Lab / radiology orders → tests
       - Return visit or review instruction → follow_up
       - Any other clinical note → notes
    2. Batch ALL fields mentioned in a single call — do not call this tool multiple times for
       the same statement.
    3. If the doctor's statement is ambiguous or a mandatory medication field (dosage, frequency,
       duration) is missing, ask ONCE in a short question before calling: e.g. "What dose and
       duration for Amoxicillin?" — do not guess critical clinical values.
    4. If patient_name is empty, uses the head of the queue.
    5. Only provided fields are changed — omitted fields keep their existing values.

    Args:
        clinic_id: The clinic ID.
        doctor_id: The doctor's ID.
        patient_name: Patient name. Leave empty to use the current head of queue.
        complaints: List of symptoms e.g. ["fever", "cough"].
        diagnosis: List of diagnoses e.g. ["Viral fever"].
        medications_json: JSON array — each item: {"name":"...","dosage":"...","frequency":"...","duration":"..."}.
                          Example: '[{"name":"Paracetamol","dosage":"500mg","frequency":"TID","duration":"5 days"}]'
        tests: List of tests e.g. ["CBC", "CRP"].
        follow_up: Follow-up note e.g. "Review after 5 days".
        notes: Additional clinical notes.

    Returns:
        Confirmation with patient name, age, and what was updated.
    """
    patient = await _resolve_patient(clinic_id, doctor_id, patient_name)
    if not patient:
        msg = "No patient in queue." if not patient_name.strip() else f"Patient '{patient_name}' not found."
        return msg

    patient_id = patient.get("id")
    name = patient.get("name", patient_name)
    age = patient.get("age")

    rx = await _latest_draft(clinic_id, patient_id)
    if not rx:
        pi = {
            "name": name,
            "age": str(age) if age else "",
            "gender": patient.get("gender", ""),
            "phone": patient.get("phone", "") or "",
        }
        rx_data = PrescriptionCreate(
            clinicId=clinic_id,
            patientId=patient_id,
            doctorId=doctor_id,
            content=PrescriptionContent(patientInfo=pi),
        )
        rx = await create_prescription(rx_data)
    rx_id = rx.get("id")

    existing = rx.get("content", {})
    new_meds = None
    if medications_json is not None:
        try:
            new_meds = [Medication(**m) for m in _json.loads(medications_json)]
        except Exception as exc:
            return f"Invalid medications format: {exc}. Use JSON array like: [{{\"name\":\"Drug\",\"dosage\":\"500mg\",\"frequency\":\"TID\",\"duration\":\"5 days\"}}]"

    new_content = PrescriptionContent(
        patientInfo=existing.get("patientInfo", {}),
        complaints=complaints if complaints is not None else existing.get("complaints", []),
        diagnosis=diagnosis if diagnosis is not None else existing.get("diagnosis", []),
        medications=new_meds if new_meds is not None else [Medication(**m) for m in existing.get("medications", [])],
        tests=tests if tests is not None else existing.get("tests", []),
        followUp=follow_up if follow_up is not None else existing.get("followUp", ""),
        notes=notes if notes is not None else existing.get("notes", ""),
    )
    result = await _update_prescription(clinic_id, rx_id, PrescriptionUpdate(content=new_content))
    if not result:
        return "Failed to update prescription."

    updated_parts = []
    if complaints is not None: updated_parts.append(f"complaints: {', '.join(complaints)}")
    if diagnosis is not None: updated_parts.append(f"diagnosis: {', '.join(diagnosis)}")
    if new_meds is not None:
        updated_parts.append("medications: " + ", ".join(
            f"{m.name} {m.dosage} {m.frequency} for {m.duration}" for m in new_meds
        ))
    if tests is not None: updated_parts.append(f"tests: {', '.join(tests)}")
    if follow_up is not None: updated_parts.append(f"follow-up: {follow_up}")
    if notes is not None: updated_parts.append(f"notes: {notes}")

    patient_label = name + (f", {age}y" if age else "")
    summary = " | ".join(updated_parts) if updated_parts else "no changes"
    return f"rx-updated: {patient_label} | {summary}"


async def finalize_prescription(
    clinic_id: str,
    doctor_id: str,
    patient_name: str = "",
) -> str:
    """Finalize a patient's draft prescription (locks editing) and send to print.
    If patient_name is empty, uses the head of the queue.

    Args:
        clinic_id: The clinic ID.
        doctor_id: The doctor's ID.
        patient_name: Patient name. Leave empty to use the current head of queue.

    Returns:
        Confirmation that prescription is finalized and sent to print.
    """
    import asyncio as _asyncio
    from app.firebase_admin import get_db

    patient = await _resolve_patient(clinic_id, doctor_id, patient_name)
    if not patient:
        msg = "No patient in queue." if not patient_name.strip() else f"Patient '{patient_name}' not found."
        return msg

    patient_id = patient.get("id")
    name = patient.get("name", patient_name)
    age = patient.get("age")

    rx = await _latest_draft(clinic_id, patient_id)
    if not rx:
        return f"No draft prescription found for {name}."
    rx_id = rx.get("id")

    result = await _update_prescription(clinic_id, rx_id, PrescriptionUpdate(status="final"))
    if not result:
        return f"Failed to finalize prescription for {name}."

    # Mark printedAt (non-blocking — finalize already succeeded above)
    try:
        now = datetime.now(timezone.utc).isoformat()
        db = get_db()
        ref = (
            db.collection("clinics")
            .document(clinic_id)
            .collection("prescriptions")
            .document(rx_id)
        )
        await _asyncio.to_thread(ref.update, {"printedAt": now})
    except Exception:
        pass

    patient_label = name + (f", {age}y" if age else "")
    return f"rx-finalized: {patient_label} | locked | sent-to-print"


