const { useState, useEffect, createContext, useContext, useRef } = React;
const { Layout, Menu, Button, Form, Input, message, Table, Modal, Card, Space, Typography, Popconfirm } = antd;
const { UserOutlined, LockOutlined, SyncOutlined, PlusOutlined } = icons; // 添加 PlusOutlined 图标
const { Header, Content, Sider } = Layout;
const { Title } = Typography;

// 创建 UserContext
const UserContext = createContext();

const useUser = () => useContext(UserContext);

const UserProvider = ({ children }) => {
    const [username, setUsername] = useState('');

    const login = (name) => {
        setUsername(name);
    };

    const logout = () => {
        setUsername('');
    };

    return (
        <UserContext.Provider value={{ username, login, logout }}>
            {children}
        </UserContext.Provider>
    );
};

const MainApp = () => {
    const { username, login, logout } = useUser();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [selectedMenu, setSelectedMenu] = useState('1');
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [snapshots, setSnapshots] = useState([]);
    const [records, setRecords] = useState([]);
    const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
    const [isAddDeviceModalVisible, setIsAddDeviceModalVisible] = useState(false);
    const [settings, setSettings] = useState({});
    const [isRecording, setIsRecording] = useState(false);
    const [recordingFile, setRecordingFile] = useState('');
    const [recordingStartTime, setRecordingStartTime] = useState(null);
    const [recordingId, setRecordingId] = useState(null);

    const usernameRef = useRef(username);

    useEffect(() => {
        usernameRef.current = username;
    }, [username]);

    useEffect(() => {
        if (isLoggedIn) {
            fetchDevices();
        }
    }, [isLoggedIn]);

    useEffect(() => {
        let deviceTimer, snapshotTimer, recordTimer;
        if (isLoggedIn) {
            deviceTimer = setInterval(fetchDevices, 15000);
            snapshotTimer = setInterval(fetchSnapshots, 15000);
            recordTimer = setInterval(fetchRecords, 15000);
        }
        return () => {
            clearInterval(deviceTimer);
            clearInterval(snapshotTimer);
            clearInterval(recordTimer);
        };
    }, [isLoggedIn, selectedDevice]);

    useEffect(() => {
        let timer;
        if (isRecording) {
            timer = setInterval(() => {
                setRecordingStartTime((startTime) => {
                    if (startTime) {
                        return startTime + 1;
                    }
                    return 1;
                });
            }, 1000);
        } else {
            clearInterval(timer);
            setRecordingStartTime(null);
        }
        return () => clearInterval(timer);
    }, [isRecording]);

    const fetchDevices = async () => {
        try {
            const response = await fetch('/api/user/devices');
            const deviceIds = await response.json();
            const devicesData = await Promise.all(deviceIds.map(async (deviceId) => {
                const detailsResponse = await fetch(`/api/device/details?username=${usernameRef.current}&device_id=${deviceId}`);
                const data = await detailsResponse.json();
                const isOnline = await checkIfDeviceOnline(data.rtsp_url);
                return { ...data, id: deviceId, status: isOnline ? '在线' : '不在线' };
            }));
            setDevices(devicesData);
        } catch (error) {
            message.error('获取设备列表失败');
        }
    };

    const checkIfDeviceOnline = async (rtsp_url) => {
        try {
            const response = await fetch(`/api/device/check_online?rtsp_url=${encodeURIComponent(rtsp_url)}`);
            const data = await response.json();
            return data.is_online;
        } catch (error) {
            console.error('Error checking device online status:', error);
            return false;
        }
    };

    const handleLogin = async (values) => {
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });
            const data = await response.json();
            if (data.status === 'success') {
                setIsLoggedIn(true);
                login(values.username);
                message.success('登录成功');
            } else {
                message.error(data.message);
            }
        } catch (error) {
            message.error('登录失败');
        }
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
            setIsLoggedIn(false);
            logout();
            message.success('登出成功');
        } catch (error) {
            message.error('登出失败');
        }
    };

    const handleMenuClick = (e) => {
        setSelectedMenu(e.key);
    };

    const handleDeviceSelect = async (deviceId) => {
        setSelectedDevice(deviceId);
        const response = await fetch(`/api/device/details?username=${usernameRef.current}&device_id=${deviceId}`);
        const data = await response.json();
        setSettings(data);
        await fetchSnapshots(); // 获取快照列表
        await fetchRecords(); // 获取录像列表
    };

    const fetchSnapshots = async () => {
        try {
            const response = await fetch(`/api/video/snapshots`);
            const data = await response.json();
            if (data.status === 'success') {
                setSnapshots(data.snapshots.map(name => ({ name })));
            } else {
                message.error(data.message);
            }
        } catch (error) {
            message.error('获取快照列表失败');
        }
    };

    const fetchRecords = async () => {
        try {
            const response = await fetch(`/api/video/records`);
            const data = await response.json();
            if (data.status === 'success') {
                setRecords(data.records.map(name => ({ name })));
            } else {
                message.error(data.message);
            }
        } catch (error) {
            message.error('获取录像列表失败');
        }
    };

    const handleStartRecording = async () => {
        const timestamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);
        const recordingFileName = `${settings.name}_${username}_${timestamp}.mkv`;

        try {
            const response = await fetch('/api/video/record/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rtsp_url: settings.rtsp_url,
                    device_name: settings.name,
                    username: username,
                    segment_time: 60
                })
            });
            const data = await response.json();
            if (data.status === 'success') {
                setIsRecording(true);
                setRecordingFile(recordingFileName);
                setRecordingId(data.recording_id);  // 存储录像ID
                message.success('开始录像成功');
            } else {
                message.error(data.message);
            }
        } catch (error) {
            message.error('开始录像失败');
        }
    };

    const handleStopRecording = async () => {
        try {
            const response = await fetch('/api/video/record/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recording_id: recordingId  // 传递录像ID
                })
            });
            const data = await response.json();
            if (data.status === 'success') {
                setIsRecording(false);
                setRecordingId(null);
                message.success('停止录像成功');
                await fetchRecords(); // 更新录像列表
            } else {
                message.error(data.message);
            }
        } catch (error) {
            message.error('停止录像失败');
        }
    };

    const handleTakeSnapshot = async () => {
        const timestamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15);
        const snapshotFileName = `${settings.name}_${username}_${timestamp}.png`;

        try {
            const response = await fetch('/api/video/snapshot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rtsp_url: settings.rtsp_url,
                    device_name: settings.name,
                    username: username
                })
            });
            const data = await response.json();
            if (data.status === 'success') {
                message.success('快照已拍摄');
                await fetchSnapshots();  // 更新快照列表
            } else {
                message.error(data.message);
            }
        } catch (error) {
            message.error('快照拍摄失败');
        }
    };

    const handleSettingsClick = async (deviceId) => {
        setSelectedDevice(deviceId);
        try {
            const response = await fetch(`/api/device/details?username=${usernameRef.current}&device_id=${deviceId}`);
            const data = await response.json();
            setSettings(data);
            setIsSettingsModalVisible(true);
        } catch (error) {
            message.error('获取设备配置失败');
        }
    };

    const handleSettingsCancel = () => {
        setIsSettingsModalVisible(false);
    };

    const handleSettingsUpdate = async (values) => {
        try {
            const response = await fetch('/api/settings/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...values, username: usernameRef.current, device_id: selectedDevice })
            });
            const data = await response.json();
            if (data.status === 'success') {
                message.success('设备配置更新成功');
                setIsSettingsModalVisible(false);
                setSettings(values);
            } else {
                message.error(data.message);
            }
        } catch (error) {
            message.error('更新设备配置失败');
        }
    };

    const handleAddDevice = async (values) => {
        try {
            const response = await fetch('/api/device/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...values, username: usernameRef.current })
            });
            const data = await response.json();
            if (data.status === 'success') {
                message.success('添加设备成功');
                setIsAddDeviceModalVisible(false);
                fetchDevices(); // 更新设备列表
            } else {
                message.error(data.message);
            }
        } catch (error) {
            message.error('添加设备失败');
        }
    };

    const handleDeleteDevice = async (deviceId) => {
        try {
            const response = await fetch('/api/device/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ device_id: deviceId, username: usernameRef.current })
            });
            const data = await response.json();
            if (data.status === 'success') {
                message.success('删除设备成功');
                fetchDevices(); // 更新设备列表
            } else {
                message.error(data.message);
            }
        } catch (error) {
            message.error('删除设备失败');
        }
    };

    const renderContent = () => {
        switch (selectedMenu) {
            case '1':
                return (
                    <div>
                        <h2>设备列表</h2>
                        <Button icon={<SyncOutlined />} onClick={fetchDevices} style={{ marginBottom: '10px', marginRight: '10px' }}>刷新</Button>
                        <Button icon={<PlusOutlined />} onClick={() => setIsAddDeviceModalVisible(true)} style={{ marginBottom: '10px' }}>添加设备</Button>
                        <Table
                            dataSource={devices}
                            columns={[
                                { title: '设备ID', dataIndex: 'id', key: 'id' },
                                { title: '设备名称', dataIndex: 'name', key: 'name' },
                                { title: 'RTSP URL', dataIndex: 'rtsp_url', key: 'rtsp_url' },
                                { title: '设备状态', dataIndex: 'status', key: 'status' },
                                {
                                    title: '操作',
                                    key: 'action',
                                    render: (text, record) => (
                                        <Space>
                                            <Button onClick={() => handleDeviceSelect(record.id)}>选择</Button>
                                            <Button onClick={() => handleSettingsClick(record.id)}>配置设备</Button>
                                            <Button onClick={() => handleTakeSnapshot(record.id)}>查看实时快照图</Button>
                                            <Popconfirm title="确定删除这个设备吗?" onConfirm={() => handleDeleteDevice(record.id)}>
                                                <Button type="danger">删除设备</Button>
                                            </Popconfirm>
                                        </Space>
                                    ),
                                },
                            ]}
                        />
                        <Modal
                            title="修改设备配置"
                            visible={isSettingsModalVisible}
                            onCancel={handleSettingsCancel}
                            footer={null}
                        >
                            <Form initialValues={settings} onFinish={handleSettingsUpdate}>
                                <Form.Item name="rtsp_url" label="RTSP URL">
                                    <Input />
                                </Form.Item>
                                <Form.Item name="name" label="设备名称">
                                    <Input />
                                </Form.Item>
                                <Form.Item>
                                    <Button type="primary" htmlType="submit">更新配置</Button>
                                </Form.Item>
                            </Form>
                        </Modal>
                        <Modal
                            title="添加设备"
                            visible={isAddDeviceModalVisible}
                            onCancel={() => setIsAddDeviceModalVisible(false)}
                            footer={null}
                        >
                            <Form onFinish={handleAddDevice}>
                                <Form.Item name="id" label="设备ID" rules={[{ required: true, message: '请输入设备ID!' }]}>
                                    <Input />
                                </Form.Item>
                                <Form.Item name="name" label="设备名称" rules={[{ required: true, message: '请输入设备名称!' }]}>
                                    <Input />
                                </Form.Item>
                                <Form.Item name="rtsp_url" label="RTSP URL" rules={[{ required: true, message: '请输入RTSP URL!' }]}>
                                    <Input />
                                </Form.Item>
                                <Form.Item>
                                    <Button type="primary" htmlType="submit">添加设备</Button>
                                </Form.Item>
                            </Form>
                        </Modal>
                    </div>
                );
            case '2':
                return (
                    <div>
                        <h2>实时视频</h2>
                        {selectedDevice && (
                            <div>
                                <video controls width="100%">
                                    <source src={`/api/video/stream?rtsp_url=${settings.rtsp_url}`} type="video/mp4" />
                                    Your browser does not support the video tag.
                                </video>
                                <div style={{ marginTop: '10px' }}>
                                    <Button onClick={handleStartRecording} disabled={isRecording}>开始录像</Button>
                                    <Button onClick={handleStopRecording} disabled={!isRecording} style={{ marginLeft: '10px' }}>停止录像</Button>
                                    <Button onClick={handleTakeSnapshot} style={{ marginLeft: '10px' }}>拍摄快照</Button>
                                </div>
                                {isRecording && (
                                    <div style={{ marginTop: '10px' }}>
                                        <p>当前录像文件: {recordingFile}</p>
                                        <p>当前录像时长: {recordingStartTime} 秒</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            case '3':
                return (
                    <div>
                        <h2>文件管理</h2>
                        <div>
                            <h3>快照文件</h3>
                            <Button icon={<SyncOutlined />} onClick={fetchSnapshots} style={{ marginBottom: '10px' }}>刷新</Button>
                            <Table
                                dataSource={snapshots}
                                columns={[
                                    { title: '快照名称', dataIndex: 'name', key: 'name' },
                                    {
                                        title: '操作',
                                        key: 'action',
                                        render: (text, record) => (
                                            <a href={`/api/video/download_snapshot?snapshot_file=${record.name}`} target="_blank" rel="noopener noreferrer">查看</a>
                                        ),
                                    },
                                ]}
                            />
                            <h3>录像文件</h3>
                            <Button icon={<SyncOutlined />} onClick={fetchRecords} style={{ marginBottom: '10px' }}>刷新</Button>
                            <Table
                                dataSource={records}
                                columns={[
                                    { title: '录像名称', dataIndex: 'name', key: 'name' },
                                    {
                                        title: '操作',
                                        key: 'action',
                                        render: (text, record) => (
                                            <a href={`/api/video/playback?video_file=${record.name}`} target="_blank" rel="noopener noreferrer">查看</a>
                                        ),
                                    },
                                ]}
                            />
                        </div>
                    </div>
                );
            default:
                return <h2>请选择一个菜单项</h2>;
        }
    };

    if (!isLoggedIn) {
        return (
            <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
                <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Card style={{ width: 350, boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
                            <Title level={2}>视频监控系统</Title>
                            <Form
                                name="login"
                                initialValues={{ remember: true }}
                                onFinish={handleLogin}
                            >
                                <Form.Item
                                    name="username"
                                    rules={[{ required: true, message: '请输入用户名!' }]}
                                >
                                    <Input prefix={<UserOutlined />} placeholder="用户名" />
                                </Form.Item>
                                <Form.Item
                                    name="password"
                                    rules={[{ required: true, message: '请输入密码!' }]}
                                >
                                    <Input.Password prefix={<LockOutlined />} placeholder="密码" />
                                </Form.Item>
                                <Form.Item>
                                    <Button type="primary" htmlType="submit" style={{ width: '100%' }}>
                                        登录
                                    </Button>
                                </Form.Item>
                            </Form>
                        </Space>
                    </Card>
                </Content>
            </Layout>
        );
    }

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Header style={{ background: '#fff', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <img src="/static/logo.jpg" alt="Logo" style={{ height: '32px', margin: '16px' }} />
                    <Title level={4} style={{ margin: 0 }}>视频监控系统</Title>
                </div>
                <Button onClick={handleLogout} style={{ margin: '16px' }}>登出</Button>
            </Header>
            <Layout>
                <Sider>
                    <Menu theme="dark" mode="inline" selectedKeys={[selectedMenu]} onClick={handleMenuClick}>
                        <Menu.Item key="1">设备管理</Menu.Item>
                        <Menu.Item key="2">实时视频</Menu.Item>
                        <Menu.Item key="3">文件管理</Menu.Item>
                    </Menu>
                </Sider>
                <Layout>
                    <Content style={{ margin: '24px 16px', padding: 24, background: '#fff' }}>
                        {renderContent()}
                    </Content>
                </Layout>
            </Layout>
        </Layout>
    );
};

const App = () => (
    <UserProvider>
        <MainApp />
    </UserProvider>
);

ReactDOM.render(<App />, document.getElementById('root'));
