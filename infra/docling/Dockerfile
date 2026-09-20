# EVA Docling document service (PRD Section 6.1) — ECS Fargate, 2 vCPU / 4 GB.
# RapidOCR (PaddleOCR PP-OCR on ONNX Runtime) rides inside Docling; standalone
# PaddleOCR is rejected per ADR-010. Models bake in at build time so tasks start warm.
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir "docling>=2.129.0" rapidocr_onnxruntime fastapi uvicorn

RUN python3 -c "from docling.document_converter import DocumentConverter; DocumentConverter()"

COPY docling_service.py /app/docling_service.py
WORKDIR /app
EXPOSE 8000
CMD ["uvicorn", "docling_service:app", "--host", "0.0.0.0", "--port", "8000"]
