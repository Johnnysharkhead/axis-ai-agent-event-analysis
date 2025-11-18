"""
authentication.py
Authentication routes and logic for user signup, login, logout, and session management.
Uses Flask-Login for session-based authentication.
Authors: Victor, David, Success
This module is designed for clarity and maintainability so all project members can easily understand and extend authentication features.
"""
from flask import Blueprint, request, jsonify
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from datetime import datetime, timedelta




# Create blueprints for authentication and user-management routes
auth_bp = Blueprint('auth', __name__, url_prefix='/api')
user_bp = Blueprint('user_admin', __name__)

# Global variables (will be set by init_auth)
db = None
User = None
login_manager = None

#__all__ = ['init_auth', 'auth_bp']

def init_auth(app, database, user_model, invite_model):
    """
    Initialize authentication with Flask app.
    Call this from main.py after creating db and models.
    
    Args:
        app: Flask application instance
        database: SQLAlchemy database instance
        user_model: User model class
    """
    global db, User, InviteKey, login_manager
    
    db = database
    User = user_model
    InviteKey = invite_model
    
    # Setup Flask-Login
    login_manager = LoginManager()
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login'
    
    @login_manager.user_loader
    def load_user(user_id):
        """Flask-Login: Load user from session"""
        return User.query.get(int(user_id))
    
    @login_manager.unauthorized_handler
    def unauthorized():
        """Flask-Login: Return JSON error for unauthorized access"""
        return jsonify({'ok': False, 'message': 'Authentication required'}), 401
    
    # Register blueprints with app
    app.register_blueprint(auth_bp)
    app.register_blueprint(user_bp)
    
    print("✓ Authentication initialized")
    return True

def cors_preflight():
    """Handle CORS preflight OPTIONS requests"""
    response = jsonify({"message": "CORS preflight"})
    response.headers.add("Access-Control-Allow-Origin", "http://localhost:3000")
    response.headers.add("Access-Control-Allow-Credentials", "true")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
    response.headers.add("Access-Control-Allow-Methods", "GET, PUT, POST, PATCH, DELETE, OPTIONS")
    return response

# ==================== AUTHENTICATION ROUTES ====================

@auth_bp.route("/signup", methods=["POST", "OPTIONS"])
def signup():
    """
    Register a new user.
    
    Request body:
        {
            "username": "john",
            "email": "john@example.com",
            "password": "password123"
        }
    
    Returns:
        201: User created successfully
        400: Invalid input
        409: User already exists
    """
    if request.method == "OPTIONS":
        return cors_preflight()
    
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        invite_key_raw = data.get('invite_key', '').strip()

        if not invite_key_raw:
         return jsonify({'ok': False, 'message': 'Invite key required'}), 400

        invite = InviteKey.verify_key(invite_key_raw)

        if not invite:
         return jsonify({'ok': False, 'message': 'Invalid or already used invite key'}), 400

        
        # Validation
        if not username or not email or not password:
            return jsonify({'ok': False, 'message': 'All fields are required'}), 400
        
        if len(password) < 6:
            return jsonify({'ok': False, 'message': 'Password must be at least 6 characters'}), 400
        
        # Check if username taken
        if User.query.filter_by(username=username).first():
            return jsonify({'ok': False, 'message': 'Username already taken'}), 409
        
        # Check if email registered
        if User.query.filter_by(email=email).first():
            return jsonify({'ok': False, 'message': 'Email already registered'}), 409
        
        # Create new user
        new_user = User(username=username, email=email)
        new_user.set_password(password)
        new_user.invite_key_id = invite.id
        
        # Save to database
        db.session.add(new_user)
        db.session.commit()
        
        print(f"✓ New user created: {username} ({email})")
        
        return jsonify({
            'ok': True,
            'message': 'Account created successfully',
            'user': new_user.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"✗ Signup error: {e}")
        return jsonify({'ok': False, 'message': 'Signup failed'}), 500

@auth_bp.route("/login", methods=["POST", "OPTIONS"])
def login():
    """
    Login user and create session.
    
    Request body:
        {
            "email": "john@example.com",
            "password": "password123"
        }
    
    Returns:
        200: Login successful
        400: Missing fields
        401: Invalid credentials
    """
    if request.method == "OPTIONS":
        return cors_preflight()
    
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({'ok': False, 'message': 'Email and password required'}), 400
        
        user = User.query.filter_by(email=email).first()
        
        # --- LOCKOUT LOGIC START ---
        if user:
            if getattr(user, "is_blocked", False):
                return jsonify({'ok': False, 'message': 'Account blocked. Contact an administrator.'}), 403
            # Check if user is locked out
            if user.failed_login_attempts is not None and user.failed_login_attempts >= 5:
                if user.last_failed_login and datetime.utcnow() - user.last_failed_login < timedelta(minutes=1):
                    remaining_time = timedelta(minutes=1) - (datetime.utcnow() - user.last_failed_login)
                    remaining_seconds = int(remaining_time.total_seconds())
                    return jsonify({'ok': False, 'message': f'Too many failed attempts. Try again in {remaining_seconds} seconds.', 'remaining_seconds': remaining_seconds}), 403
                else:
                    # Reset attempts after lockout period
                    user.failed_login_attempts = 0
                    db.session.commit()
        # --- LOCKOUT LOGIC END ---
        
        if not user or not user.check_password(password):
            # Track failed attempts
            if user:
                user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
                user.last_failed_login = datetime.utcnow()
                db.session.commit()
            return jsonify({'ok': False, 'message': 'Invalid email or password'}), 401
        
        # Successful login: reset failed attempts
        user.failed_login_attempts = 0
        user.last_failed_login = None
        login_user(user, remember=True)
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        print(f"✓ User logged in: {user.username}")
        
        return jsonify({
            'ok': True,
            'message': 'Login successful',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        print(f"✗ Login error: {e}")
        return jsonify({'ok': False, 'message': 'Login failed'}), 500

@auth_bp.route("/logout", methods=["POST", "OPTIONS"])
def logout():
    """
    Logout user and clear session.
    
    Returns:
        200: Logout successful
    """
    if request.method == "OPTIONS":
        return cors_preflight()
    
    if current_user.is_authenticated:
        print(f"✓ User logged out: {current_user.username}")
    
    logout_user()
    
    return jsonify({'ok': True, 'message': 'Logged out successfully'}), 200

@auth_bp.route("/me", methods=["GET", "OPTIONS"])
@login_required
def get_current_user():
    """
    Get current logged-in user information.
    Requires authentication.
    
    Returns:
        200: User data
        401: Not authenticated
    """
    if request.method == "OPTIONS":
        return cors_preflight()
    
    return jsonify({
        'ok': True,
        'user': current_user.to_dict()
    }), 200


# ==================== USER ROUTES ====================

@user_bp.route("/users", methods=["GET", "OPTIONS"])
@login_required
def list_users():
    """Admin-only list of all users."""
    if request.method == "OPTIONS":
        return cors_preflight()

    if not getattr(current_user, "is_admin", False):
        return jsonify({"error": "Forbidden"}), 403

    users = User.query.all()
    return jsonify([u.to_dict() for u in users]), 200


@user_bp.route("/users/<int:user_id>/admin", methods=["PATCH", "OPTIONS"])
@login_required
def update_user_admin(user_id):
    """Toggle admin flag for a user."""
    if request.method == "OPTIONS":
        return cors_preflight()

    if not getattr(current_user, "is_admin", False):
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    is_admin = data.get("is_admin")

    if not isinstance(is_admin, bool):
        return jsonify({"error": "is_admin boolean required"}), 400

    user = User.query.get_or_404(user_id)
    user.is_admin = is_admin
    db.session.commit()
    return jsonify(user.to_dict()), 200


@user_bp.route("/users/<int:user_id>/block", methods=["PATCH", "OPTIONS"])
@login_required
def update_user_block(user_id):
    """Block/unblock a user or reset failed attempts."""
    if request.method == "OPTIONS":
        return cors_preflight()

    if not getattr(current_user, "is_admin", False):
        return jsonify({"error": "Forbidden"}), 403

    data = request.get_json(silent=True) or {}
    has_is_blocked = "is_blocked" in data
    reset_failed_attempts = bool(data.get("reset_failed_attempts", False))

    if not has_is_blocked and not reset_failed_attempts:
        return jsonify({"error": "No changes provided"}), 400

    if has_is_blocked and not isinstance(data.get("is_blocked"), bool):
        return jsonify({"error": "is_blocked boolean required"}), 400

    user = User.query.get_or_404(user_id)

    if has_is_blocked:
        user.is_blocked = data["is_blocked"]

    if reset_failed_attempts or (has_is_blocked and data["is_blocked"] is False):
        user.failed_login_attempts = 0
        user.last_failed_login = None

    db.session.commit()
    return jsonify(user.to_dict()), 200
