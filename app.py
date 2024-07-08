from flask import Flask, render_template
from auth import auth_bp
from video import video_bp
from live import live_bp
from settings import settings_bp

app = Flask(__name__)
app.secret_key = 'your_secret_key'

app.register_blueprint(auth_bp, url_prefix='/api')
app.register_blueprint(video_bp, url_prefix='/api/video')
app.register_blueprint(live_bp, url_prefix='/api/live')
app.register_blueprint(settings_bp, url_prefix='/api/settings')

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)
