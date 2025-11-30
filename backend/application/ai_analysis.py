import requests
import json
import time  
import logging 
import os
from sqlalchemy import or_, desc
from datetime import date
from domain.models import db, FusionData, DailySummary

# Setup Logger to print to terminal
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AI_AGENT")

# Configuration
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://ollama:11434")
OLLAMA_URL = f"{OLLAMA_HOST}/api/generate"
MODEL_NAME = "phi4-mini"  # Ensure this matches the model pulled in the Dockerfile

def get_latest_human_event():
    """
    Fetches the latest FusionData entry where class_type is Human or Face.
    Excludes raw_payload and observations to save tokens.
    """
    # Query: Select * FROM fusion_data WHERE class_type IN (...) ORDER BY event_timestamp DESC LIMIT 1
    event = FusionData.query.filter(
        or_(
            FusionData.class_type.ilike('Human'),
            FusionData.class_type.ilike('Person'), 
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

    STYLE:
    - Passive voice.
    - Technical vocabulary (Ingress, Visual signature, Nominal, Auto-dismissed).
    - Camera detected movement, not "saw" or "noticed".
    
    LOGIC:
    - Confidence < 50%: "Transient noise detected and auto-dismissed."
    - Confidence > 80%: "Positive identification confirmed. Visual signature matched [color] clothing."

    Example of desired output:
    Example 1: "Positive identification confirmed on Camera B8A44F. Visual signature indicated gray upper clothing. Ingress parameters remained within nominal limits."
    Example 2: "Transient noise detected on Camera 3C2D1E and auto-dismissed. No further action required."
    Example 3: "Human activity detected on Camera 9F7E2B. Visual signature analysis indicated blue lower clothing. Ingress parameters were nominal."
    
"""

    # 3. Call Ollama
    try:
        payload = {
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False
        }
        # --- START TIMER ---
        start_time = time.time()
        logger.info(f"🚀 [AI] Sending request to {MODEL_NAME}...")


        response = requests.post(OLLAMA_URL, json=payload, timeout=60)

        # --- END TIMER ---
        end_time = time.time()
        duration = end_time - start_time

        """
        if response.status_code == 200:
            ai_text = response.json().get('response', '')
            return {"status": "success", "message": ai_text.strip(), "data_source": event_data}
        else:
            return {"status": "error", "message": f"AI Service returned code {response.status_code}"}
        """
        """
        if response.status_code == 200:
            ai_text = response.json().get('response', '').strip()
            # --- LOG THE RESULT ---
            logger.info(f"✅ [AI] Finished in {duration:.2f} seconds.")
            
            # --- PYTHON CLEANUP (Safety Net) ---
            # Remove asterisks if the AI ignored rule #2
            ai_text = ai_text.replace('*', '').replace('#', '')
            # Remove "Technical System Log" title if it appears
            if "System Log" in ai_text:
                ai_text = ai_text.split('\n')[-1].strip()
            
            return {"status": "success", "message": ai_text, "data_source": event_data}
        else:
            return {"status": "error", "message": f"AI Service returned code {response.status_code}"}
        """

        if response.status_code == 200:
            ai_text = response.json().get('response', '').strip()
            
            # --- LOG THE RESULT ---
            logger.info(f"✅ [AI] Finished in {duration:.2f} seconds.")
            
            # --- PYTHON CLEANUP (Safety Net) ---
            ai_text = ai_text.replace('*', '').replace('#', '').replace('"', '')
            if "System Log" in ai_text:
                ai_text = ai_text.split('\n')[-1].strip()
            
            # 1. Construct the Success Result
            final_result = {
                "status": "success", 
                "message": ai_text, 
                "data_source": event_data
            }

            # 2. SAVE TO NEON DB (The new part)
            # Pass the camera serial so we know which camera this summary belongs to
            save_daily_summary(
                ai_result=final_result,
                target_date=date.today(),
                camera_serial=event_data.get('camera') 
            )
            
            # 3. Return to Frontend
            return final_result

        else:
            # Handle API Errors
            error_msg = f"AI Service returned code {response.status_code}"
            logger.error(f"❌ {error_msg}")
            
            error_result = {"status": "error", "message": error_msg}

            # OPTIONAL: Save the failure to DB so you have a record of it
            save_daily_summary(
                ai_result=error_result,
                target_date=date.today()
            )

            return error_result


    except requests.exceptions.ConnectionError:
        return {"status": "error", "message": "Could not connect to AI Agent. Is the container running?"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    

# 4. Save Result to DailySummary    
def save_daily_summary(ai_result, target_date=None, zone_id=None, camera_serial=None):
    """
    Saves the AI analysis result into the DailySummary table.
    """
    # 1. Default to today if no date provided
    if not target_date:
        target_date = date.today()

    # 2. Determine Status & Error Message based on AI result
    if ai_result['status'] == 'success':
        status = 'success'
        summary_text = ai_result['message']
        error_message = None
    else:
        status = 'failed'
        summary_text = "Summary generation failed."
        error_message = ai_result['message']

    # 3. Check for duplicates (Optional: Update if exists, or Create new)
    # This prevents creating multiple rows for the exact same day/camera/zone combo
    existing_record = DailySummary.query.filter_by(
        summary_date=target_date,
        camera_serial=camera_serial,
        zone_id=zone_id
    ).first()

    try:
        if existing_record:
            # UPDATE existing record
            existing_record.summary_text = summary_text
            existing_record.status = status
            existing_record.error_message = error_message
            # existing_record.updated_at = datetime.utcnow() # If you have this column
            print(f"🔄 Updated existing summary for {target_date}")
        else:
            # INSERT new record
            new_summary = DailySummary(
                summary_date=target_date,
                camera_serial=camera_serial,  # Can be None (Global summary)
                zone_id=zone_id,              # Can be None (Global summary)
                summary_text=summary_text,
                status=status,
                error_message=error_message
            )
            db.session.add(new_summary)
            print(f"✅ Created new summary for {target_date}")

        # 4. Commit to Neon DB
        db.session.commit()
        return True

    except Exception as e:
        print(f"❌ Database Error: {e}")
        db.session.rollback()
        return False


