import os
import json
from flask import Flask, render_template
from flask_login import LoginManager
from auth import auth_bp, load_user
from video import video_bp
from live import live_bp
from settings import settings_bp, device_bp

app = Flask(__name__)
app.secret_key = 'your_secret_key'

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'

login_manager.user_loader(load_user)

app.register_blueprint(auth_bp, url_prefix='/api')
app.register_blueprint(video_bp, url_prefix='/api/video')
app.register_blueprint(live_bp, url_prefix='/api/live')
app.register_blueprint(settings_bp, url_prefix='/api/settings')
app.register_blueprint(device_bp, url_prefix='/api/device')

def ensure_settings_file():
    settings_path = 'settings.json'
    if not os.path.exists(settings_path) or not is_json_valid(settings_path):
        default_settings = {
            "users": {
                "default_user": {
                    "password": "default_password",
                    "devices": {
                        "default_device": {
                            "rtsp_url": "",
                            "output_file": "",
                            "snapshot_dir": ""
                        }
                    }
                }
            }
        }
        with open(settings_path, 'w', encoding='utf-8') as f:
            json.dump(default_settings, f, indent=4, ensure_ascii=False)

def is_json_valid(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            json.load(f)
        return True
    except ValueError:
        return False

# 确保在应用启动时检查并生成合法的 settings.json 文件
ensure_settings_file()

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)
