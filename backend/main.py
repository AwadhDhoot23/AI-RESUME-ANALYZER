from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import fitz  # PyMuPDF
import os
import re

# ---------- CONFIG ----------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- DATABASE ----------
DATABASE_URL = "sqlite:///./results.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class ResumeAnalysis(Base):
    __tablename__ = "resume_analysis"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    skill_match = Column(Float)
    missing_skills = Column(String)
    strengths = Column(String)
    weaknesses = Column(String)
    suggestions = Column(Text)


Base.metadata.create_all(bind=engine)

# ---------- HELPERS ----------
def extract_text_from_pdf(file_path):
    text = ""
    pdf = fitz.open(file_path)
    for page in pdf:
        text += page.get_text()
    pdf.close()
    return text


def analyze_resume_text(resume_text, job_description):
    """Hybrid keyword-based matching system."""
    resume_text = resume_text.lower()
    job_description = job_description.lower()

    jd_words = re.findall(r"\b[a-zA-Z]+\b", job_description)
    jd_words = [w for w in jd_words if len(w) > 2]

    known_skills = [
        "python", "java", "sql", "machine learning", "data analysis", "fastapi",
        "aws", "azure", "communication", "teamwork", "web development",
        "english", "french", "programming", "btech", "c", "c++", "leadership",
        "project management", "problem solving", "adaptability"
    ]

    # --- Hybrid logic ---
    required_skills = [s for s in known_skills if any(w in s for w in jd_words)]

    # if JD is too short or too vague, use fallback
    if len(required_skills) < 3:
        required_skills = [s for s in known_skills if s in job_description]
        if len(required_skills) < 3:
            required_skills = ["communication", "teamwork", "problem solving", "python", "java"]

    # --- Detect matches ---
    found_skills = [s for s in required_skills if s in resume_text]
    missing_skills = [s for s in required_skills if s not in resume_text]

    skill_match = round((len(found_skills) / len(required_skills)) * 100, 2) if required_skills else 0.0

    # Handle very short resumes
    if not found_skills and len(resume_text.split()) < 50:
        missing_skills = ["Add more project and experience details."]
        skill_match = 0.0

    return skill_match, found_skills, missing_skills


def generate_feedback(skill_match, found_skills, missing_skills):
    """Generalized resume improvement feedback."""
    strengths = found_skills[:5] if found_skills else ["Basic resume relevance"]

    if skill_match < 40:
        weaknesses = ["Low alignment — add more relevant skills and experiences."]
    elif skill_match < 70:
        weaknesses = ["Moderate alignment — strengthen with detailed projects and tools."]
    else:
        weaknesses = ["Good alignment — add measurable results or leadership examples."]

    suggestions = [
        "Add clear measurable achievements (e.g., 'Reduced runtime by 20%').",
        "Include recent internships, certifications, or technical training.",
        "Highlight teamwork or project contributions effectively.",
        "Customize the summary section to match the job role.",
        "Keep formatting clean and easy to scan."
    ]

    return {
        "strengths": strengths,
        "weaknesses": weaknesses,
        "suggestions": suggestions
    }


# ---------- ROUTES ----------
@app.get("/")
def root():
    return {"message": "Resume Analyzer API running"}


@app.post("/analyze_resume/")
async def analyze_resume(file: UploadFile = File(...), job_description: str = Form(...)):
    file_path = f"temp_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(await file.read())

    resume_text = extract_text_from_pdf(file_path)
    os.remove(file_path)

    skill_match, found_skills, missing_skills = analyze_resume_text(resume_text, job_description)
    feedback = generate_feedback(skill_match, found_skills, missing_skills)

    db = SessionLocal()
    entry = ResumeAnalysis(
        filename=file.filename,
        skill_match=skill_match,
        missing_skills=", ".join(missing_skills),
        strengths=", ".join(feedback["strengths"]),
        weaknesses=", ".join(feedback["weaknesses"]),
        suggestions="\n".join(feedback["suggestions"]),
    )
    db.add(entry)
    db.commit()
    db.close()

    return {
        "skill_match": skill_match,
        "missing_skills": missing_skills or [],
        "strengths": feedback.get("strengths", []),
        "weaknesses": feedback.get("weaknesses", []),
        "suggestions": feedback.get("suggestions", []),
    }


@app.get("/history")
def get_history():
    db = SessionLocal()
    data = db.query(ResumeAnalysis).all()
    db.close()
    return [
        {
            "filename": d.filename,
            "skill_match": d.skill_match,
            "missing_skills": d.missing_skills.split(", ") if d.missing_skills else [],
            "strengths": d.strengths.split(", ") if d.strengths else [],
            "weaknesses": d.weaknesses.split(", ") if d.weaknesses else [],
            "suggestions": d.suggestions.split("\n") if d.suggestions else [],
        }
        for d in data
    ]
