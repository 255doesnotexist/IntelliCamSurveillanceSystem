from flask import Blueprint, request, jsonify
import obswebsocket
from obswebsocket import obsws, requests

live_bp = Blueprint('live', __name__)

def start_live_stream(obs_ip, password, stream_url, stream_key):
    ws = obsws(obs_ip, 4444, password)
    ws.connect()
    ws.call(requests.StartStreaming(stream=stream_url, key=stream_key))
    ws.disconnect()

def stop_live_stream(obs_ip, password):
    ws = obsws(obs_ip, 4444, password)
    ws.connect()
    ws.call(requests.StopStreaming())
    ws.disconnect()

@live_bp.route('/start', methods=['POST'])
def start_live():
    data = request.json
    obs_ip = data.get('obs_ip')
    password = data.get('password')
    stream_url = data.get('stream_url')
    stream_key = data.get('stream_key')
    start_live_stream(obs_ip, password, stream_url, stream_key)
    return jsonify({"status": "success", "message": "Live streaming started"})

@live_bp.route('/stop', methods=['POST'])
def stop_live():
    data = request.json
    obs_ip = data.get('obs_ip')
    password = data.get('password')
    stop_live_stream(obs_ip, password)
    return jsonify({"status": "success", "message": "Live streaming stopped"})
