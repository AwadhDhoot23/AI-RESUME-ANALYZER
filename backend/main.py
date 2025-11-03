# main.py
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base 
from datetime import datetime, timedelta
import os
import uvicorn
from dotenv import load_dotenv
from collections import Counter
import json

# --- CENTRALIZED GROQ API KEY SETUP ---
load_dotenv() # Load .env file immediately
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "llama-3.1-8b-instant" # Fastest, cheapest Groq model

if not GROQ_API_KEY:
    raise ValueError("FATAL ERROR: GROQ_API_KEY is missing from .env or environment.")

from groq import Groq, GroqError
# Instantiate the client globally
groq_client = Groq(api_key=GROQ_API_KEY) 
# --- END API SETUP ---

# --- IMPORT UTILS ---
from utils.parser import extract_text 
from utils.analyzer import analyze_resume 
from utils.summary import generate_summary
from utils.skill_matcher import analyze_skill_gap
# --------------------

# ---------- CONFIG ----------
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- DATABASE ----------
DATABASE_URL = "sqlite:///./results.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}) 
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

# --- NEW CACHE TABLE ---
class GlobalTrendsCache(Base):
    __tablename__ = "global_trends_cache"
    id = Column(Integer, primary_key=True, index=True)
    data_json = Column(Text) # Stores the JSON response from Groq
    timestamp = Column(DateTime, default=datetime.utcnow) # When the data was generated
# --- END NEW CACHE TABLE ---

Base.metadata.create_all(bind=engine)

# ---------- ROUTES ----------
@app.get("/")
def root():
    return {"message": "Resume Analyzer API (Groq Llama 3.1)"}

@app.post("/generate_summary/")
async def generate_summary_route(file: UploadFile = File(...)):
    file_path = f"temp_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(await file.read())
    
    resume_text = extract_text(file_path)
    os.remove(file_path)
    summary = generate_summary(resume_text, groq_client, GROQ_MODEL)
    return {"summary": summary}


@app.post("/analyze_resume/")
async def analyze_resume_route(file: UploadFile = File(...), job_description: str = Form(...)):
    file_path = f"temp_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(await file.read())

    try:
        resume_text = extract_text(file_path)
        print(f"--- DEBUG: Extracted Text Length: {len(resume_text)} ---")
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"File parsing error: {str(e)}")
    finally:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass

    try:
        ai_result = analyze_resume(resume_text, job_description, groq_client, GROQ_MODEL)
    except Exception as e:
        return {"error": f"Analyzer exception: {str(e)}"}

    if not isinstance(ai_result, dict):
        return {"error": "Analyzer returned unexpected type (expected dict)."}

    if "error" in ai_result:
        return {"error": ai_result["error"], "raw_ai": ai_result}

    summary = generate_summary(resume_text, groq_client, GROQ_MODEL)
    gap = analyze_skill_gap(ai_result)

    ai_result["summary"] = summary
    ai_result["missing_skills"] = gap.get("missing_skills", [])
    ai_result["learning_resources"] = gap.get("learning_resources", {})

    skill_match = ai_result.get("skill_match_pct") or ai_result.get("skill_match") or 0.0
    try:
        skill_match = float(skill_match)
    except Exception:
        skill_match = 0.0

    missing_skills_list = ai_result.get("missing_skills", []) or []
    strengths = ai_result.get("strengths", []) or []
    weaknesses = ai_result.get("weaknesses", []) or []
    suggestions = ai_result.get("suggestions", []) or []

    db = SessionLocal()
    try:
        entry = ResumeAnalysis(
            filename=file.filename,
            skill_match=skill_match,
            missing_skills=", ".join(missing_skills_list), 
            strengths=", ".join(strengths),
            weaknesses=", ".join(weaknesses),
            suggestions="\n".join(suggestions),
        )
        db.add(entry)
        db.commit()
    except Exception as e:
        db.rollback()
        print("DB write error:", e)
    finally:
        db.close()

    response = {
        "skill_match": skill_match,
        "missing_skills": missing_skills_list,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "suggestions": suggestions,
        "learning_resources": ai_result.get("learning_resources", {}),
        "summary": summary, 
        "resume_text": resume_text,
        "raw_ai": ai_result,
    }

    return response

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

# --- MODIFIED: MARKET TRENDS ENDPOINT with CACHING LOGIC ---
@app.get("/market_trends")
def generate_market_trends():
    db = SessionLocal()
    cache_entry = db.query(GlobalTrendsCache).order_by(GlobalTrendsCache.timestamp.desc()).first()
    
    # 1. Check Cache Freshness (24 hours)
    if cache_entry and cache_entry.timestamp > datetime.utcnow() - timedelta(hours=24):
        db.close()
        # Cache is fresh, return immediately (Saves API Call)
        print("--- DEBUG: Returning cached global trends. ---")
        return json.loads(cache_entry.data_json)

    # 2. Cache is stale or empty, generate new data using Groq
    print("--- DEBUG: Cache stale. Calling Groq API for new trends. ---")
    
    try:
        prompt_content = (
            "Act as a global tech hiring analyst. Provide a list of the Top 10 most in-demand "
            "technical and soft skills for software development and data science roles worldwide as of 2025. "
            "Your response MUST be ONLY a valid JSON array of strings, where each string is the skill name. "
            "Example: [\"Python\", \"React/Node.js\", \"Cloud Computing (AWS/Azure)\", \"Effective Communication\", ...]"
        )
        
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": "You are a global tech hiring analyst. Your output must be ONLY a valid JSON array of 10 items."},
                {"role": "user", "content": prompt_content},
            ],
            temperature=0.5,
            response_format={"type": "json_object"}
        )

        text = response.choices[0].message.content.strip()
        
        if text.startswith("```json"):
            text = text.replace("```json", "").replace("```", "").strip()
            
        try:
            data = json.loads(text)
            if isinstance(data, dict):
                top_skills_array = next((v for v in data.values() if isinstance(v, list)), [])
            else:
                top_skills_array = data
            
        except json.JSONDecodeError:
            top_skills_array = ["JSON Parsing Error"]
        
        # Format the final result structure
        formatted_trends_dict = {
            "top_skills": [
                {"skill": skill, "rank": i + 1} for i, skill in enumerate(top_skills_array) if skill
            ]
        }
        
        # 3. Save New Data to Cache (Overwrite/Update)
        if cache_entry:
            # Update existing entry
            cache_entry.data_json = json.dumps(formatted_trends_dict)
            cache_entry.timestamp = datetime.utcnow()
        else:
            # Create new entry
            new_entry = GlobalTrendsCache(
                data_json=json.dumps(formatted_trends_dict),
                timestamp=datetime.utcnow()
            )
            db.add(new_entry)
        
        db.commit()
        db.close()
        
        return formatted_trends_dict

    except GroqError as e:
        db.close()
        return {"error": f"Groq API Error: {str(e)}", "top_skills": []}
    except Exception as e:
        db.close()
        return {"error": f"Error generating market trends: {str(e)}", "top_skills": []}
# --- END CACHING LOGIC ---

@app.post("/optimize_resume/")
async def http_optimize_resume(
    resume_text: str = Form(...),
    job_description: str = Form(...),
    missing_skills: str = Form(...) 
):
    try:
        # --- REVISED PROMPT FOR GROQ ---
        prompt_content = f"""
        You are a highly skilled Resume Editor. Your goal is to improve the provided resume text
        to maximize its alignment with the JOB DESCRIPTION and address the MISSING SKILLS.

        Your output MUST be a single block of markdown text, ready to be pasted into a resume.
        DO NOT include any conversational filler, explanation, or notes.
        DO NOT change anything from name, give exact same as extracted


        ### Optimization Task:
        1. **Rewrite** the 'Experience', 'Projects', and/or 'Summary' sections of the RESUME.
        2. **Focus** on integrating terms from the JOB DESCRIPTION.
        3. **Demonstrate** how the candidate's experience covers the technical skills and addresses the {missing_skills} gap by re-phrasing existing bullet points.

        ### Optimization Rules:
        * **Do NOT** invent or fabricate any new experience, projects, or dates.
        * **MUST** use strong, quantifiable action verbs (e.g., "Led," "Developed," "Optimized").
        * **Output MUST** be in Markdown format, preserving original headings (e.g., ## Projects).

        --- INPUT DATA ---
        RESUME TEXT:
        {resume_text}

        JOB DESCRIPTION:
        {job_description}
        """
        # --- END REVISED PROMPT ---\r\n\r\n\r\n        # Use Groq client for chat completion
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                # System message is crucial for tone and output format
                {"role": "system", "content": "You are a professional Resume Editor. Output ONLY the rewritten resume sections in Markdown format."},
                {"role": "user", "content": prompt_content},
            ],
            temperature=0.4, # Lowered for more precise, less creative rewriting
        )

        # Clean the response just in case
        cleaned_text = response.choices[0].message.content.strip().replace("`markdown`", "").strip()
        
        return {"optimized_text": cleaned_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
# --- END OF NEW ENDPOINT ---

if __name__ == "__main__":
    print("Starting AI Resume Analyzer backend on [http://127.0.0.1:8000](http://127.0.0.1:8000)")
    uvicorn.run(app, host="127.0.0.1", port=8000)