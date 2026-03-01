"""Slot-based appointment scheduling: estimate datetime from queue position."""
import asyncio
from datetime import datetime, timedelta
from app.firebase_admin import get_db

MINS_PER_PATIENT = 5
MAX_OVERFLOW_HOURS = 2  # reject if overflow past last slot exceeds this


def _parse(date: str, time_str: str) -> datetime:
    return datetime.strptime(f"{date} {time_str}", "%Y-%m-%d %H:%M")


def _fmt(dt: datetime) -> str:
    """'9:05 AM' — strip leading zero."""
    return dt.strftime("%I:%M %p").lstrip("0")


def _fmt_slot(slot: dict) -> str:
    def ft(ts: str) -> str:
        return datetime.strptime(ts, "%H:%M").strftime("%I:%M %p").lstrip("0")
    return f"{ft(slot['start'])} – {ft(slot['end'])}"


async def get_slots_for_date(clinic_id: str, doctor_id: str, date: str) -> list[dict]:
    """Return sorted time slots for a doctor on a date, with recurring fallback."""
    db = get_db()

    # 1. Date-specific override
    doc_id = f"{doctor_id}_{date}"
    doc = await asyncio.to_thread(
        db.collection("clinics").document(clinic_id)
        .collection("availability").document(doc_id).get
    )
    if doc.exists:
        data = doc.to_dict()
        if not data.get("recurring"):
            slots = data.get("slots", [])
            return sorted(slots, key=lambda s: s["start"])

    # 2. Recurring for this day-of-week (Python weekday: 0=Mon … 6=Sun)
    dow = datetime.strptime(date, "%Y-%m-%d").weekday()
    rec_docs = await asyncio.to_thread(
        lambda: list(
            db.collection("clinics").document(clinic_id)
            .collection("availability")
            .where("doctorId", "==", doctor_id)
            .where("recurring", "==", True)
            .where("dayOfWeek", "==", dow)
            .stream()
        )
    )
    if rec_docs:
        return sorted(rec_docs[0].to_dict().get("slots", []), key=lambda s: s["start"])

    return []


def calculate_estimated_appointment(
    date: str,
    queue_pos: int,
    slots: list[dict],
    mins_per_patient: int = MINS_PER_PATIENT,
) -> dict:
    """
    Distribute queue_pos patients (mins_per_patient each) across ordered slots.

    Returns:
        estimated_time_str  : "11:30 AM"
        estimated_datetime  : ISO string
        slot_label          : "9:00 AM – 12:00 PM"
        alt_time_str        : "5:00 PM"  (set when <60 min left in slot AND next slot exists)
        alt_slot_label      : "5:00 PM – 8:00 PM"
        rejected            : bool
        rejection_reason    : str
        total_wait_mins     : int
        no_slots            : bool
    """
    total_wait = queue_pos * mins_per_patient
    base = dict(
        total_wait_mins=total_wait,
        rejected=False,
        rejection_reason="",
        no_slots=False,
        estimated_time_str=None,
        estimated_datetime=None,
        slot_label=None,
        alt_time_str=None,
        alt_slot_label=None,
    )

    if not slots:
        return {**base, "no_slots": True}

    remaining = total_wait

    for i, slot in enumerate(slots):
        s_start = _parse(date, slot["start"])
        s_end = _parse(date, slot["end"])
        capacity = int((s_end - s_start).total_seconds() / 60)

        if remaining <= capacity:
            est_dt = s_start + timedelta(minutes=remaining)
            mins_left = int((s_end - est_dt).total_seconds() / 60)
            next_slot = slots[i + 1] if i + 1 < len(slots) else None

            alt_time_str = alt_slot_label = None
            if mins_left < 60 and next_slot:
                ns_dt = _parse(date, next_slot["start"])
                alt_time_str = _fmt(ns_dt)
                alt_slot_label = _fmt_slot(next_slot)

            return {
                **base,
                "estimated_time_str": _fmt(est_dt),
                "estimated_datetime": est_dt.isoformat(),
                "slot_label": _fmt_slot(slot),
                "alt_time_str": alt_time_str,
                "alt_slot_label": alt_slot_label,
            }

        remaining -= capacity

    # Overflowed past all slots
    last_slot = slots[-1]
    last_end = _parse(date, last_slot["end"])
    overflow_mins = remaining  # minutes past the last slot end

    if overflow_mins > MAX_OVERFLOW_HOURS * 60:
        last_end_label = datetime.strptime(last_slot["end"], "%H:%M").strftime("%I:%M %p").lstrip("0")
        return {
            **base,
            "rejected": True,
            "rejection_reason": (
                f"Doctor's schedule is fully booked for {date}. "
                f"Last slot ends at {last_end_label}. Please visit on another day."
            ),
        }

    # Overflow within 2-hour grace — still register, note the overflow
    est_dt = last_end + timedelta(minutes=overflow_mins)
    return {
        **base,
        "estimated_time_str": _fmt(est_dt),
        "estimated_datetime": est_dt.isoformat(),
        "slot_label": _fmt_slot(last_slot),
        "overflow": True,
    }
