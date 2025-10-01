#!/bin/bash

# 8BP Rewards System - Complete Deployment Script
# This script sets up the entire system with frontend, backend, and all services

set -e

echo "🚀 Starting 8BP Rewards System Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
if [ ! -f .env ]; then
    print_error ".env file not found!"
    print_status "Copying env-template.txt to .env..."
    cp env-template.txt .env
    print_warning "Please edit .env file with your configuration before continuing!"
    print_status "Required variables:"
    echo "  - MONGO_URI (MongoDB Atlas connection string)"
    echo "  - DISCORD_TOKEN (Discord bot token)"
    echo "  - DISCORD_CLIENT_ID (Discord OAuth client ID)"
    echo "  - DISCORD_CLIENT_SECRET (Discord OAuth client secret)"
    echo "  - ALLOWED_ADMINS (Comma-separated Discord user IDs)"
    echo "  - SCHEDULER_CHANNEL_ID (Discord channel for scheduler notifications)"
    echo "  - REWARDS_CHANNEL_ID (Discord channel for reward notifications)"
    echo "  - SMTP settings for email functionality"
    echo ""
    read -p "Press Enter after configuring .env file..."
fi

# Install backend dependencies
print_status "Installing backend dependencies..."
npm install

# Build backend
print_status "Building backend TypeScript..."
npm run build:backend

# Install frontend dependencies
print_status "Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Build frontend
print_status "Building frontend React app..."
npm run build:frontend

# Create logs directory
print_status "Creating logs directory..."
mkdir -p logs

# Set up MongoDB (if using local MongoDB)
if grep -q "mongodb://localhost" .env; then
    print_status "Setting up local MongoDB..."
    if command -v mongod &> /dev/null; then
        print_success "MongoDB is installed"
    else
        print_warning "MongoDB not found. Please install MongoDB or use MongoDB Atlas."
        print_status "For Ubuntu/Debian: sudo apt-get install mongodb"
        print_status "For macOS: brew install mongodb-community"
        print_status "Or use MongoDB Atlas cloud service and update MONGO_URI in .env"
    fi
fi

# Create systemd services
print_status "Creating systemd services..."

# Backend service
sudo tee /etc/systemd/system/8bp-rewards-backend.service > /dev/null <<EOF
[Unit]
Description=8BP Rewards Backend API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node dist/backend/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Frontend service (served by backend in production)
print_success "Backend service created"

# Discord bot service
sudo tee /etc/systemd/system/8bp-rewards-discord.service > /dev/null <<EOF
[Unit]
Description=8BP Rewards Discord Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node discord-bot.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

print_success "Discord bot service created"

# Scheduler service
sudo tee /etc/systemd/system/8bp-rewards-scheduler.service > /dev/null <<EOF
[Unit]
Description=8BP Rewards Scheduler
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node dist/backend/services/SchedulerService.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

print_success "Scheduler service created"

# Reload systemd
sudo systemctl daemon-reload

# Enable services
print_status "Enabling services..."
sudo systemctl enable 8bp-rewards-backend.service
sudo systemctl enable 8bp-rewards-discord.service
sudo systemctl enable 8bp-rewards-scheduler.service

print_success "Services enabled"

# Start services
print_status "Starting services..."

sudo systemctl start 8bp-rewards-backend.service
sleep 2

sudo systemctl start 8bp-rewards-discord.service
sleep 2

sudo systemctl start 8bp-rewards-scheduler.service
sleep 2

# Check service status
print_status "Checking service status..."

services=("8bp-rewards-backend" "8bp-rewards-discord" "8bp-rewards-scheduler")
all_running=true

for service in "${services[@]}"; do
    if sudo systemctl is-active --quiet "$service.service"; then
        print_success "$service is running"
    else
        print_error "$service failed to start"
        all_running=false
    fi
done

if [ "$all_running" = true ]; then
    print_success "All services are running!"
else
    print_error "Some services failed to start. Check logs:"
    echo "  sudo journalctl -u 8bp-rewards-backend.service -f"
    echo "  sudo journalctl -u 8bp-rewards-discord.service -f"
    echo "  sudo journalctl -u 8bp-rewards-scheduler.service -f"
fi

# Setup Cloudflare Tunnel (optional)
print_status "Setting up Cloudflare Tunnel..."
if command -v cloudflared &> /dev/null; then
    if [ -f setup-cloudflare-tunnel.sh ]; then
        chmod +x setup-cloudflare-tunnel.sh
        print_status "Run ./setup-cloudflare-tunnel.sh to set up Cloudflare Tunnels"
    else
        print_warning "Cloudflare tunnel setup script not found"
    fi
else
    print_warning "cloudflared not installed. Install it to use Cloudflare Tunnels:"
    echo "  Visit: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
fi

# Final status
echo ""
print_success "🎉 8BP Rewards System deployment complete!"
echo ""
echo "📊 Service Status:"
echo "  Backend API: http://localhost:2600"
echo "  Frontend: http://localhost:2500 (development) or served by backend (production)"
echo "  Discord Bot: Running"
echo "  Scheduler: Running (00:00, 06:00, 12:00, 18:00 UTC)"
echo ""
echo "🔧 Management Commands:"
echo "  Check status: sudo systemctl status 8bp-rewards-*.service"
echo "  View logs: sudo journalctl -u 8bp-rewards-*.service -f"
echo "  Restart services: sudo systemctl restart 8bp-rewards-*.service"
echo "  Stop services: sudo systemctl stop 8bp-rewards-*.service"
echo ""
echo "🌐 URLs (after Cloudflare Tunnel setup):"
echo "  Home: https://8bp.epildevconnect.uk/8bp-rewards/home"
echo "  Register: https://8bp.epildevconnect.uk/8bp-rewards/register"
echo "  Admin Dashboard: https://8bp.epildevconnect.uk/8bp-rewards/admin-dashboard"
echo "  Contact: https://8bp.epildevconnect.uk/8bp-rewards/contact"
echo "  System Status: https://8bp.epildevconnect.uk/8bp-rewards/system-status"
echo "  Leaderboard: https://8bp.epildevconnect.uk/8bp-rewards/leaderboard"
echo ""
print_status "Next steps:"
echo "  1. Configure Discord OAuth2 application"
echo "  2. Set up Cloudflare Tunnels (optional)"
echo "  3. Test the system with a registration"
echo "  4. Monitor logs for any issues"


