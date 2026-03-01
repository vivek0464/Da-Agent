import os
import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth

_app = None
_db = None


def initialize_firebase():
    global _app, _db
    if _app is not None:
        return

    import logging
    _logger = logging.getLogger(__name__)

    try:
        service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
        if service_account_path and os.path.exists(service_account_path):
            cred = credentials.Certificate(service_account_path)
        else:
            cred = credentials.Certificate(
                {
                    "type": "service_account",
                    "project_id": os.getenv("FIREBASE_PROJECT_ID"),
                    "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID"),
                    "private_key": os.getenv("FIREBASE_PRIVATE_KEY", "").replace(
                        "\\n", "\n"
                    ),
                    "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
                    "client_id": os.getenv("FIREBASE_CLIENT_ID"),
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "client_x509_cert_url": (
                        "https://www.googleapis.com/robot/v1/metadata/x509/"
                        + os.getenv("FIREBASE_CLIENT_EMAIL", "").replace("@", "%40")
                    ),
                }
            )
        _app = firebase_admin.initialize_app(cred)
        _db = firestore.client()
        _logger.info("Firebase initialized successfully.")
    except Exception as e:
        _logger.warning(
            f"Firebase initialization failed — running without Firebase: {e}"
        )


def get_db():
    if _db is None:
        initialize_firebase()
    return _db


def get_auth():
    return firebase_auth
