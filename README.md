# Node.js Demo Application
A simple full-stack Node.js application demonstrating a message board with frontend and backend services, containerized with Docker.

# 🚀 Overview
This application consists of:

1. Backend API - Node.js/Express server running on port 3001

2. Frontend - Static web server running on port 3000

3. Docker - Containerized deployment with volume persistence

4. Bash Script - Automated build and deployment

# 🏗️ Architecture
```text
nodejs-demo/
├── backend/                 # Express.js API server
│   ├── server.js           # Main backend server
│   ├── package.json        # Backend dependencies
│   └── data/               # Local data storage (messages.json)
├── frontend/               # Static web server
│   ├── scirpt.js           # Frontend JavaScript functionality
│   ├── nginx.conf          # Nginx server configuration
│   ├── index.html          # Main HTML page
│   ├── style.css           # CSS styling
├── Dockerfile.backend      # Backend Docker configuration
├── Dockerfile.frontend     # Frontend Docker configuration
└── run.sh                  # Deployment script
```
# 📋 Features
- ✅ Add new messages via web interface /messages

- ✅ View all messages with timestamps

- ✅ Real-time backend status monitoring

- ✅ Data persistence with Docker volumes

- ✅ Responsive design

- ✅ Health check endpoints /health

# 🛠️ Prerequisites
1. Node.js (v14 or higher)

2. Docker (v20 or higher)

3. Git

# 🏃‍♂️ Local Development
1. Clone and Setup

```bash
git clone <repo url>
cd nodejs-demo
```

2. Backend Setup

```bash
cd backend
npm install
npm start
```
Backend will run on: http://localhost:3001

3. Frontend Setup
```bash

# New terminal window/tab
Frontend will run on: http://localhost:3000

4. Test the Application
* Open http://localhost:3000 in your browser

* You should see the message board interface

* Backend status should show "Connected ✅"

* Try sending a message - it should appear instantly

# 🐳 Docker Deployment
## Using the Automated Script (Recommended)
```bash
# Make the script executable (first time only)
chmod +x run.sh

# Run the application
./run.sh
```

The script will:

1. 🛑 Stop any existing containers

2. 📦 Build new Docker images

3. 🌐 Create Docker network

4. 🐳 Start both backend and frontend containers

5. ✅ Verify everything is running

6. 🔗 Provide access URLs

Access Points
- Frontend: http://localhost:3000

- Backend API: http://localhost:3001

# Manual Docker Commands
If you prefer to run manually:

```bash
# Build images
docker build -t backend:1.0.0 ./backend
docker build -t frontend:1.0.0 ./frontend

# Create network
docker network create demo-network

# Run containers
docker run -d --name backend --network demo-network -p 3001:3001 demo-backend
docker run -d --name frontend --network demo-network -p 3000:3000 demo-frontend
```

# 📊 API Endpoints

**Backend (Port 3001)**

| Method | Endpoint        | Description                                      |
|--------|-----------------|--------------------------------------------------|
| GET    | `/`             | API documentation page                           |
| GET    | `/api/messages` | Get all messages                                 |
| POST   | `/api/messages` | Add new message (JSON: `{"message": "text"}`)    |
| GET    | `/api/health`   | Health check                                     |

# 🗄️ Data Persistence
Local Development: Data stored in backend/data/messages.json

Docker: Data persisted in demo-backend-data volume

Messages survive container restarts when using Docker volumes

# 🛠️ Management Commands
### View Logs
```bash
# Backend logs
docker logs demo-backend-container

# Frontend logs  
docker logs demo-frontend-container
```
### Stop Application
```bash
docker stop demo-backend-container demo-frontend-container
```
### Remove Everything
```bash
# Stop and remove containers
docker stop demo-backend-container demo-frontend-container
docker rm demo-backend-container demo-frontend-container

# Remove images
docker rmi demo-backend demo-frontend

# Remove volumes
docker volume rm demo-backend-data demo-frontend-data

# Remove network
docker network rm demo-network
```
### Check Volume Data
```bash
# View files in backend volume
docker run --rm -v demo-backend-data:/data alpine ls -la /data

# Backup volume data
docker run --rm -v demo-backend-data:/source -v $(pwd):/backup alpine tar czf /backup/backup.tar.gz -C /source .
```

# 🔧 Troubleshooting
### Common Issues
1. Ports already in use

    - Ensure ports 3000 and 3001 are available

    - Stop any existing Node.js processes

2. Backend connection failed

    - Verify backend is running on port 3001

    - Check http://localhost:3001/api/health

3. Docker permission issues

    - Run with sudo if needed

    - Add your user to docker group: sudo usermod -aG docker $USER

4. Volume not persisting data

    - Check volume exists: docker volume ls

    - Restart containers with the same volume

**Debugging Steps**
1. Check container status: docker ps

2. View logs: docker logs <container-name>

3. Test backend directly: curl http://localhost:3001/api/health

4. Check network: docker network inspect demo-network

# 📝 Development Notes
- Backend uses CORS to allow frontend connections

- Frontend automatically detects backend status

- Data is stored in JSON format with timestamps

- Docker containers communicate via internal network

- Health checks ensure service availability

# 🎯 Next Steps
**Potential enhancements:**

- Add user authentication

- Implement message editing

- Add database integration (MongoDB/PostgreSQL)

- Deploy to cloud platform (AWS, GCP, Azure)

- Add CI/CD pipeline

- Implement real-time updates with WebSockets

# 📄 License
This is a demo application for educational purposes.

**Happy Coding! 🚀**
