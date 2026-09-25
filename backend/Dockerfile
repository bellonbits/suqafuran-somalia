FROM python:3.12-bookworm

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PREFER_IPV4=1

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=1000 --retries 10 -r requirements.txt

# Copy project files
COPY . .

# Create necessary directories
RUN mkdir -p uploads celerybeat

# Expose port
EXPOSE 8000

# Run the application
# --proxy-headers + --forwarded-allow-ips='*' makes uvicorn trust the
# X-Forwarded-Proto header nginx sends; without it, uvicorn assumes every
# request is plain HTTP (since nginx proxies to it over HTTP inside the
# docker network) and builds redirect Location headers as http://, which
# browsers refuse to follow during a CORS preflight. Safe here because the
# backend container has no published port — only nginx can reach it.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
