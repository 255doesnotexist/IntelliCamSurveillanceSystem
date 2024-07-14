import os
import time
import threading
import signal
import uuid
import ffmpeg
import torch
import cv2
from flask import Flask, Blueprint, request, jsonify, send_file, Response

# 定义目录
RECORDS_DIR = 'records'
SNAPSHOTS_DIR = 'snapshots'

# 确保目录存在
os.makedirs(RECORDS_DIR, exist_ok=True)
os.makedirs(SNAPSHOTS_DIR, exist_ok=True)

video_bp = Blueprint('video', __name__)

# 加载 YOLOv5 模型
# model = torch.hub.load('ultralytics/yolov5', 'yolov5s')

recording_processes = {}

class RecordingThread(threading.Thread):
    def __init__(self, rtsp_url, output_file, segment_time, recording_id):
        super().__init__()
        self.rtsp_url = rtsp_url
        self.output_file = output_file
        self.segment_time = segment_time
        self.recording_id = recording_id
        self._stop_event = threading.Event()
        self.process = None

    def run(self):
        self.process = (
            ffmpeg
            .input(self.rtsp_url)
            .output(self.output_file, segment_time=self.segment_time)
            .run_async()
        )
        self.process.wait()

    def stop(self):
        if self.process:
            self.process.send_signal(signal.SIGINT)
            self._stop_event.set()

def detect_objects(frame):
    results = model(frame)
    return results

def save_snapshot(rtsp_url, output_file):
    try:
        (
            ffmpeg
            .input(rtsp_url)
            .output(output_file, vframes=1)
            .run()
        )
        return True
    except ffmpeg.Error as e:
        print(f"Error saving snapshot: {e}")
        return False

def gen_video_stream(rtsp_url):
    cap = cv2.VideoCapture(rtsp_url)
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        ret, buffer = cv2.imencode('.jpg', frame)
        frame = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
    cap.release()

@video_bp.route('/stream', methods=['GET'])
def get_video_stream():
    rtsp_url = request.args.get('rtsp_url')
    return Response(gen_video_stream(rtsp_url),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@video_bp.route('/record/start', methods=['POST'])
def start_recording():
    rtsp_url = request.json.get('rtsp_url')
    device_name = request.json.get('device_name')
    username = request.json.get('username')
    segment_time = request.json.get('segment_time', 60)
    recording_id = str(uuid.uuid4())
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    output_file = os.path.join(RECORDS_DIR, f"{device_name}_{username}_{timestamp}.mkv")
    thread = RecordingThread(rtsp_url, output_file, segment_time, recording_id)
    thread.start()
    recording_processes[recording_id] = thread
    return jsonify({"status": "success", "message": "Recording started", "recording_id": recording_id, "output_file": output_file})

@video_bp.route('/record/stop', methods=['POST'])
def stop_recording():
    global recording_processes
    recording_id = request.json.get('recording_id')
    if recording_id in recording_processes:
        thread = recording_processes[recording_id]
        thread.stop()
        thread.join()
        del recording_processes[recording_id]
        return jsonify({"status": "success", "message": "Recording stopped"})
    else:
        return jsonify({"status": "error", "message": "No recording process found for the given ID"}), 404

@video_bp.route('/snapshot', methods=['POST'])
def take_snapshot():
    rtsp_url = request.json.get('rtsp_url')
    device_name = request.json.get('device_name')
    username = request.json.get('username')
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    output_file = os.path.join(SNAPSHOTS_DIR, f"{device_name}_{username}_{timestamp}.png")
    if save_snapshot(rtsp_url, output_file):
        return jsonify({"status": "success", "message": "Snapshot taken", "snapshot_file": output_file})
    else:
        return jsonify({"status": "error", "message": "Failed to take snapshot"}), 500

@video_bp.route('/snapshots', methods=['GET'])
def list_snapshots():
    snapshots = [f for f in os.listdir(SNAPSHOTS_DIR) if os.path.isfile(os.path.join(SNAPSHOTS_DIR, f))]
    return jsonify({"status": "success", "snapshots": snapshots})

@video_bp.route('/records', methods=['GET'])
def list_records():
    records = [f for f in os.listdir(RECORDS_DIR) if os.path.isfile(os.path.join(RECORDS_DIR, f))]
    return jsonify({"status": "success", "records": records})

@video_bp.route('/playback', methods=['GET'])
def get_video_playback():
    video_file = request.args.get('video_file')
    video_path = os.path.join(RECORDS_DIR, video_file)
    if not os.path.isfile(video_path):
        return jsonify({"status": "error", "message": "Video file not found"}), 404
    return send_file(video_path, mimetype='video/mp4')

@video_bp.route('/download_snapshot', methods=['GET'])
def get_snapshot():
    snapshot_file = request.args.get('snapshot_file')
    snapshot_path = os.path.join(SNAPSHOTS_DIR, snapshot_file)
    if not os.path.isfile(snapshot_path):
        return jsonify({"status": "error", "message": "Snapshot not found"}), 404
    return send_file(snapshot_path, mimetype='image/jpeg')

# 把蓝图注册到你的 Flask 应用
app = Flask(__name__)
app.register_blueprint(video_bp, url_prefix='/api/video')

if __name__ == "__main__":
    app.run(debug=True)
