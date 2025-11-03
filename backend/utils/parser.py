import pdfplumber
from docx import Document
import os

def extract_text(file_path: str) -> str:
    text = ""
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""
    elif ext == ".docx":
        doc = Document(file_path)
        text = "\n".join([p.text for p in doc.paragraphs])
    else:
        raise ValueError("Unsupported file format")
    return text.strip()
    