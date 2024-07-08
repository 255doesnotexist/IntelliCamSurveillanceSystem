from flask import Flask, render_template
from flask_login import LoginManager
from auth import auth_bp, load_user
from video import video_bp
from live import live_bp
from settings import settings_bp

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

@app.route('/')
def index():
    return render_template('index.html')
@app.route('/login')
def login():
    return render_template('login.html')

if __name__ == '__main__':
    app.run(debug=True)
