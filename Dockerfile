# Use official lightweight Python image
FROM python:3.11-slim

# Prevent Python from writing .pyc files and buffer outputs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install basic system build dependencies needed by PyTorch / Docling
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Cloud Run injects the $PORT environment variable (defaults to 8080)
ENV PORT=8080
EXPOSE 8080

# Start server using the injected $PORT
CMD exec uvicorn server:app --host 0.0.0.0 --port ${PORT}