# VIDAI IVF Marketplace - Server Installation Guide

## System Requirements

### Minimum Requirements
- **OS**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 20GB minimum
- **CPU**: 2 cores minimum

### Software Requirements
- Node.js 18+ (for frontend)
- Python 3.9+ (for backend)
- MongoDB 5.0+
- Nginx (for production reverse proxy)
- PM2 or Supervisor (for process management)

---

## Backend Setup (FastAPI + Python)

### Step 1: Install System Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Python and pip
sudo apt install python3 python3-pip python3-venv -y

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

### Step 2: Clone and Setup Backend

```bash
# Create application directory
sudo mkdir -p /var/www/vidai
cd /var/www/vidai

# Clone your repository (or copy files)
git clone <your-repo-url> .

# Navigate to backend
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 3: Configure Backend Environment

Create `/var/www/vidai/backend/.env`:

```bash
# MongoDB Configuration
MONGO_URL=mongodb://localhost:27017
DB_NAME=vidai_marketplace

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here

# JWT Secret (generate a random string)
JWT_SECRET=your_jwt_secret_key_here_min_32_chars

# Stripe Configuration (for payments)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Server Configuration
HOST=0.0.0.0
PORT=8001
```

### Step 4: Install Backend Dependencies

```bash
# requirements.txt content
cd /var/www/vidai/backend

# Create requirements.txt if not exists
cat > requirements.txt << 'EOF'
fastapi==0.104.1
uvicorn[standard]==0.24.0
motor==3.3.2
pydantic==2.5.2
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
python-dotenv==1.0.0
stripe==7.8.0
httpx==0.25.2
aiofiles==23.2.1
EOF

# Install
pip install -r requirements.txt
```

### Step 5: Setup Supervisor for Backend

```bash
# Install supervisor
sudo apt install supervisor -y

# Create supervisor config
sudo nano /etc/supervisor/conf.d/vidai-backend.conf
```

Add this content:

```ini
[program:vidai-backend]
command=/var/www/vidai/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
directory=/var/www/vidai/backend
user=www-data
autostart=true
autorestart=true
stderr_logfile=/var/log/vidai/backend.err.log
stdout_logfile=/var/log/vidai/backend.out.log
environment=PATH="/var/www/vidai/backend/venv/bin"
```

```bash
# Create log directory
sudo mkdir -p /var/log/vidai
sudo chown www-data:www-data /var/log/vidai

# Reload supervisor
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start vidai-backend
```

---

## Frontend Setup (React)

### Step 1: Install Node.js

```bash
# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version

# Install Yarn (recommended)
npm install -g yarn
```

### Step 2: Setup Frontend

```bash
cd /var/www/vidai/frontend

# Install dependencies
yarn install

# Or using npm
npm install
```

### Step 3: Configure Frontend Environment

Create `/var/www/vidai/frontend/.env`:

```bash
# API Backend URL (your domain with /api prefix)
REACT_APP_BACKEND_URL=https://yourdomain.com

# Optional: Analytics, etc.
REACT_APP_ENV=production
```

### Step 4: Build Frontend for Production

```bash
cd /var/www/vidai/frontend

# Build production bundle
yarn build

# Or using npm
npm run build
```

### Step 5: Serve Frontend with PM2 (Optional - for development server)

```bash
# Install PM2
npm install -g pm2

# Start frontend development server
pm2 start "yarn start" --name vidai-frontend

# Save PM2 process list
pm2 save
pm2 startup
```

---

## Nginx Configuration (Production)

### Step 1: Install Nginx

```bash
sudo apt install nginx -y
sudo systemctl enable nginx
```

### Step 2: Configure Nginx

Create `/etc/nginx/sites-available/vidai`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Frontend - Serve React build
    root /var/www/vidai/frontend/build;
    index index.html;

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

### Step 3: Enable Site and Get SSL

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/vidai /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test nginx config
sudo nginx -t

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Reload nginx
sudo systemctl reload nginx
```

---

## MongoDB Security Setup

```bash
# Connect to MongoDB
mongosh

# Create admin user
use admin
db.createUser({
  user: "vidai_admin",
  pwd: "secure_password_here",
  roles: [{ role: "userAdminAnyDatabase", db: "admin" }]
})

# Create application user
use vidai_marketplace
db.createUser({
  user: "vidai_app",
  pwd: "app_password_here",
  roles: [{ role: "readWrite", db: "vidai_marketplace" }]
})

exit
```

Update MongoDB config `/etc/mongod.conf`:

```yaml
security:
  authorization: enabled
```

Update backend `.env`:

```bash
MONGO_URL=mongodb://vidai_app:app_password_here@localhost:27017/vidai_marketplace?authSource=vidai_marketplace
```

---

## Firewall Configuration

```bash
# Install UFW
sudo apt install ufw -y

# Allow SSH
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Quick Start Commands

### Start All Services

```bash
# Start MongoDB
sudo systemctl start mongod

# Start Backend
sudo supervisorctl start vidai-backend

# Reload Nginx
sudo systemctl reload nginx
```

### Check Service Status

```bash
# Check all services
sudo systemctl status mongod
sudo supervisorctl status vidai-backend
sudo systemctl status nginx
```

### View Logs

```bash
# Backend logs
tail -f /var/log/vidai/backend.err.log
tail -f /var/log/vidai/backend.out.log

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Restart Services

```bash
# Restart backend
sudo supervisorctl restart vidai-backend

# Restart nginx
sudo systemctl restart nginx

# Restart MongoDB
sudo systemctl restart mongod
```

---

## Docker Installation (Alternative)

### docker-compose.yml

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    container_name: vidai-mongodb
    restart: always
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: admin_password

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: vidai-backend
    restart: always
    ports:
      - "8001:8001"
    depends_on:
      - mongodb
    environment:
      - MONGO_URL=mongodb://admin:admin_password@mongodb:27017
      - DB_NAME=vidai_marketplace
      - ADMIN_USERNAME=admin
      - ADMIN_PASSWORD=vidai@01
    volumes:
      - ./backend:/app

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: vidai-frontend
    restart: always
    ports:
      - "3000:3000"
    depends_on:
      - backend
    environment:
      - REACT_APP_BACKEND_URL=http://localhost:8001

  nginx:
    image: nginx:alpine
    container_name: vidai-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./frontend/build:/usr/share/nginx/html
    depends_on:
      - backend
      - frontend

volumes:
  mongodb_data:
```

### Backend Dockerfile

Create `/var/www/vidai/backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```

### Frontend Dockerfile

Create `/var/www/vidai/frontend/Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install

COPY . .

EXPOSE 3000

CMD ["yarn", "start"]
```

### Run with Docker

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

---

## Troubleshooting

### Backend not starting
```bash
# Check logs
sudo tail -f /var/log/vidai/backend.err.log

# Check if port is in use
sudo lsof -i :8001

# Test manually
cd /var/www/vidai/backend
source venv/bin/activate
python -c "from server import app; print('OK')"
```

### Frontend build fails
```bash
# Clear cache and rebuild
cd /var/www/vidai/frontend
rm -rf node_modules
rm -rf build
yarn install
yarn build
```

### MongoDB connection issues
```bash
# Check MongoDB status
sudo systemctl status mongod

# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log

# Test connection
mongosh --eval "db.adminCommand('ping')"
```

### Nginx 502 Bad Gateway
```bash
# Check if backend is running
sudo supervisorctl status vidai-backend

# Check nginx error log
sudo tail -f /var/log/nginx/error.log

# Verify backend is listening
curl http://127.0.0.1:8001/api/
```

---

## Default Credentials

| Role | Username/Email | Password |
|------|---------------|----------|
| Admin | admin | vidai@01 |
| Vendor (test) | vendor1@test.com | test123 |
| Clinic (test) | clinic1@test.com | test123 |

**Important**: Change all default passwords in production!

---

## Support

For issues and support:
- Check logs in `/var/log/vidai/`
- Review Nginx logs in `/var/log/nginx/`
- MongoDB logs in `/var/log/mongodb/`
