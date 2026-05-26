import base64
import hashlib
import hmac
import os
import time

from fastapi import Header, HTTPException

from app.schemas.models import AuthSession


TOKEN_TTL_SECONDS = 12 * 60 * 60


def auth_required() -> bool:
    return bool(os.getenv("TEACHER_ACCESS_CODE") or os.getenv("RESEARCH_ACCESS_CODE"))


def expected_code(role: str) -> str | None:
    if role == "teacher":
        return os.getenv("TEACHER_ACCESS_CODE")
    if role == "researcher":
        return os.getenv("RESEARCH_ACCESS_CODE")
    return None


def auth_secret() -> str:
    return os.getenv("AUTH_SECRET") or os.getenv("TEACHER_ACCESS_CODE") or "probemate-local-dev"


def sign_token_payload(payload: str) -> str:
    digest = hmac.new(auth_secret().encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def create_auth_session(role: str, access_code: str) -> AuthSession:
    configured_code = expected_code(role)
    if auth_required() and (not configured_code or not hmac.compare_digest(access_code, configured_code)):
        raise HTTPException(status_code=401, detail="Invalid access code")
    issued_at = int(time.time())
    payload = f"{role}.{issued_at}"
    return AuthSession(
        role=role,
        access_token=f"{payload}.{sign_token_payload(payload)}",
        auth_required=auth_required(),
    )


def validate_token(token: str) -> str:
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=401, detail="Invalid auth token")
    role, issued_at_text, signature = parts
    payload = f"{role}.{issued_at_text}"
    if not hmac.compare_digest(signature, sign_token_payload(payload)):
        raise HTTPException(status_code=401, detail="Invalid auth token")
    try:
        issued_at = int(issued_at_text)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid auth token") from exc
    if int(time.time()) - issued_at > TOKEN_TTL_SECONDS:
        raise HTTPException(status_code=401, detail="Expired auth token")
    return role


def require_roles(*allowed_roles: str):
    def dependency(authorization: str | None = Header(default=None)) -> str:
        if not auth_required():
            return "local_dev"
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(status_code=401, detail="Authentication required")
        role = validate_token(authorization[7:].strip())
        if role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient role")
        return role

    return dependency
