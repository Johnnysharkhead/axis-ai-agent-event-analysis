"""

This code is to retrive the entire JSON response from the AI analysis function and returns it via a Flask API endpoint.


from flask import Blueprint, jsonify
from application.ai_analysis import generate_security_summary

ai_bp = Blueprint('ai_routes', __name__)

@ai_bp.route('/api/ai/latest-analysis', methods=['GET'])
def get_latest_analysis():
    """"""
    Endpoint to trigger AI analysis on the latest relevant DB row.
    """"""
    result = generate_security_summary()
    
    status_code = 200 if result['status'] == 'success' else 500
    return jsonify(result), status_code"""


# This code is to retrive only the message attribute of JSON response from the AI analysis function and returns it via a Flask API endpoint.

from flask import Blueprint, jsonify
from application.ai_analysis import generate_security_summary
from domain.models import DailySummary

ai_bp = Blueprint('ai_routes', __name__)

@ai_bp.route('/api/ai/latest-analysis', methods=['GET'])
def get_latest_analysis():
    """
    Endpoint to trigger AI analysis on the latest relevant DB row.
    """
    result = generate_security_summary()
    
    if result['status'] == 'success':
        # ✅ CHANGE: Only return the 'message' part
        return jsonify({"message": result['message']}), 200
    else:
        # On error, still return json but with the error message
        return jsonify({"message": result['message']}), 500



@ai_bp.route('/api/ai/history', methods=['GET'])
def get_ai_history():
    """
    Fetches the last 10 AI summaries from the database.
    """
    try:
        # Fetch last 10, newest first
        summaries = DailySummary.query.order_by(DailySummary.created_at.desc()).limit(10).all()
        
        # Use the serialize() method you defined in your Model
        return jsonify([s.serialize() for s in summaries]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500