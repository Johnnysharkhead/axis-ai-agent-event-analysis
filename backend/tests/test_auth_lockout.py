"""
Unit tests for authentication lockout logic.

Tests the security-critical 5-attempt lockout mechanism and account blocking.
Authors: Test Suite
"""
import pytest
from datetime import datetime, timedelta
from flask import Flask
from domain.models import db, User, InviteKey
from routes.authentication import init_auth, auth_bp, user_bp


@pytest.fixture
def app():
    """Create Flask app with in-memory database for testing"""
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SECRET_KEY'] = 'test-secret-key'
    app.config['WTF_CSRF_ENABLED'] = False

    # Initialize database
    db.init_app(app)

    with app.app_context():
        db.create_all()
        # Initialize auth routes
        init_auth(app, db, User, InviteKey)
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Create test client"""
    return app.test_client()


@pytest.fixture
def invite_key(app):
    """Create a test invite key"""
    with app.app_context():
        raw_key, key_hash = InviteKey.generate_key()
        invite = InviteKey(key_hash=key_hash)
        db.session.add(invite)
        db.session.commit()
        return raw_key


@pytest.fixture
def test_user(app, invite_key):
    """Create a test user"""
    with app.app_context():
        user = User(username='testuser', email='test@example.com')
        user.set_password('password123')
        db.session.add(user)
        db.session.commit()
        return user.id


class TestLoginLockout:
    """Test login attempt tracking and lockout mechanism"""

    def test_failed_login_increments_counter(self, client, test_user, app):
        """Test that failed login increments failed_login_attempts"""
        # Attempt login with wrong password
        response = client.post('/api/login', json={
            'email': 'test@example.com',
            'password': 'wrongpassword'
        })

        assert response.status_code == 401
        assert response.json['ok'] is False

        # Check database
        with app.app_context():
            user = User.query.get(test_user)
            assert user.failed_login_attempts == 1
            assert user.last_failed_login is not None

    def test_multiple_failed_attempts(self, client, test_user, app):
        """Test multiple failed login attempts increment counter"""
        # Try 3 failed logins
        for i in range(3):
            response = client.post('/api/login', json={
                'email': 'test@example.com',
                'password': 'wrongpassword'
            })
            assert response.status_code == 401

        # Check counter is 3
        with app.app_context():
            user = User.query.get(test_user)
            assert user.failed_login_attempts == 3

    def test_lockout_at_5_attempts(self, client, test_user, app):
        """Test that 5 failed attempts triggers lockout"""
        # Make 5 failed attempts
        for i in range(5):
            client.post('/api/login', json={
                'email': 'test@example.com',
                'password': 'wrongpassword'
            })

        # 6th attempt should be locked out
        response = client.post('/api/login', json={
            'email': 'test@example.com',
            'password': 'wrongpassword'
        })

        assert response.status_code == 403
        assert 'Too many failed attempts' in response.json['message']
        assert 'remaining_seconds' in response.json

    def test_lockout_duration_is_60_seconds(self, client, test_user, app):
        """Test that lockout lasts exactly 60 seconds"""
        # Trigger lockout
        for i in range(5):
            client.post('/api/login', json={
                'email': 'test@example.com',
                'password': 'wrongpassword'
            })

        # Check lockout response has remaining seconds
        response = client.post('/api/login', json={
            'email': 'test@example.com',
            'password': 'password123'  # Even correct password fails during lockout
        })

        assert response.status_code == 403
        remaining = response.json.get('remaining_seconds')
        assert remaining is not None
        assert 0 < remaining <= 60

    def test_lockout_expires_after_60_seconds(self, client, test_user, app):
        """Test that lockout expires after 60 seconds"""
        # Trigger lockout
        for i in range(5):
            client.post('/api/login', json={
                'email': 'test@example.com',
                'password': 'wrongpassword'
            })

        # Manually set last_failed_login to 61 seconds ago
        with app.app_context():
            user = User.query.get(test_user)
            user.last_failed_login = datetime.utcnow() - timedelta(seconds=61)
            db.session.commit()

        # Should now be able to login with correct password
        response = client.post('/api/login', json={
            'email': 'test@example.com',
            'password': 'password123'
        })

        assert response.status_code == 200
        assert response.json['ok'] is True

        # Counter should be reset
        with app.app_context():
            user = User.query.get(test_user)
            assert user.failed_login_attempts == 0
            assert user.last_failed_login is None

    def test_successful_login_resets_counter(self, client, test_user, app):
        """Test that successful login resets failed attempts"""
        # Make 3 failed attempts
        for i in range(3):
            client.post('/api/login', json={
                'email': 'test@example.com',
                'password': 'wrongpassword'
            })

        # Verify counter is 3
        with app.app_context():
            user = User.query.get(test_user)
            assert user.failed_login_attempts == 3

        # Successful login
        response = client.post('/api/login', json={
            'email': 'test@example.com',
            'password': 'password123'
        })

        assert response.status_code == 200

        # Counter should be reset
        with app.app_context():
            user = User.query.get(test_user)
            assert user.failed_login_attempts == 0
            assert user.last_failed_login is None
            assert user.last_login is not None

    def test_nonexistent_user_does_not_error(self, client):
        """Test that login attempt for nonexistent user doesn't crash"""
        response = client.post('/api/login', json={
            'email': 'nonexistent@example.com',
            'password': 'anypassword'
        })

        # Should return 401, not crash
        assert response.status_code == 401
        assert response.json['ok'] is False


class TestAccountBlocking:
    """Test account blocking functionality"""

    def test_blocked_account_cannot_login(self, client, test_user, app):
        """Test that blocked account prevents login even with correct password"""
        # Block the user
        with app.app_context():
            user = User.query.get(test_user)
            user.is_blocked = True
            db.session.commit()

        # Try to login
        response = client.post('/api/login', json={
            'email': 'test@example.com',
            'password': 'password123'
        })

        assert response.status_code == 403
        assert 'Account blocked' in response.json['message']

    def test_blocked_user_message(self, client, test_user, app):
        """Test blocked user gets helpful error message"""
        with app.app_context():
            user = User.query.get(test_user)
            user.is_blocked = True
            db.session.commit()

        response = client.post('/api/login', json={
            'email': 'test@example.com',
            'password': 'password123'
        })

        assert 'Contact an administrator' in response.json['message']

    def test_lockout_checked_before_blocking(self, client, test_user, app):
        """Test that lockout is checked before account blocking"""
        # Trigger lockout AND block account
        for i in range(5):
            client.post('/api/login', json={
                'email': 'test@example.com',
                'password': 'wrongpassword'
            })

        with app.app_context():
            user = User.query.get(test_user)
            user.is_blocked = True
            db.session.commit()

        # Should get blocked message (checked first in code)
        response = client.post('/api/login', json={
            'email': 'test@example.com',
            'password': 'password123'
        })

        assert response.status_code == 403
        assert 'Account blocked' in response.json['message']


class TestAdminUserManagement:
    """Test admin endpoints for managing user accounts"""

    def test_admin_can_reset_failed_attempts(self, client, test_user, app):
        """Test admin can reset failed login attempts"""
        # Create admin user
        with app.app_context():
            admin = User(username='admin', email='admin@example.com')
            admin.set_password('adminpass')
            admin.is_admin = True
            db.session.add(admin)
            db.session.commit()
            admin_id = admin.id

            # Set failed attempts on test user
            user = User.query.get(test_user)
            user.failed_login_attempts = 5
            user.last_failed_login = datetime.utcnow()
            db.session.commit()

        # Login as admin
        client.post('/api/login', json={
            'email': 'admin@example.com',
            'password': 'adminpass'
        })

        # Reset failed attempts
        response = client.patch(f'/users/{test_user}/block', json={
            'reset_failed_attempts': True
        })

        assert response.status_code == 200

        # Verify reset
        with app.app_context():
            user = User.query.get(test_user)
            assert user.failed_login_attempts == 0
            assert user.last_failed_login is None

    def test_admin_can_block_user(self, client, test_user, app):
        """Test admin can block a user account"""
        # Create admin
        with app.app_context():
            admin = User(username='admin', email='admin@example.com')
            admin.set_password('adminpass')
            admin.is_admin = True
            db.session.add(admin)
            db.session.commit()

        # Login as admin
        client.post('/api/login', json={
            'email': 'admin@example.com',
            'password': 'adminpass'
        })

        # Block user
        response = client.patch(f'/users/{test_user}/block', json={
            'is_blocked': True
        })

        assert response.status_code == 200

        # Verify blocked
        with app.app_context():
            user = User.query.get(test_user)
            assert user.is_blocked is True

    def test_admin_can_unblock_user(self, client, test_user, app):
        """Test admin can unblock a user"""
        # Setup: block user and create admin
        with app.app_context():
            user = User.query.get(test_user)
            user.is_blocked = True
            user.failed_login_attempts = 5
            db.session.commit()

            admin = User(username='admin', email='admin@example.com')
            admin.set_password('adminpass')
            admin.is_admin = True
            db.session.add(admin)
            db.session.commit()

        # Login as admin
        client.post('/api/login', json={
            'email': 'admin@example.com',
            'password': 'adminpass'
        })

        # Unblock user (should also reset failed attempts)
        response = client.patch(f'/users/{test_user}/block', json={
            'is_blocked': False
        })

        assert response.status_code == 200

        # Verify unblocked and attempts reset
        with app.app_context():
            user = User.query.get(test_user)
            assert user.is_blocked is False
            assert user.failed_login_attempts == 0

    def test_non_admin_cannot_manage_users(self, client, test_user, app):
        """Test that non-admin users cannot access user management endpoints"""
        # Login as regular user
        client.post('/api/login', json={
            'email': 'test@example.com',
            'password': 'password123'
        })

        # Try to block themselves
        response = client.patch(f'/users/{test_user}/block', json={
            'is_blocked': True
        })

        assert response.status_code == 403


class TestPasswordValidation:
    """Test password and user creation validation"""

    def test_signup_requires_minimum_password_length(self, client, invite_key):
        """Test signup rejects passwords shorter than 6 characters"""
        response = client.post('/api/signup', json={
            'username': 'newuser',
            'email': 'new@example.com',
            'password': '12345',  # Only 5 characters
            'invite_key': invite_key
        })

        assert response.status_code == 400
        assert 'at least 6 characters' in response.json['message']

    def test_signup_prevents_duplicate_email(self, client, test_user, invite_key, app):
        """Test signup prevents duplicate email addresses"""
        response = client.post('/api/signup', json={
            'username': 'different',
            'email': 'test@example.com',  # Already exists
            'password': 'password123',
            'invite_key': invite_key
        })

        assert response.status_code == 409
        assert 'Email already registered' in response.json['message']

    def test_signup_prevents_duplicate_username(self, client, test_user, invite_key, app):
        """Test signup prevents duplicate usernames"""
        response = client.post('/api/signup', json={
            'username': 'testuser',  # Already exists
            'email': 'different@example.com',
            'password': 'password123',
            'invite_key': invite_key
        })

        assert response.status_code == 409
        assert 'Username already taken' in response.json['message']

    def test_signup_requires_invite_key(self, client):
        """Test signup requires valid invite key"""
        response = client.post('/api/signup', json={
            'username': 'newuser',
            'email': 'new@example.com',
            'password': 'password123',
            'invite_key': 'invalid-key-12345'
        })

        assert response.status_code == 400
        assert 'Invalid or already used invite key' in response.json['message']


class TestUserModel:
    """Test User model password hashing"""

    def test_password_hashing(self, app):
        """Test that passwords are hashed, not stored in plain text"""
        with app.app_context():
            user = User(username='hashtest', email='hash@test.com')
            user.set_password('mypassword')

            # Password hash should not equal plain text
            assert user.password_hash != 'mypassword'
            # Hash should be long (werkzeug hashes are 100+ chars)
            assert len(user.password_hash) > 50

    def test_password_verification(self, app):
        """Test that check_password correctly verifies passwords"""
        with app.app_context():
            user = User(username='verifytest', email='verify@test.com')
            user.set_password('correctpassword')

            # Correct password should verify
            assert user.check_password('correctpassword') is True

            # Wrong password should fail
            assert user.check_password('wrongpassword') is False

    def test_to_dict_excludes_password(self, app, test_user):
        """Test that to_dict() does not expose password hash"""
        with app.app_context():
            user = User.query.get(test_user)
            user_dict = user.to_dict()

            # Should not contain password fields
            assert 'password' not in user_dict
            assert 'password_hash' not in user_dict

            # Should contain safe fields
            assert 'username' in user_dict
            assert 'email' in user_dict
            assert 'is_admin' in user_dict


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
