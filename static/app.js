// 全局变量
let currentUser = null;
let currentDevice = null;
let recordingInterval = null;
let snapshotInterval = null;

// 登录功能
function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    fetch('/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            currentUser = username;
            document.getElementById('loginForm').classList.add('hidden');
            loadDevices();
        } else {
            alert('登录失败：' + data.message);
        }
    })
    .catch(error => console.error('Error:', error));
}

// 加载设备列表
function loadDevices() {
    fetch('/api/user/devices')
    .then(response => response.json())
    .then(devices => {
        const deviceList = document.getElementById('deviceList');
        deviceList.innerHTML = '';
        devices.forEach(device => {
            const deviceButton = document.createElement('button');
            deviceButton.textContent = device;
            deviceButton.classList.add('bg-blue-500', 'text-white', 'p-2', 'rounded', 'mr-2', 'mb-2');
            deviceButton.onclick = () => loadDevice(device);
            deviceList.appendChild(deviceButton);
        });
        deviceList.classList.remove('hidden');
    })
    .catch(error => console.error('Error:', error));
}

// 加载设备视频
function loadDevice(device) {
    currentDevice = device;
    const videoPlayer = document.getElementById('videoPlayer');
    videoPlayer.innerHTML = `<video id="video" controls></video>`;
    videoPlayer.classList.remove('hidden');

    const video = document.getElementById('video');
    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(`/api/video/stream?rtsp_url=${encodeURIComponent(device)}`);
        hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = `/api/video/stream?rtsp_url=${encodeURIComponent(device)}`;
    }

    document.getElementById('controls').classList.remove('hidden');
}

// 开始录像
function startRecording() {
    fetch('/api/video/record/start', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            rtsp_url: currentDevice,
            output_file: `recordings/${currentUser}_${new Date().toISOString()}.mp4`,
            segment_time: 3600 // 1小时分段
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            alert('录像已开始');
        } else {
            alert('开始录像失败：' + data.message);
        }
    })
    .catch(error => console.error('Error:', error));
}

// 停止录像
function stopRecording() {
    fetch('/api/video/record/stop', {
        method: 'POST',
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            alert('录像已停止');
        } else {
            alert('停止录像失败：' + data.message);
        }
    })
    .catch(error => console.error('Error:', error));
}

// 开始快照
function startSnapshots() {
    snapshotInterval = setInterval(() => {
        fetch('/api/video/snapshots/backup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                rtsp_url: currentDevice,
                output_dir: `snapshots/${currentUser}`,
                interval: 10,
                max_snapshots: 30
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.status !== 'success') {
                console.error('快照备份失败：' + data.message);
            }
        })
        .catch(error => console.error('Error:', error));
    }, 10000);
}

// 停止快照
function stopSnapshots() {
    clearInterval(snapshotInterval);
}

// 查看快照
function viewSnapshots() {
    fetch('/api/video/snapshots')
    .then(response => response.json())
    .then(data => {
        const snapshotGallery = document.getElementById('snapshotGallery');
        snapshotGallery.innerHTML = '';
        data.snapshots.forEach(snapshot => {
            const img = document.createElement('img');
            img.src = `/snapshots/${currentUser}/${snapshot}`;
            img.classList.add('w-32', 'h-32', 'object-cover', 'm-2');
            snapshotGallery.appendChild(img);
        });
        snapshotGallery.classList.remove('hidden');
    })
    .catch(error => console.error('Error:', error));
}

// 初始化页面
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    loginForm.innerHTML = `
        <input id="username" type="text" placeholder="用户名" class="p-2 rounded mr-2">
        <input id="password" type="password" placeholder="密码" class="p-2 rounded mr-2">
        <button onclick="login()" class="bg-green-500 text-white p-2 rounded">登录</button>
    `;

    const controls = document.getElementById('controls');
    controls.innerHTML = `
        <button onclick="startRecording()" class="bg-red-500 text-white p-2 rounded mr-2">开始录像</button>
        <button onclick="stopRecording()" class="bg-gray-500 text-white p-2 rounded mr-2">停止录像</button>
        <button onclick="startSnapshots()" class="bg-yellow-500 text-white p-2 rounded mr-2">开始快照</button>
        <button onclick="stopSnapshots()" class="bg-gray-500 text-white p-2 rounded mr-2">停止快照</button>
        <button onclick="viewSnapshots()" class="bg-purple-500 text-white p-2 rounded">查看快照</button>
    `;
});