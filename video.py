from flask import Blueprint, request, jsonify, send_file, Response, abort
import cv2
import os
import time
import ffmpeg
import torch
import threading

video_bp = Blueprint('video', __name__)

model = torch.hub.load('ultralytics/yolov5', 'yolov5s')

def detect_objects(frame):
    results = model(frame)
    return results

def save_snapshot(input_url, output_dir, interval=10, max_snapshots=30):
    snapshot_count = 0
    while snapshot_count <= max_snapshots:
        timestamp = time.strftime("%Y%m%d-%H%M%S")
        snapshot_file = os.path.join(output_dir, f"{timestamp}.jpg")
        (
            ffmpeg
            .input(input_url)
            .output(snapshot_file, vframes=1)
            .run()
        )
        snapshot_count += 1
        time.sleep(interval)

def gen_video_stream(rtsp_url):
    cap = cv2.VideoCapture(rtsp_url)
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        ret, buffer = cv2.imencode('.jpg', frame)
        frame = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@video_bp.route('/stream', methods=['GET'])
def get_video_stream():
    rtsp_url = request.args.get('rtsp_url')
    return Response(gen_video_stream(rtsp_url),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@video_bp.route('/record/start', methods=['POST'])
def start_recording():
    rtsp_url = request.json.get('rtsp_url')
    output_file = request.json.get('output_file')
    segment_time = request.json.get('segment_time', 60)
    thread = threading.Thread(target=start_recording, args=(rtsp_url, output_file, segment_time))
    thread.start()
    return jsonify({"status": "success", "message": "Recording started"})

@video_bp.route('/record/stop', methods=['POST'])
def stop_recording():
    # Implement stop recording logic here
    return jsonify({"status": "success", "message": "Recording stopped"})

@video_bp.route('/snapshots', methods=['GET'])
def get_snapshots():
    snapshot_dir = 'path_to_snapshot_directory'  # 请确保这个路径存在
    if not os.path.exists(snapshot_dir):
        return jsonify({"status": "error", "message": "Snapshot directory not found"}), 404
    snapshots = os.listdir(snapshot_dir)
    return jsonify({"snapshots": snapshots})

@video_bp.route('/snapshots/backup', methods=['POST'])
def backup_snapshots():
    rtsp_url = request.json.get('rtsp_url')
    output_dir = request.json.get('output_dir')
    interval = request.json.get('interval', 10)
    max_snapshots = request.json.get('max_snapshots', 30)
    thread = threading.Thread(target=save_snapshot, args=(rtsp_url, output_dir, interval, max_snapshots))
    thread.start()
    return jsonify({"status": "success", "message": "Snapshots backed up"})

@video_bp.route('/playback', methods=['GET'])
def get_video_playback():
    video_file = request.args.get('video_file')
    if not video_file or not os.path.isfile(video_file):
        return jsonify({"status": "error", "message": "Video file not found"}), 404
    return send_file(video_file, mimetype='video/mp4')
