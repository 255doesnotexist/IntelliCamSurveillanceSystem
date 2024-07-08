from flask import Blueprint, request, jsonify, session
import json
from flask_login import LoginManager, login_user, logout_user, login_required, UserMixin

auth_bp = Blueprint('auth', __name__)
login_manager = LoginManager()
login_manager.init_app(app)


class User(UserMixin):
    def __init__(self, username):
        self.id = username


def load_users():
    with open('users.json', 'r') as f:
        return json.load(f)


@login_manager.user_loader
def load_user(username):
    users = load_users()
    if username in users:
        return User(username)
    return None


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    users = load_users()

    if username in users and users[username]['password'] == password:
        user = User(username)
        login_user(user)
        return jsonify({"status": "success", "message": "Login successful"})
    else:
        return jsonify({"status": "error", "message": "Invalid credentials"}), 401


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"status": "success", "message": "Logout successful"})


@auth_bp.route('/user/devices', methods=['GET'])
@login_required
def get_user_devices():
    username = session['user_id']
    users = load_users()
    if username in users:
        return jsonify(users[username]['devices'])
    else:
        return jsonify({"status": "error", "message": "User not found"}), 404
