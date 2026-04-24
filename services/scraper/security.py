import base64
import json
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def get_app_encryption_key() -> bytes:
    raw = os.getenv("APP_ENCRYPTION_KEY")
    if not raw:
        raise RuntimeError("Missing APP_ENCRYPTION_KEY")

    key = base64.b64decode(raw)
    if len(key) != 32:
        raise RuntimeError("APP_ENCRYPTION_KEY must be a base64-encoded 32-byte key")

    return key


def decrypt_session_payload(payload_text: str) -> dict:
    parsed = json.loads(payload_text)
    if parsed.get("alg") != "aes-256-gcm" or parsed.get("v") != 1:
        return parsed

    key = get_app_encryption_key()
    iv = base64.b64decode(parsed["iv"])
    tag = base64.b64decode(parsed["tag"])
    data = base64.b64decode(parsed["data"])

    plaintext = AESGCM(key).decrypt(iv, data + tag, None)
    return json.loads(plaintext.decode("utf-8"))
