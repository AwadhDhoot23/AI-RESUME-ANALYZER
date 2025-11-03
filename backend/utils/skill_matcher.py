# utils/skill_matcher.py
import urllib.parse

# --- MOCKED GOOGLE SEARCH RESPONSE STRUCTURE ---
# In a real environment, this function would call a grounded LLM
# or a custom search API (like the one you enabled) to fetch real results.
def _search_for_resources(skill: str):
    """Mocks fetching links from specific providers."""
    # This structure simulates finding the best link for each source
    resources = {}
    
    # 1. YouTube (Default/Tutorial focus)
    query_yt = f"{skill} full course tutorial"
    link_yt = f"https://www.youtube.com/results?search_query={urllib.parse.quote(query_yt)}"
    resources["YouTube"] = link_yt

    # 2. Coursera (Certification/Formal focus)
    query_crs = f"{skill} specialization Coursera"
    link_crs = f"https://www.coursera.org/search?query={urllib.parse.quote(query_crs)}"
    resources["Coursera"] = link_crs
    
    # 3. Udemy (Hands-on/Practical focus)
    query_udm = f"{skill} masterclass Udemy"
    link_udm = f"https://www.udemy.com/courses/search/?q={urllib.parse.quote(query_udm)}"
    resources["Udemy"] = link_udm
    
    return resources

# --- RESOURCE ANALYSIS CORE FUNCTION ---
def analyze_skill_gap(ai_result):
    """
    Normalize missing_skills and produce targeted learning links per missing skill.
    Accepts ai_result (dict) which may contain 'missing_skills' as list or string.
    Returns dict:
      - missing_skills: list[str]
      - learning_resources: dict[str, dict[str, str]] 
        (e.g., {'Python': {'YouTube': 'link1', 'Coursera': 'link2', 'Udemy': 'link3'}})
    """
    missing = ai_result.get("missing_skills", []) or []
    # Normalize to list
    if isinstance(missing, str):
        if "\n" in missing:
            missing = [s.strip() for s in missing.split("\n") if s.strip()]
        else:
            missing = [s.strip() for s in missing.split(",") if s.strip()]
    elif not isinstance(missing, list):
        # fallback
        missing = list(missing) if missing else []

    cleaned = []
    for s in missing:
        if not s:
            continue
        # Filter out obvious garbage words (very short or non-alphabetic tokens)
        if len(s) <= 2:
            continue
        cleaned.append(s)

    learning_resources = {}
    for skill in cleaned:
        # Generate resource links for each cleaned missing skill
        learning_resources[skill] = _search_for_resources(skill)

    return {
        "missing_skills": cleaned,
        "learning_resources": learning_resources,
    }
