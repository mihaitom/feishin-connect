"""delivery/credentials.py — persistent AirPlay pairing credentials per device"""

import json
import logging
import os

logger = logging.getLogger("connect.credentials")

# credentials file lives in connect/ (parent of this delivery/ package)
_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "airplay_credentials.json",
)


def _load() -> dict[str, str]:
    try:
        with open(_PATH, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except Exception as e:
        logger.warning(f"[credentials] Load failed: {e}")
        return {}


def _save(data: dict[str, str]) -> None:
    try:
        with open(_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"[credentials] Save failed: {e}")


def get(device_name: str) -> str | None:
    return _load().get(device_name)


def save(device_name: str, credentials: str) -> None:
    data = _load()
    data[device_name] = credentials
    _save(data)
    logger.info(f"[credentials] Saved: {device_name}")


def delete(device_name: str) -> bool:
    data = _load()
    if device_name not in data:
        return False
    del data[device_name]
    _save(data)
    logger.info(f"[credentials] Deleted: {device_name}")
    return True


def list_paired() -> list[str]:
    return list(_load().keys())
