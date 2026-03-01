import os
import logging
import httpx

logger = logging.getLogger(__name__)

MSG91_FLOW_URL = "https://api.msg91.com/api/v5/flow/"


async def send_appointment_confirmation(
    patient_phone: str,
    patient_name: str,
    date: str,
    time_slot: str,
    clinic_name: str,
    queue_position: int,
    estimated_time: str,
) -> bool:
    if os.getenv("SMS_ENABLED", "false").lower() != "true":
        logger.info("SMS disabled, skipping appointment confirmation")
        return False

    auth_key = os.getenv("MSG91_AUTH_KEY", "")
    template_id = os.getenv("MSG91_TEMPLATE_ID", "")
    if not auth_key or not template_id:
        logger.warning("MSG91 credentials not configured")
        return False

    phone = patient_phone.strip().replace(" ", "").replace("-", "")
    if phone.startswith("+"):
        phone = phone[1:]
    if not phone.startswith("91"):
        phone = f"91{phone}"

    payload = {
        "template_id": template_id,
        "short_url": "0",
        "recipients": [
            {
                "mobiles": phone,
                "name": patient_name,
                "date": date,
                "time": time_slot,
                "clinic": clinic_name,
                "queue": str(queue_position),
                "wait": estimated_time,
            }
        ],
    }
    headers = {
        "authkey": auth_key,
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(MSG91_FLOW_URL, json=payload, headers=headers)
            resp.raise_for_status()
            logger.info(f"SMS sent to {phone}: {resp.json()}")
            return True
    except Exception as exc:
        logger.error(f"SMS failed for {phone}: {exc}")
        return False
