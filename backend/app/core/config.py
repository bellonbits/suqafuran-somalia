from typing import List, Optional, Union, Any
from pydantic import AnyHttpUrl, EmailStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Suqafuran API"
    API_V1_STR: str = "/api/v1"
    # JWT AUTH
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 180 # 6 months
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    # Login sessions last until the user logs out (server-side revocable, see
    # UserSession); the JWT expiry is just a far-off backstop.
    SESSION_TOKEN_DAYS: int = 3650
    
    # OAUTH
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    
    # RESEND EMAIL
    RESEND_API_KEY: Optional[str] = None
    EMAIL_FROM: str = "no-reply@guri24.com"
    EMAIL_FROM_NAME: str = "Suqafuran"

    # BREVO EMAIL (marketing/promotional sends only -- see email_service.py's
    # _send_and_log preferred_provider param)
    BREVO_API_KEY: Optional[str] = None
    BREVO_FROM_EMAIL: str = "marketing@suqafuran.so"
    BREVO_FROM_NAME: str = "Suqafuran"

    # AFRICA'S TALKING (SMS notifications)
    AFRICASTALKING_USERNAME: str = "sandbox"
    AFRICASTALKING_API_KEY: str = ""
    AFRICASTALKING_SENDER_ID: str = "SUQAFURAN"

    # M-PESA DARAJA API (for STK push subscriptions)
    MPESA_CONSUMER_KEY: str = ""
    MPESA_CONSUMER_SECRET: str = ""
    MPESA_BUSINESS_SHORTCODE: str = ""
    MPESA_PASSKEY: str = ""

    # LIPANA M-PESA
    LIPANA_SECRET_KEY: str = ""
    LIPANA_WEBHOOK_SECRET: str = ""
    # Shared secret the mobile-money provider/forwarder must send in the
    # X-Webhook-Secret header to POST /mobile-money/webhook. Unset = webhook disabled.
    MOBILE_MONEY_WEBHOOK_SECRET: str = ""
    KES_CONVERSION_RATE: float = 130.0  # Used to convert USD to KES for Lipana
    
    # CLOUDINARY
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None
    
    # ENVIRONMENT
    ENVIRONMENT: str = "development"  # development, staging, production
    
    # OBSERVABILITY
    OTEL_EXPORTER_OTLP_ENDPOINT: Optional[str] = None # e.g., http://tempo:4317
    
    # DATABASE
    POSTGRES_SERVER: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_PORT: str = "5432"
    DATABASE_URL: Optional[str] = None

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Optional[str], info) -> str:
        if isinstance(v, str):
            return v
        return f"postgresql://{info.data.get('POSTGRES_USER')}:{info.data.get('POSTGRES_PASSWORD')}@{info.data.get('POSTGRES_SERVER')}:{info.data.get('POSTGRES_PORT')}/{info.data.get('POSTGRES_DB')}"

    # REDIS
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: Optional[str] = None
    REDIS_DB: int = 0
    REDIS_URL: Optional[str] = None

    @field_validator("REDIS_URL", mode="before")
    @classmethod
    def assemble_redis_url(cls, v: Optional[str], info) -> str:
        if isinstance(v, str):
            return v
        password = info.data.get('REDIS_PASSWORD')
        host = info.data.get('REDIS_HOST')
        port = info.data.get('REDIS_PORT')
        db = info.data.get('REDIS_DB')
        if password:
            return f"redis://:{password}@{host}:{port}/{db}"
        return f"redis://{host}:{port}/{db}"

    # KAFKA
    KAFKA_BOOTSTRAP_SERVERS: str = "kafka:29092"  # Kafka broker address (internal Docker network)
    KAFKA_SASL_USERNAME: Optional[str] = None
    KAFKA_SASL_PASSWORD: Optional[str] = None
    KAFKA_SECURITY_PROTOCOL: str = "PLAINTEXT"
    KAFKA_SASL_MECHANISM: str = "PLAIN"

    # Kafka Topics
    KAFKA_TOPIC_BUSINESS_EVENTS: str = "suqafuran-business-events"
    KAFKA_TOPIC_ORDERS: str = "suqafuran-orders"
    KAFKA_TOPIC_PAYMENTS: str = "suqafuran-payments"
    KAFKA_TOPIC_NOTIFICATIONS: str = "suqafuran-notifications"
    KAFKA_TOPIC_SIGNUP: str = "suqafuran-signup"
    KAFKA_TOPIC_SIGNIN: str = "suqafuran-signin"
    KAFKA_TOPIC_TRACKING: str = "suqafuran-tracking"
    KAFKA_TOPIC_CHECKOUT: str = "suqafuran-checkout"
    KAFKA_TOPIC_UPLOAD_FAILURES: str = "suqafuran-upload-failures"

    # EMAIL
    EMAILS_ENABLED: bool = True
    SMTP_TLS: bool = False
    SMTP_SSL: bool = True
    SMTP_PORT: int = 465
    SMTP_HOST: str = "mail.privateemail.com"
    SMTP_USER: str
    SMTP_PASSWORD: str
    EMAILS_FROM_EMAIL: EmailStr
    EMAILS_FROM_NAME: str = "Suqafuran"
    EMAIL_VERIFICATION_EXPIRE_HOURS: int = 24
    EMAIL_TEMPLATES_DIR: str = "app/email-templates"
    FRONTEND_URL: str = "https://suqafuran.so"
    BACKEND_URL: str = "https://app.suqafuran.so"

    # SECURITY
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000
    CORS_ORIGINS: Any = [
        "http://localhost:3000", "http://localhost:3002", "http://localhost:3004",
        "http://localhost:5173", "http://localhost", "https://localhost",
        "capacitor://localhost", "capacitor://app", "https://suqafuran.vercel.app",
        "https://app.suqafuran.so", "https://www.suqafuran.so", "https://suqafuran.so",
        "https://app.suqafuran.com", "https://www.suqafuran.com", "https://suqafuran.com",
        "http://143.198.30.249:8888", "http://143.198.30.249",
        "http://api.guri24.com:8888", "http://api.guri24.com",
        "http://165.22.13.173:3000", "http://165.22.13.173:8000", "http://165.22.13.173"
    ]
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        elif isinstance(v, str) and v.startswith("["):
            import json
            return json.loads(v)
        return v

    # FILE UPLOAD
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB (images)
    MAX_VIDEO_SIZE: int = 100 * 1024 * 1024  # 100MB (videos)
    ALLOWED_EXTENSIONS: Any = ["jpg", "jpeg", "png", "webp", "svg", "pdf", "gif"]
    ALLOWED_VIDEO_EXTENSIONS: Any = ["mp4", "webm", "mov", "avi", "mkv"]
    UPLOAD_DIR: str = "./uploads"

    # CLOUDINARY
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # GROQ (AI ASSISTANT)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "meta-llama/llama-4-scout-17b-16e-instruct"   # multimodal, best Somali translation
    GROQ_TRANSLATE_MODEL: str = "meta-llama/llama-4-scout-17b-16e-instruct"  # dedicated translation model

    @field_validator("ALLOWED_EXTENSIONS", mode="before")
    @classmethod
    def assemble_allowed_extensions(cls, v: Any) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        elif isinstance(v, str) and v.startswith("["):
            import json
            return json.loads(v)
        return v

    model_config = SettingsConfigDict(
        env_file=".env", case_sensitive=True, extra="ignore"
    )


settings = Settings()
