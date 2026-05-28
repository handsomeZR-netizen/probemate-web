import os

from app.schemas.models import AppMode


try:
    _app_mode = AppMode(os.getenv("PROBEMATE_MODE", AppMode.DEMO.value).strip().lower() or AppMode.DEMO.value)
except ValueError:
    _app_mode = AppMode.DEMO


def get_app_mode() -> AppMode:
    return _app_mode


def set_app_mode(mode: AppMode) -> AppMode:
    global _app_mode
    _app_mode = mode
    return _app_mode
