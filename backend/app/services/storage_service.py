import asyncio
import io
import os
import uuid
from app.core.config import settings

MAX_WIDTH = 1200
MAX_HEIGHT = 1200
JPEG_QUALITY = 82


def _resize_to_bytes(file_content: bytes) -> bytes:
    """Resize image server-side before Cloudinary upload."""
    try:
        from PIL import Image, ImageOps
        img = Image.open(io.BytesIO(file_content))
        img = ImageOps.exif_transpose(img)
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")
        img.thumbnail((MAX_WIDTH, MAX_HEIGHT), Image.BILINEAR)  # BILINEAR is 3x faster than LANCZOS
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=False)  # optimize=False is faster
        return buf.getvalue()
    except Exception:
        return file_content


def calculate_phash(file_content: bytes) -> str:
    try:
        from PIL import Image
        import imagehash
        img = Image.open(io.BytesIO(file_content))
        return str(imagehash.phash(img))
    except Exception:
        return ""


def _cloudinary_upload_sync(resized: bytes, public_id: str, resource_type: str,
                             upload_format, transformation) -> dict:
    """Synchronous Cloudinary upload — run via asyncio.to_thread to avoid blocking the event loop."""
    import cloudinary.uploader
    kwargs = {"public_id": public_id, "overwrite": True, "resource_type": resource_type}
    if upload_format:
        kwargs["format"] = upload_format
    if transformation:
        kwargs["transformation"] = transformation
    return cloudinary.uploader.upload(resized, **kwargs)


class CloudinaryStorage:
    def __init__(self):
        import cloudinary
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )

    async def upload_file(self, file_content: bytes, filename: str, high_quality: bool = False) -> tuple[str, str]:
        filename = filename or ""
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        is_video = ext in ["mp4", "mov", "avi", "3gp", "webm", "mpeg", "mkv"]
        is_pdf = ext == "pdf"
        is_gif = ext == "gif"

        if is_gif or (high_quality and not is_video and not is_pdf):
            # Skip the PIL resize/re-encode path entirely — Image.save() without
            # save_all=True collapses an animated GIF to its first frame. Upload
            # the original bytes untouched so Cloudinary preserves the animation.
            # Marketing creatives (high_quality=True) skip it too, so banner
            # text/logos stay crisp instead of getting capped at 1200px + auto
            # compression meant for regular listing photos.
            resized = file_content
            phash_task = asyncio.create_task(asyncio.to_thread(calculate_phash, file_content))
            resource_type = "image"
            upload_format = None
            transformation = None
        elif not is_video and not is_pdf:
            # Skip resize for fast uploads — let Cloudinary handle transformations
            resized = file_content
            # phash runs in background after we return — don't block the response
            phash_task = asyncio.create_task(asyncio.to_thread(calculate_phash, file_content))
            resource_type = "image"
            upload_format = None
            transformation = [{"quality": "auto", "fetch_format": "auto", "width": 1200, "crop": "scale"}]
        elif is_pdf:
            resized = file_content
            phash_task = None
            resource_type = "raw"
            upload_format = None
            transformation = None
        else:
            resized = file_content
            phash_task = None
            resource_type = "video"
            upload_format = None
            transformation = None

        public_id = f"suqafuran/{uuid.uuid4().hex}"

        # Run Cloudinary upload in thread pool — it's a blocking HTTP call
        result = await asyncio.to_thread(
            _cloudinary_upload_sync,
            resized, public_id, resource_type, upload_format, transformation
        )

        # Collect phash if it finished, else empty string (listing still saves fine)
        phash = ""
        if phash_task is not None:
            try:
                phash = await asyncio.wait_for(phash_task, timeout=0.5)
            except (asyncio.TimeoutError, Exception):
                phash = ""

        return result["secure_url"], phash


class LocalStorage:
    def __init__(self):
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    async def upload_file(self, file_content: bytes, filename: str, high_quality: bool = False) -> tuple[str, str]:
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"

        if ext == "gif" or high_quality:
            # Write the original bytes untouched — re-encoding through PIL
            # without save_all=True would collapse the animation to one frame,
            # and high_quality uploads (marketing creatives) shouldn't get
            # downscaled/recompressed either.
            unique_name = f"{uuid.uuid4()}.{ext}"
            dest = os.path.join(settings.UPLOAD_DIR, unique_name)
            with open(dest, "wb") as f:
                f.write(file_content)
        else:
            unique_name = f"{uuid.uuid4()}.webp"
            dest = os.path.join(settings.UPLOAD_DIR, unique_name)
            try:
                from PIL import Image, ImageOps
                img = Image.open(io.BytesIO(file_content))
                img = ImageOps.exif_transpose(img)
                if img.mode in ("RGBA", "P", "LA"):
                    img = img.convert("RGB")
                img.thumbnail((MAX_WIDTH, MAX_HEIGHT), Image.BILINEAR)
                img.save(dest, format="WEBP", quality=JPEG_QUALITY, method=0)  # method=0 is fastest
            except Exception:
                unique_name = f"{uuid.uuid4()}.{ext}"
                dest = os.path.join(settings.UPLOAD_DIR, unique_name)
                with open(dest, "wb") as f:
                    f.write(file_content)

        phash = await asyncio.to_thread(calculate_phash, file_content)
        return f"/api/v1/listings/images/{unique_name}", phash


if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET:
    storage_service = CloudinaryStorage()
else:
    storage_service = LocalStorage()
