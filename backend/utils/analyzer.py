import os, json
import google.genai as genai

# Get API key from environment
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("Missing Google API key. Set GOOGLE_API_KEY in environment.")

# Initialize Gemini client
client = genai.Client(api_key=api_key)
MODEL = "gemini-2.0-flash"

def match_resume(resume_text, job_description):
    prompt = f"""
    Compare this resume and job description.
    Return JSON with:
      - skill_match_pct (0–100)
      - missing_skills
      - strengths
      - weaknesses
      - suggestions
    Resume: {resume_text}
    Job Description: {job_description}
    """
    response = client.models.generate_content(model=MODEL, contents=prompt)
    text = getattr(response, "text", None) or ""
    try:
        return json.loads(text)
    except Exception:
        return {"analysis_text": text}
