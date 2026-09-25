import hashlib
import json
import logging
from typing import List

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory cache: hash(text+lang) -> translated string
_cache: dict[str, str] = {}


class TranslateRequest(BaseModel):
    texts: List[str]
    target: str = "so"   # "so" = Somali, "en" = English


class TranslateResponse(BaseModel):
    translations: List[str]


def _cache_key(text: str, target: str) -> str:
    return hashlib.md5(f"{target}:{text}".encode()).hexdigest()


@router.post("/translate", response_model=TranslateResponse)
def translate_texts(body: TranslateRequest):
    """Translate a batch of strings server-side using deep-translator.
    Results are cached in memory so repeated requests are instant.
    """
    if body.target == "en":
        # Already English — return as-is
        return TranslateResponse(translations=body.texts)

    results: List[str] = []
    to_translate: List[tuple[int, str]] = []   # (index, text)

    # Separate cached from uncached
    for i, text in enumerate(body.texts):
        if not text or not text.strip():
            results.append(text)
            continue
        key = _cache_key(text, body.target)
        if key in _cache:
            results.append(_cache[key])
        else:
            results.append("")          # placeholder
            to_translate.append((i, text))

    # Translate uncached texts in one batch where possible
    if to_translate:
        try:
            from deep_translator import GoogleTranslator
            translator = GoogleTranslator(source="en", target=body.target)
            for i, text in to_translate:
                try:
                    translated = translator.translate(text[:500])  # GT limit safety
                    key = _cache_key(text, body.target)
                    _cache[key] = translated or text
                    results[i] = _cache[key]
                except Exception as e:
                    logger.warning(f"Translation failed for text '{text[:40]}': {e}")
                    results[i] = text   # fallback to original
        except ImportError:
            logger.error("deep-translator not installed")
            return TranslateResponse(translations=body.texts)

    return TranslateResponse(translations=results)
