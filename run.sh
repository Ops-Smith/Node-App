#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    Node.js Demo Application${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}🚀 Starting Node.js Demo Application...${NC}"
echo ""

# Create volumes if they don't exist
echo -e "${YELLOW}📦 Creating Docker volumes...${NC}"
docker volume create demo-backend-data 2>/dev/null && echo -e "${GREEN}✅ Created demo-backend-data volume${NC}" || echo -e "${YELLOW}📝 demo-backend-data volume already exists${NC}"
# Remove unused frontend volume
echo ""

# Build images
echo -e "${YELLOW}🔨 Building Docker images...${NC}"
docker build -t backend:1.0.0 ./backend && echo -e "${GREEN}✅ Backend image built successfully${NC}"
docker build -t frontend:1.0.0 ./frontend && echo -e "${GREEN}✅ Frontend image built successfully${NC}"
echo ""

# Stop and remove existing containers if they exist
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker stop demo-backend-container 2>/dev/null && echo -e "${GREEN}✅ Stopped demo-backend-container${NC}" || echo -e "${YELLOW}📝 demo-backend-container not running${NC}"
docker stop demo-frontend-container 2>/dev/null && echo -e "${GREEN}✅ Stopped demo-frontend-container${NC}" || echo -e "${YELLOW}📝 demo-frontend-container not running${NC}"

docker rm demo-backend-container 2>/dev/null && echo -e "${GREEN}✅ Removed demo-backend-container${NC}" || echo -e "${YELLOW}📝 demo-backend-container not found${NC}"
docker rm demo-frontend-container 2>/dev/null && echo -e "${GREEN}✅ Removed demo-frontend-container${NC}" || echo -e "${YELLOW}📝 demo-frontend-container not found${NC}"
echo ""

# Create network for containers to communicate
echo -e "${YELLOW}🌐 Creating Docker network...${NC}"
docker network create demo-network 2>/dev/null && echo -e "${GREEN}✅ Created demo-network${NC}" || echo -e "${YELLOW}📝 demo-network already exists${NC}"
echo ""

# Run backend container with volume AND environment variable
echo -e "${YELLOW}🔧 Starting backend container with volume...${NC}"
docker run -d \
  --name demo-backend-container \
  --network demo-network \
  -v demo-backend-data:/app/data \
  -e NODE_ENV=production \
  backend:1.0.0 && echo -e "${GREEN}✅ Backend container started${NC}"
echo ""

# Run frontend container
echo -e "${YELLOW}🌍 Starting frontend container...${NC}"
docker run -d \
  --name demo-frontend-container \
  --network demo-network \
  -p 3000:3000 \
  frontend:1.0.0 && echo -e "${GREEN}✅ Frontend container started${NC}"
echo ""

# Wait for containers to start
echo -e "${YELLOW}⏳ Waiting for services to start...${NC}"
sleep 5
echo ""

# Check if containers are running
echo -e "${YELLOW}🔍 Checking container status...${NC}"
backend_running=$(docker inspect -f '{{.State.Running}}' demo-backend-container 2>/dev/null || echo "false")
frontend_running=$(docker inspect -f '{{.State.Running}}' demo-frontend-container 2>/dev/null || echo "false")

if [ "$backend_running" = "true" ] && [ "$frontend_running" = "true" ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}          SUCCESS! 🎉${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${GREEN}🚀 Application started successfully!${NC}"
    echo ""
    echo -e "${BLUE}📱 Frontend:${NC} ${GREEN}http://localhost:3000${NC}"
    echo -e "${BLUE}🔌 Backend API:${NC} ${GREEN}http://localhost:3001${NC}"
    echo -e "${BLUE}💾 Data Volume:${NC} ${GREEN}demo-backend-data${NC}"
    echo ""
    echo -e "${YELLOW}📋 Useful commands:${NC}"
    echo -e "  To stop: ${BLUE}docker stop demo-backend-container demo-frontend-container${NC}"
    echo -e "  To view backend logs: ${BLUE}docker logs -f demo-backend-container${NC}"
    echo -e "  To view frontend logs: ${BLUE}docker logs -f demo-frontend-container${NC}"
    echo -e "  To view volume data: ${BLUE}docker run -it -v demo-backend-data:/data alpine ls -la /data${NC}"
    echo -e "  To backup volume: ${BLUE}docker run --rm -v demo-backend-data:/source -v \$(pwd):/backup alpine tar czf /backup/backup.tar.gz -C /source .${NC}"
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}          ERROR! 💥${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo -e "${RED}❌ Failed to start one or more containers${NC}"
    echo ""
    echo -e "${YELLOW}📄 Backend logs:${NC}"
    docker logs demo-backend-container 2>/dev/null || echo -e "${RED}Backend container not found${NC}"
    echo ""
    echo -e "${YELLOW}📄 Frontend logs:${NC}"
    docker logs demo-frontend-container 2>/dev/null || echo -e "${RED}Frontend container not found${NC}"
    echo ""
    echo -e "${YELLOW}🔧 Troubleshooting tips:${NC}"
    echo -e "  - Check if ports 3000 and 3001 are available"
    echo -e "  - Run 'docker ps' to see running containers"
    echo -e "  - Run 'docker network ls' to check networks"
    exit 1
fi