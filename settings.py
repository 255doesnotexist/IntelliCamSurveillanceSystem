from flask import Blueprint, request, jsonify
import json

settings_bp = Blueprint('settings', __name__)

def load_settings():
    with open('settings.json', 'r') as f:
        return json.load(f)

def save_settings(settings):
    with open('settings.json', 'w') as f:
        json.dump(settings, f)

@settings_bp.route('', methods=['GET'])
def get_settings():
    settings = load_settings()
    return jsonify(settings)

@settings_bp.route('', methods=['POST'])
def update_settings():
    new_settings = request.json
    settings = load_settings()
    settings.update(new_settings)
    save_settings(settings)
    return jsonify({"status": "success", "message": "Settings updated"})
