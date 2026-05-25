import os
from pathlib import Path


def pytest_configure() -> None:
    store_path = Path.cwd() / ".pytest_store.json"
    store_path.unlink(missing_ok=True)
    os.environ["PROBEMATE_STORE_PATH"] = str(store_path)


def pytest_unconfigure() -> None:
    store_path = Path(os.environ.get("PROBEMATE_STORE_PATH", ""))
    if store_path.name == ".pytest_store.json":
        store_path.unlink(missing_ok=True)
