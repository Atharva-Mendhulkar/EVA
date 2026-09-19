# EVA Docling microservice (PRD Section 6.1)
import tempfile
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from docling.document_converter import DocumentConverter

app = FastAPI(title="EVA Docling Extraction Service")
converter = DocumentConverter()

@app.get("/health")
def health():
    return {"status": "ok", "service": "eva-docling"}

@app.post("/convert")
async def convert_document(file: UploadFile = File(...)):
    suffix = Path(file.filename or "doc.pdf").suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = Path(tmp.name)

    try:
        conv_res = converter.convert(tmp_path)
        markdown = conv_res.document.export_to_markdown()
        return {
            "filename": file.filename,
            "markdown": markdown,
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if tmp_path.exists():
            tmp_path.unlink()
