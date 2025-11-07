# main.py
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
# --- Removed SQLAlchemy imports ---
from datetime import datetime, timedelta, timezone 
import os
import uvicorn
from dotenv import load_dotenv
from collections import Counter
import json

# --- NEW FIREBASE ADMIN IMPORTS ---
import firebase_admin
from firebase_admin import credentials, firestore
# ------------------------------------

# --- CENTRALIZED GROQ API KEY SETUP ---
load_dotenv() # Load .env file immediately
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = "llama-3.1-8b-instant"

if not GROQ_API_KEY:
    raise ValueError("FATAL ERROR: GROQ_API_KEY is missing from .env or environment.")

from groq import Groq, GroqError
groq_client = Groq(api_key=GROQ_API_KEY) 
# --- END API SETUP ---

# --- UPDATED: FIREBASE ADMIN SDK SETUP (Filepath method) ---
fs_db = None
try:
    # We'll get the FILEPATH from an environment variable
    service_account_filepath = os.getenv("FIREBASE_SERVICE_ACCOUNT_FILE")
    
    if service_account_filepath and os.path.exists(service_account_filepath):
        cred = credentials.Certificate(service_account_filepath)
        firebase_admin.initialize_app(cred)
        fs_db = firestore.client()
        print("--- DEBUG: Firebase Admin SDK initialized successfully from file. ---")
    elif service_account_filepath:
        print(f"--- ERROR: FIREBASE_SERVICE_ACCOUNT_FILE path specified ('{service_account_filepath}'), but file not found. Caching disabled. ---")
    else:
        print("--- WARNING: FIREBASE_SERVICE_ACCOUNT_FILE not set in .env. Firestore caching will be disabled. ---")
except Exception as e:
    print(f"--- ERROR: Failed to initialize Firebase Admin from file: {e} ---")
# --- END FIREBASE ADMIN SETUP ---


# --- IMPORT UTILS ---
from utils.parser import extract_text 
from utils.analyzer import analyze_resume 
from utils.summary import generate_summary
from utils.skill_matcher import analyze_skill_gap
# --------------------

# ---------- CONFIG ----------
app = FastAPI()

# --- UPDATED CORS ---
# Read the client URL from an environment variable for deployment
CLIENT_URL = os.getenv("CLIENT_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[CLIENT_URL, "http://localhost:3000"], # Keep localhost for testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- END UPDATED CORS ---

# --- DELETED: SQLAlchemy Database Section ---

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

    # --- DELETED: SQLAlchemy database logic for history ---

    # We just return the raw analysis data.
    # The frontend (App.jsx) will save this to Firestore.
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

# --- DELETED: /history endpoint (it was reading from SQLite, which is not used) ---

# --- REWRITTEN: MARKET TRENDS ENDPOINT with FIRESTORE CACHING ---
@app.get("/market_trends")
def generate_market_trends():
    
    # 1. Check Firestore Cache
    if fs_db:
        try:
            cache_ref = fs_db.collection("app_cache").document("market_trends")
            cache_doc = cache_ref.get()
            
            if cache_doc.exists:
                cache_data = cache_doc.to_dict()
                cache_timestamp = cache_data.get("timestamp")
                
                # Compare cache timestamp (UTC) with current UTC time
                if cache_timestamp:
                    cache_age = datetime.now(timezone.utc) - cache_timestamp
                    if cache_age < timedelta(hours=24):
                        print("--- DEBUG: Returning Firestore cached global trends. ---")
                        return cache_data.get("data") # Return the stored dictionary
                        
        except Exception as e:
            print(f"--- WARNING: Firestore cache read failed: {e} ---")

    # 2. Cache is stale, empty, or Firestore is disabled. Generate new data.
    print("--- DEBUG: Cache stale or absent. Calling Groq API for new trends. ---")
    
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
        
        # 3. Save New Data to Firestore Cache
        if fs_db:
            try:
                payload = {
                    "timestamp": datetime.now(timezone.utc), # Store current UTC time
                    "data": formatted_trends_dict
                }
                cache_ref = fs_db.collection("app_cache").document("market_trends")
                cache_ref.set(payload)
                print("--- DEBUG: Successfully updated Firestore cache. ---")
            except Exception as e:
                print(f"--- WARNING: Firestore cache write failed: {e} ---")
        
        return formatted_trends_dict

    except GroqError as e:
        return {"error": f"Groq API Error: {str(e)}", "top_skills": []}
    except Exception as e:
        return {"error": f"Error generating market trends: {str(e)}", "top_skills": []}
# --- END REWRITTEN ENDPOINT ---

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
        # --- END REVISED PROMPT ---
        # Use Groq client for chat completion
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