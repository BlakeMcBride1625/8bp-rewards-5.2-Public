#!/bin/bash

# Cloudflare Tunnel Setup Script for 8BP Rewards System
# This script sets up Cloudflare Tunnels for SSL and domain routing

set -e

echo "🚀 Setting up Cloudflare Tunnels for 8BP Rewards System..."

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared is not installed. Please install it first:"
    echo "   Visit: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
    exit 1
fi

# Check if user is logged in to Cloudflare
if ! cloudflared tunnel list &> /dev/null; then
    echo "🔐 Please log in to Cloudflare first:"
    echo "   Run: cloudflared tunnel login"
    echo "   Then run this script again."
    exit 1
fi

# Create tunnel
echo "📡 Creating Cloudflare tunnel..."
TUNNEL_ID=$(cloudflared tunnel create 8bp-rewards-tunnel --output json | jq -r '.id')

if [ -z "$TUNNEL_ID" ] || [ "$TUNNEL_ID" = "null" ]; then
    echo "❌ Failed to create tunnel"
    exit 1
fi

echo "✅ Tunnel created with ID: $TUNNEL_ID"

# Create DNS record
echo "🌐 Creating DNS record..."
cloudflared tunnel route dns 8bp-rewards-tunnel 8bp.epildevconnect.uk

echo "✅ DNS record created for 8bp.epildevconnect.uk"

# Create credentials file directory
mkdir -p ~/.cloudflared

# Copy tunnel configuration
echo "📋 Setting up tunnel configuration..."
cp cloudflare-tunnel.yml ~/.cloudflared/config.yml

echo "✅ Tunnel configuration copied to ~/.cloudflared/config.yml"

# Create systemd service
echo "🔧 Creating systemd service..."
sudo tee /etc/systemd/system/cloudflared-tunnel.service > /dev/null <<EOF
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/cloudflared tunnel --config /root/.cloudflared/config.yml run
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable cloudflared-tunnel.service

echo "✅ Systemd service created and enabled"

# Start the tunnel service
echo "🚀 Starting Cloudflare tunnel..."
sudo systemctl start cloudflared-tunnel.service

# Check service status
if sudo systemctl is-active --quiet cloudflared-tunnel.service; then
    echo "✅ Cloudflare tunnel is running!"
    echo ""
    echo "🌐 Your application will be available at:"
    echo "   https://8bp.epildevconnect.uk/8bp-rewards/"
    echo ""
    echo "📊 To check tunnel status:"
    echo "   sudo systemctl status cloudflared-tunnel.service"
    echo ""
    echo "📝 To view tunnel logs:"
    echo "   sudo journalctl -u cloudflared-tunnel.service -f"
    echo ""
    echo "🛑 To stop the tunnel:"
    echo "   sudo systemctl stop cloudflared-tunnel.service"
else
    echo "❌ Failed to start Cloudflare tunnel"
    echo "Check logs with: sudo journalctl -u cloudflared-tunnel.service"
    exit 1
fi

echo "🎉 Cloudflare Tunnel setup complete!"


