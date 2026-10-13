import hashlib
import hmac
import secrets
import time

from backend.models import StaffSession, StaffUser

DEMO_PASSWORD = "DemoOnly!2026"


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return f"{salt}:{digest}"


def check_password(password, stored):
    return hmac.compare_digest(hash_password(password, stored.split(":")[0]), stored)


def seed_staff(db):
    for role in ("NURSE", "DOCTOR", "INTERN", "JR"):
        username = role.lower()
        if not db.get(StaffUser, username):
            db.add(
                StaffUser(
                    user_id=username,
                    display_name=f"Demo {role.title()}",
                    role=role,
                    password_hash=hash_password(DEMO_PASSWORD),
                )
            )


def session_token(db, user_id):
    raw = secrets.token_urlsafe(32)
    db.add(
        StaffSession(
            token_hash=hashlib.sha256(raw.encode()).hexdigest(),
            user_id=user_id,
            expires_at=time.time() + 8 * 3600,
        )
    )
    return raw
