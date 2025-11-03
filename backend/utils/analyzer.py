# utils/analyzer.py
import os, json, re
from groq import Groq
from typing import Dict, Any

# No need for local config, client is passed from main.py
# MODEL is still used but now defined in main.py

# --- helper functions unchanged ---
def extract_languages(text: str):
    langs = re.findall(r'\b(English|Hindi|French|Spanish|German|Chinese|Tamil|Telugu|Arabic|Japanese)\b', text, re.I)
    return list(sorted(set(l.title() for l in langs)))

def extract_skills(text: str):
    lines = re.findall(r'[A-Za-z+#]+', text)
    return list(sorted(set(l.title() for l in lines if len(l) > 2)))

# --- analyzer ---
# Added client: Groq and model: str to signature
def analyze_resume(resume_text: str, job_description: str, client: Groq, model: str) -> Dict[str, Any]:
    resume_langs = extract_languages(resume_text)
    jd_langs = extract_languages(job_description)
    resume_skills = extract_skills(resume_text)
    jd_skills = extract_skills(job_description)

    # utils/analyzer.py (inside analyze_resume function)

    prompt = f"""
You are an expert HR evaluator performing a highly structured resume-to-job-description analysis.

Your output **MUST** be **ONLY** a valid JSON object.

The **STRICT JSON SCHEMA** is:
{{
  "skill_match_pct": integer,
  "summary": string,
  "strengths": [string],
  "missing_skills": [string],
  "weaknesses": [string],
  "suggestions": [string]
}}

### INPUT DATA:
RESUME TEXT:
{resume_text[:6000]}

JOB DESCRIPTION:
{job_description[:3000]}

### RULES FOR SCORING AND ANALYSIS:
1. **SCORING (skill_match_pct):** Compute the score as **(Total Matched Items / Total Required Items in JD) * 100**. Do NOT give random scores.
2. **SKILL DEFINITION:** A "skill" is defined as a technology, tool, domain, or spoken language.
3. **GENERAL TERMS:** **Do NOT** count general filler words, verbs, or meta-adjectives (e.g., 'good', 'excellent', 'communication', 'should know', 'basic', 'strong', 'experience') as matching skills.
4. **LANGUAGES & KEYWORDS:** Treat all spoken languages (English, Hindi, French, etc.) and technical terms (Python, Node.js, BTech) as skills for matching.
5. **WEAKNESSES/SUGGESTIONS:** You must include at least one weakness and one suggestion, even if the resume is strong.
6. **SUMMARY:** Keep the summary analytical, clear, and under 120 words.
7. DO NOT count adjectives like (a, an, the, or , of , on, etc.) as skills.
8. You should be consistent with your answer and it should be fully accurate and according to what is given in resume and job description.
"""
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are an expert HR evaluator. Your output must be ONLY a valid JSON object."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1, # Keep it low for structured output
            response_format={"type": "json_object"} # Groq feature for JSON
        )
        
        text = response.choices[0].message.content.strip()

        # Try to parse the text, accommodating for code blocks
        if text.startswith("```json"):
            text = text.replace("```json", "").replace("```", "").strip()
        
        result = json.loads(text)

        # Failsafes (unchanged)
        if not result.get("weaknesses"):
            result["weaknesses"] = ["Needs more practical implementation experience"]
        if not result.get("suggestions"):
            result["suggestions"] = ["Include measurable results and technical projects"]
        if "skill_match_pct" not in result:
            result["skill_match_pct"] = 50

        return result

    except json.JSONDecodeError:
        return {"error": "JSON parse failed", "raw": text}
    except Exception as e:
        # Groq client will raise APIError if key is wrong, this catches it
        return {"error": str(e)}

# quick test is now disabled as it requires the client object