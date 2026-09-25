from fastapi import APIRouter, File, UploadFile, Form
from app.services.ai_service import ai_service
import base64
import io
from PIL import Image

router = APIRouter()

def compress_image(image_bytes: bytes, max_dimension=1024, quality=70) -> bytes:
    try:
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != "RGB":
            img = img.convert("RGB")
        # Resize if larger than max_dimension
        img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
        out_io = io.BytesIO()
        img.save(out_io, format="JPEG", quality=quality)
        return out_io.getvalue()
    except Exception:
        return image_bytes

@router.post("/check-match")
async def check_match(
    selfie_file: UploadFile = File(...),
    document_file: UploadFile = File(...),
    id_number: str = Form(None)
):
    selfie_content = await selfie_file.read()
    document_content = await document_file.read()
    
    selfie_compressed = compress_image(selfie_content)
    document_compressed = compress_image(document_content)
    
    selfie_b64 = base64.b64encode(selfie_compressed).decode("utf-8")
    doc_b64 = base64.b64encode(document_compressed).decode("utf-8")
    
    score, is_authentic, reason = ai_service.verify_identity(selfie_b64, doc_b64, id_number)
    
    return {
        "match_score": score,
        "is_authentic": is_authentic,
        "reason": reason
    }
