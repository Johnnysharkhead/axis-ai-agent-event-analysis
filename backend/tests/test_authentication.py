# backend/tests/test_authentication.py
import pytest
from flask import Flask
from flask_login import FlaskLoginClient
from routes.authentication import init_auth, auth_bp
from datetime import datetime, timedelta

# ---------------- Mock Models ----------------

class MockSession:
    def add(self, obj): pass
    def commit(self): pass
    def rollback(self): pass

class MockDB:
    session = MockSession()

class MockInviteKey:
    _keys = {"VALIDKEY": 1}

    @staticmethod
    def verify_key(key):
        if key in MockInviteKey._keys:
            id_ = MockInviteKey._keys.pop(key)
            class Invite:
                def __init__(self, id):
                    self.id = id
            return Invite(id_)
        return None

class MockUser:
    _users = []

    def __init__(self, username=None, email=None):
        self.username = username or "testuser"
        self.email = email or "test@example.com"
        self.failed_login_attempts = 0
        self.last_failed_login = None
        self.last_login = None
        self.invite_key_id = None
        self.password = None

    def set_password(self, pwd):
        self.password = pwd

    def check_password(self, pwd):
        return self.password == pwd

    def to_dict(self):
        return {"username": self.username, "email": self.email}

    # Required for Flask-Login
    @property
    def is_authenticated(self):
        return True

    @property
    def is_active(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def get_id(self):
        return str(id(self))

# ---------------- Mock Query ----------------
class MockQuery:
    def __init__(self, users):
        self.users = users

    def filter_by(self, **kwargs):
        class Result:
            def __init__(self, users, kwargs):
                self.users = users
                self.kwargs = kwargs

            def first(self):
                for user in self.users:
                    if all(getattr(user, k) == v for k, v in self.kwargs.items()):
                        return user
                return None
        return Result(self.users, kwargs)

    def get(self, id_):
        for user in self.users:
            if str(id(user)) == str(id_):
                return user
        return None

MockUser.query = MockQuery(MockUser._users)

# ---------------- Fixtures ----------------

@pytest.fixture
def app():
    app = Flask(__name__)
    app.secret_key = "testsecret"
    app.test_client_class = FlaskLoginClient
    # Use mocked DB
    init_auth(app, database=MockDB(), user_model=MockUser, invite_model=MockInviteKey)
    return app

@pytest.fixture
def client(app):
    return app.test_client()

# ---------------- Tests ----------------

def test_signup_success(client):
    MockUser._users.clear()
    MockInviteKey._keys["VALIDKEY"] = 1  # reset key

    data = {
        "username": "newuser",
        "email": "new@example.com",
        "password": "password123",
        "invite_key": "VALIDKEY"
    }
    response = client.post("/api/signup", json=data)
    assert response.status_code == 201
    assert response.get_json()["ok"] is True

    # Add user to MockUser._users for further queries
    user_dict = response.get_json()["user"]
    user = MockUser(username=user_dict["username"], email=user_dict["email"])
    user.set_password(data["password"])
    MockUser._users.append(user)

def test_signup_existing_user(client):
    MockUser._users.clear()
    existing_user = MockUser(username="existing", email="exist@example.com")
    existing_user.set_password("password")
    MockUser._users.append(existing_user)
    MockInviteKey._keys["VALIDKEY"] = 2  # new key for test

    data = {
        "username": "existing",
        "email": "new2@example.com",
        "password": "password123",
        "invite_key": "VALIDKEY"
    }
    response = client.post("/api/signup", json=data)
    assert response.status_code == 409

def test_login_success(client):
    MockUser._users.clear()
    user = MockUser(username="loginuser", email="login@example.com")
    user.set_password("mypassword")
    MockUser._users.append(user)

    data = {
        "email": "login@example.com",
        "password": "mypassword"
    }
    response = client.post("/api/login", json=data)
    assert response.status_code == 200
    assert response.get_json()["ok"] is True

def test_login_invalid_user(client):
    MockUser._users.clear()
    data = {
        "email": "nouser@example.com",
        "password": "wrongpassword"
    }
    response = client.post("/api/login", json=data)
    assert response.status_code == 401

def test_logout(client):
    MockUser._users.clear()
    response = client.post("/api/logout")
    assert response.status_code == 200
    assert response.get_json()["ok"] is True