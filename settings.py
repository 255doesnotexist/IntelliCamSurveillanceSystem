from flask import Blueprint, request, jsonify
import json
import requests

settings_bp = Blueprint('settings', __name__)


# 加载和保存设置的辅助函数
def load_settings():
    with open('settings.json', 'r', encoding='utf-8') as f:
        return json.load(f)


def save_settings(settings):
    with open('settings.json', 'w', encoding='utf-8') as f:
        json.dump(settings, f, indent=4, ensure_ascii=False)


def load_users():
    with open('users.json', 'r', encoding='utf-8') as f:
        return json.load(f)


def save_users(users):
    with open('users.json', 'w', encoding='utf-8') as f:
        json.dump(users, f, indent=4, ensure_ascii=False)


# 获取所有设置
@settings_bp.route('', methods=['GET'])
def get_settings():
    settings = load_settings()
    return jsonify(settings)


# 更新设备设置
@settings_bp.route('/update', methods=['POST'])
def update_settings():
    new_settings = request.json
    device_id = new_settings.pop('device_id', None)
    settings = load_settings()

    if not device_id:
        return jsonify({"status": "error", "message": "Device ID not provided"}), 400

    if device_id not in settings['devices']:
        return jsonify({"status": "error", "message": "Device not found"}), 404

    # 更新设备配置
    settings['devices'][device_id].update(new_settings)
    save_settings(settings)
    return jsonify({"status": "success", "message": "Settings updated"})


# 获取设备详情
def get_device_details(device_id):
    settings = load_settings()
    if device_id in settings['devices']:
        return settings['devices'][device_id]
    return None


device_bp = Blueprint('device', __name__)


# 检查设备在线状态
def check_if_device_online(rtsp_url):
    try:
        response = requests.head(rtsp_url, timeout=5)
        return response.status_code == 200
    except requests.RequestException as e:
        print(f"Error checking device online status: {e}")
        return False


# 获取设备详情
@device_bp.route('/details', methods=['GET'])
def get_device():
    device_id = request.args.get('device_id')
    device_details = get_device_details(device_id)
    if not device_details:
        return jsonify({"status": "error", "message": "Device not found"}), 404
    device_details['is_online'] = check_if_device_online(device_details['rtsp_url'])
    return jsonify(device_details)


# 添加设备
@device_bp.route('/add', methods=['POST'])
def add_device():
    data = request.json
    device_id = data.get('id')
    device_name = data.get('name')
    rtsp_url = data.get('rtsp_url')
    username = data.get('username')

    if not device_id or not device_name or not rtsp_url or not username:
        return jsonify({"status": "error", "message": "Missing required fields"}), 400

    settings = load_settings()
    users = load_users()

    if device_id in settings['devices']:
        return jsonify({"status": "error", "message": "Device ID already exists"}), 400

    settings['devices'][device_id] = {
        "name": device_name,
        "rtsp_url": rtsp_url
    }
    save_settings(settings)

    if username in users:
        users[username].setdefault('devices', []).append(device_id)
        save_users(users)
        return jsonify({"status": "success", "message": "Device added"})
    else:
        return jsonify({"status": "error", "message": "User not found"}), 404


# 删除设备
@device_bp.route('/delete', methods=['POST'])
def delete_device():
    data = request.json
    device_id = data.get('device_id')
    username = data.get('username')

    if not device_id or not username:
        return jsonify({"status": "error", "message": "Device ID or Username not provided"}), 400

    settings = load_settings()
    users = load_users()

    if device_id not in settings['devices']:
        return jsonify({"status": "error", "message": "Device not found"}), 404

    del settings['devices'][device_id]
    save_settings(settings)

    if username in users and 'devices' in users[username]:
        if device_id in users[username]['devices']:
            users[username]['devices'].remove(device_id)
            save_users(users)
            return jsonify({"status": "success", "message": "Device deleted"})
        else:
            return jsonify({"status": "error", "message": "Device ID not found in user's devices"}), 404
    else:
        return jsonify({"status": "error", "message": "User not found or no devices for user"}), 404


# 检查设备在线状态
@device_bp.route('/check_online', methods=['GET'])
def check_online():
    rtsp_url = request.args.get('rtsp_url')
    if not rtsp_url:
        return jsonify({"status": "error", "message": "RTSP URL not provided"}), 400
    is_online = check_if_device_online(rtsp_url)
    return jsonify({"is_online": is_online})
