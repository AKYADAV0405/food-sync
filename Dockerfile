FROM python:3.11-slim

# Install system dependencies (including tesseract-ocr for bill parser)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    libtesseract-dev \
    gcc \
    python3-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Set PYTHONPATH so python locates main module cleanly
ENV PYTHONPATH=/app


# Copy requirements and install
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application files
COPY backend/ .

# Expose port
EXPOSE 8000

# Start FastAPI application dynamically binding to Render's $PORT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
