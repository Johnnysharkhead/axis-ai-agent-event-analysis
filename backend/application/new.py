import requests
import json
import os
from sqlalchemy import or_, desc
from domain.models import db, FusionData

# Configuration
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://ollama:11434")
OLLAMA_URL = f"{OLLAMA_HOST}/api/generate"

MODEL_NAME = os.getenv("OLLAMA_MODEL_NAME", "phi4-mini")
MODEL_TEMPERATURE = float(os.getenv("OLLAMA_TEMPERATURE", "0.1"))
MODEL_TOP_K = int(os.getenv("OLLAMA_TOP_K", "3"))
MODEL_NUM_PREDICT = int(os.getenv("OLLAMA_NUM_PREDICT", "256"))


MODEL_OPTIONS = {
    "temperature": MODEL_TEMPERATURE,
    "top_k": MODEL_TOP_K,
    "num_predict": MODEL_NUM_PREDICT,
}


def get_latest_human_event():
    """
    Fetches the latest FusionData entry where class_type is Human or Face.
    Excludes raw_payload and observations to save tokens.
    """
    # Query: Select * FROM fusion_data WHERE class_type IN (...) ORDER BY event_timestamp DESC LIMIT 1
    event = FusionData.query.filter(
        or_(
            FusionData.class_type.ilike('Human'),
            FusionData.class_type.ilike('Person'), # Just in case Axis sends 'Person'
            FusionData.class_type.ilike('Face')
        )
    ).order_by(desc(FusionData.event_timestamp)).first()

    if not event:
        return None

    # Construct a clean dictionary (Excluding raw_payload and observations)
    clean_data = {
        "timestamp": event.event_timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        "camera": event.camera_serial,
        "object_type": event.class_type,
        "confidence": f"{float(event.confidence or 0) * 100:.1f}%",
        "clothing": {
            "upper": event.upper_clothing_colors,
            "lower": event.lower_clothing_colors
        },
        "location": {
            "lat": event.latitude,
            "lon": event.longitude
        }
        
    }
    return clean_data

def generate_security_summary():
    """
    Orchestrates the data fetch and the Insights generation.
    """
    # 1. Fetch Data
    event_data = get_latest_human_event()

    if not event_data:
        return {
            "status": "success", 
            "message": "Agent scanned the last session window and found no human activity requiring action."
        }

    # 2. Construct the Prompt for Ollama (Needs a lot of details and strict rules)
    prompt = f"""
    You are an autonomous Security Operations AI. Generate a technical log entry based ONLY on the input data below.

    INPUT DATA:
    {json.dumps(event_data)}

    STRICT OUTPUT RULES:
    1. Write exactly ONE paragraph (5-6 sentences).
    2. Do NOT use Markdown formatting (No asterisks **, no headers ##, no bullet points) just a message of texts.
    3. Do NOT use labels like "Timestamp:" or "Camera:". Just write the sentences.
    4. Do NOT hallucinate data. Only mention "Zone B" or "Camera 2" if it is in the input data.
    5. Give practical recommendations for the security team to investigate the event.
    6. Do not generate over 300 characters in total.
    7. If you don't have enough information to generate information, skip the event.
    

    STYLE:
    - Passive voice.
    - Technical vocabulary (Ingress, Visual signature, Nominal, Auto-dismissed).
    - Camera detected movement, not "saw" or "noticed".
    
    LOGIC:
    - Confidence < 50%: "Transient noise detected and auto-dismissed."
    - Confidence > 80%: "Positive identification confirmed. Visual signature matched [color] clothing."

"""
    #Example of desired output:
   # Example 1: "Positive identification confirmed on Camera B8A44F. Visual signature indicated gray upper clothing. Ingress parameters remained within nominal limits."
   # Example 2: "Transient noise detected on Camera 3C2D1E and auto-dismissed. No further action required."
   # Example 3: "Human activity detected on Camera 9F7E2B. Visual signature analysis indicated blue lower clothing. Ingress parameters were nominal."
    


    # 3. Call Ollama
    try:
        payload = {
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False,
            "options": MODEL_OPTIONS,
        }
        
        response = requests.post(OLLAMA_URL, json=payload, timeout=60)
        """
        if response.status_code == 200:
            ai_text = response.json().get('response', '')
            return {"status": "success", "message": ai_text.strip(), "data_source": event_data}
        else:
            return {"status": "error", "message": f"AI Service returned code {response.status_code}"}
        """
        if response.status_code == 200:
            ai_text = response.json().get('response', '').strip()
            
            # --- PYTHON CLEANUP (Safety Net) ---
            # Remove asterisks if the AI ignored rule #2
            ai_text = ai_text.replace('*', '').replace('#', '')
            # Remove "Technical System Log" title if it appears
            if "System Log" in ai_text:
                ai_text = ai_text.split('\n')[-1].strip()
            
            return {"status": "success", "message": ai_text, "data_source": event_data}
        else:
            return {"status": "error", "message": f"AI Service returned code {response.status_code}"}

    except requests.exceptions.ConnectionError:
        return {"status": "error", "message": "Could not connect to AI Agent. Is the container running?"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
