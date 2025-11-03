# utils/summary.py
import os
from groq import Groq
from typing import Dict, Any

# No need for local config, client is passed from main.py

# Added client: Groq and model: str to signature
def generate_summary(resume_text: str, client: Groq, model: str) -> str:
    """Generate a professional resume summary using Groq Llama 3.1."""
    
    if not client:
        return "Error generating summary: Groq client failed to initialize."

    try:
        prompt_content = (
            "You are an expert recruiter. Read the following resume and write a concise 6-line paragraph "
            "summarizing the candidate’s key strengths, technical skills, education, and focus area. "
            "No bullet points, only professional paragraph form.\n\n"
            f"Resume:\n{resume_text[:6000]}"
        )
        
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are an expert recruiter. Your output must be a single, concise paragraph with no conversational filler."},
                {"role": "user", "content": prompt_content},
            ],
            temperature=0.8,
        )
        
        summary = response.choices[0].message.content.strip()
        summary = summary.replace("*", "").replace("•", "").replace("**", "").strip()
        return summary
    except Exception as e:
        return f"Error generating summary: {str(e)}"