#!/bin/bash

# VIDAI IVF Marketplace - Quick Setup Script
# Run this on a fresh Ubuntu 20.04+ server

set -e

echo "=========================================="
echo "  VIDAI Marketplace - Server Setup"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo ./setup.sh)${NC}"
    exit 1
fi

# Get domain name
read -p "Enter your domain name (e.g., yourdomain.com): " DOMAIN
read -p "Enter admin password for VIDAI: " ADMIN_PASSWORD
read -p "Enter MongoDB password: " MONGO_PASSWORD

echo ""
echo -e "${YELLOW}Starting installation...${NC}"

# Update system
echo -e "${GREEN}[1/10] Updating system packages...${NC}"
apt update && apt upgrade -y

# Install dependencies
echo -e "${GREEN}[2/10] Installing system dependencies...${NC}"
apt install -y curl wget git build-essential nginx supervisor

# Install Node.js 18
echo -e "${GREEN}[3/10] Installing Node.js 18...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
npm install -g yarn pm2

# Install Python 3.11
echo -e "${GREEN}[4/10] Installing Python 3.11...${NC}"
apt install -y python3 python3-pip python3-venv

# Install MongoDB
echo -e "${GREEN}[5/10] Installing MongoDB...${NC}"
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
apt update
apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod

# Create application directory
echo -e "${GREEN}[6/10] Setting up application directory...${NC}"
mkdir -p /var/www/vidai
mkdir -p /var/log/vidai
chown -R www-data:www-data /var/log/vidai

# Setup Backend
echo -e "${GREEN}[7/10] Setting up Backend...${NC}"
cd /var/www/vidai/backend

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create backend .env
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=vidai_marketplace
ADMIN_USERNAME=admin
ADMIN_PASSWORD=${ADMIN_PASSWORD}
JWT_SECRET=$(openssl rand -hex 32)
HOST=0.0.0.0
PORT=8001
EOF

# Setup Frontend
echo -e "${GREEN}[8/10] Setting up Frontend...${NC}"
cd /var/www/vidai/frontend

yarn install

# Create frontend .env
cat > .env << EOF
REACT_APP_BACKEND_URL=https://${DOMAIN}
REACT_APP_ENV=production
EOF

# Build frontend
yarn build

# Setup Supervisor
echo -e "${GREEN}[9/10] Configuring Supervisor...${NC}"
cat > /etc/supervisor/conf.d/vidai-backend.conf << EOF
[program:vidai-backend]
command=/var/www/vidai/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
directory=/var/www/vidai/backend
user=www-data
autostart=true
autorestart=true
stderr_logfile=/var/log/vidai/backend.err.log
stdout_logfile=/var/log/vidai/backend.out.log
environment=PATH="/var/www/vidai/backend/venv/bin"
EOF

supervisorctl reread
supervisorctl update
supervisorctl start vidai-backend

# Setup Nginx
echo -e "${GREEN}[10/10] Configuring Nginx...${NC}"
cat > /etc/nginx/sites-available/vidai << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    root /var/www/vidai/frontend/build;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

ln -sf /etc/nginx/sites-available/vidai /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# Install SSL
echo -e "${GREEN}Installing SSL certificate...${NC}"
apt install -y certbot python3-certbot-nginx
certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN}

# Setup Firewall
echo -e "${GREEN}Configuring firewall...${NC}"
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

echo ""
echo -e "${GREEN}=========================================="
echo "  Installation Complete!"
echo "==========================================${NC}"
echo ""
echo "Your VIDAI Marketplace is now running at:"
echo -e "  ${GREEN}https://${DOMAIN}${NC}"
echo ""
echo "Default Admin Login:"
echo "  Username: admin"
echo "  Password: ${ADMIN_PASSWORD}"
echo ""
echo "Commands:"
echo "  - View backend logs: tail -f /var/log/vidai/backend.err.log"
echo "  - Restart backend: sudo supervisorctl restart vidai-backend"
echo "  - Restart nginx: sudo systemctl restart nginx"
echo ""
echo -e "${YELLOW}IMPORTANT: Change the default passwords in production!${NC}"
