"""
One-time script: grants platform_admin custom claim to a Firebase user.
Run: python set_admin.py <user_uid>
"""
import sys
import asyncio
from dotenv import load_dotenv

load_dotenv()

from app.firebase_admin import initialize_firebase, get_auth

initialize_firebase()


def set_platform_admin(uid: str):
    get_auth().set_custom_user_claims(uid, {"platform_admin": True})
    user = get_auth().get_user(uid)
    print(f"✅ platform_admin=True set on: {user.email} ({uid})")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python set_admin.py <user_uid>")
        print("\nFind your UID at: Firebase Console → Authentication → Users")
        sys.exit(1)
    set_platform_admin(sys.argv[1])
