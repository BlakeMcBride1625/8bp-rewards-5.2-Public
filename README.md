# 8 Ball Pool Rewards Bot

An automated Discord bot that claims free cue pieces and daily rewards from the 8 Ball Pool website shop, with MongoDB storage and comprehensive Discord integration.

## Features

- 🎯 **Automated Claiming**: Uses Playwright to interact with the 8 Ball Pool shop
- 🆔 **Multiple User Support**: Claim rewards for multiple users with different User IDs
- 🔐 **Login Automation**: Automatically handles the login modal and "Go" button
- 🎁 **Daily Rewards**: Claims free daily rewards and cue pieces
- ⏰ **Daily Scheduling**: Automatically runs daily at 12:00 AM and 12:00 PM
- 📝 **Comprehensive Logging**: Tracks all activities and errors
- 🛡️ **Error Handling**: Robust error handling for various scenarios
- 🖥️ **Headless Operation**: Runs in the background without opening browser windows
- 🤖 **Discord Integration**: Sends confirmation messages with images to Discord
- 📸 **Image Generation**: Creates confirmation images with claimed items
- 🗑️ **Automatic Cleanup**: Deletes local files after sending to Discord
- 💾 **MongoDB Storage**: Persistent user data with automatic backups
- 🔄 **Smart Override**: Automatic conflict resolution for duplicate accounts
- 📊 **Statistics Tracking**: Monitor claim counts and timestamps
- 🔧 **TypeScript**: Fully typed for better development experience

# 8 Ball Pool Rewards System v2.0

A comprehensive full-stack web application that automatically claims daily rewards from 8 Ball Pool, featuring a React frontend, Node.js backend API, Discord bot integration, admin dashboard, and automated scheduling.

## 🚀 Features

### Frontend (React + TypeScript + Tailwind)
- **Modern UI**: Balanced low-contrast theme with animated backgrounds
- **Responsive Design**: Works on all devices with mobile-first approach
- **Animated Backgrounds**: Particle fields and 3D orbs with parallax effects
- **Accessibility**: WCAG AA compliant with reduced motion support
- **Pages**: Home, Register, Admin Dashboard, Contact, System Status, Leaderboard

### Backend (Node.js + Express + TypeScript)
- **RESTful API**: Complete API with authentication and validation
- **MongoDB Integration**: Atlas cloud database with comprehensive models
- **Discord OAuth2**: Secure admin authentication
- **Winston Logging**: Structured logging with MongoDB storage
- **Nodemailer**: Contact form email system with SMTP
- **Rate Limiting**: Security and performance optimization

### Discord Bot (discord.js)
- **Slash Commands**: Modern Discord command interface
- **Admin Controls**: Restricted to authorized administrators
- **Notifications**: Automated reward and scheduler notifications
- **Status Monitoring**: Server and website health checks

### Automation & Scheduling
- **Cron Scheduler**: Runs every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
- **Playwright Integration**: Automated browser interaction
- **Error Handling**: Comprehensive error tracking and notifications
- **Claim Tracking**: Detailed logging of all reward claims

### Admin Dashboard
- **Discord OAuth2**: Secure authentication for administrators
- **User Management**: Add, remove, and search registrations
- **System Monitoring**: Real-time status and performance metrics
- **Log Viewer**: Comprehensive logging with filters and pagination
- **Manual Controls**: Trigger claims and manage system settings

## 🏗️ Architecture

```
8bp-rewards/
├── frontend/                 # React + TypeScript + Tailwind frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom React hooks
│   │   └── services/        # API services
│   └── public/              # Static assets
├── backend/                 # Node.js + Express + TypeScript backend
│   ├── src/
│   │   ├── models/          # MongoDB models
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── middleware/       # Express middleware
│   │   └── server.ts        # Main server file
├── models/                  # Legacy MongoDB models
├── services/                # Legacy services
├── discord-bot.js           # Discord bot entry point
├── discord-service.js       # Discord bot service
├── playwright-claimer*.js   # Automation scripts
└── docker-compose.yml       # Docker services configuration
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- MongoDB Atlas account (or local MongoDB)
- Discord Bot Token and OAuth2 credentials
- SMTP email service (Gmail, etc.)

### Quick Start

1. **Clone and Install**
   ```bash
   git clone <repository-url> 8bp-rewards
   cd 8bp-rewards
   npm run install:all
   ```

2. **Configure Environment**
   ```bash
   cp env-template.txt .env
   # Edit .env with your configuration
   ```

3. **Deploy System**
   ```bash
   ./deploy.sh
   ```

### Manual Setup

1. **Backend Setup**
   ```bash
   npm install
   npm run build:backend
   npm run start:backend
   ```

2. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm start
   ```

3. **Discord Bot Setup**
   ```bash
   npm run bot
   ```

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## ⚙️ Configuration

### Environment Variables (.env)

```env
# MongoDB Configuration
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/8bp-rewards

# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_oauth_client_id_here
DISCORD_CLIENT_SECRET=your_discord_oauth_client_secret_here
OAUTH_REDIRECT_URI=https://8bp.epildevconnect.uk/8bp-rewards/auth/discord/callback
ALLOWED_ADMINS=850726663289700373,1111185974748270622
SCHEDULER_CHANNEL_ID=your_scheduler_channel_id_here
REWARDS_CHANNEL_ID=your_rewards_channel_id_here

# Server Ports
FRONTEND_PORT=2500
BACKEND_PORT=2600

# Public URLs
PUBLIC_URL=https://8bp.epildevconnect.uk/8bp-rewards
HOME_URL=https://8bp.epildevconnect.uk/8bp-rewards/home
REGISTER_URL=https://8bp.epildevconnect.uk/8bp-rewards/register
ADMIN_DASHBOARD_URL=https://8bp.epildevconnect.uk/8bp-rewards/admin-dashboard
CONTACT_URL=https://8bp.epildevconnect.uk/8bp-rewards/contact
SYSTEM_STATUS_URL=https://8bp.epildevconnect.uk/8bp-rewards/system-status
LEADERBOARD_URL=https://8bp.epildevconnect.uk/8bp-rewards/leaderboard

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password_here
SMTP_SECURE=true
MAIL_FROM=your_email@gmail.com
MAIL_TO=admin@epildevconnect.uk
```

## 🌐 URLs & Routes

### Public Routes
- **Home**: `/home` - Introduction and quick links
- **Register**: `/register` - User registration form
- **Contact**: `/contact` - Contact form with email integration
- **System Status**: `/system-status` - Real-time system monitoring
- **Leaderboard**: `/leaderboard` - User rankings and statistics

### Admin Routes (Discord OAuth2 Required)
- **Admin Dashboard**: `/admin-dashboard` - Complete admin interface
- **User Management**: Add, remove, search registrations
- **System Tools**: Manual claims, log viewer, notifications
- **Analytics**: Claim statistics and performance metrics

### API Routes
- **Registration**: `POST /api/registration` - Register new users
- **Contact**: `POST /api/contact` - Send contact form emails
- **Status**: `GET /api/status` - System health and metrics
- **Leaderboard**: `GET /api/leaderboard` - User rankings
- **Admin**: `GET /api/admin/*` - Admin-only endpoints

## 🤖 Discord Bot Commands

### Available Commands (Admin Only)
- `/register` - Register 8 Ball Pool account
- `/list-accounts` - List all registered accounts
- `/check-accounts` - Check account statuses
- `/deregister` - Remove account from system
- `/help` - Show help information
- `/md` - Show markdown documentation
- `/server-status` - Check Discord bot server status
- `/website-status` - Check website and backend status
- `/ping-discord` - Test Discord connectivity
- `/ping-website` - Test website connectivity

### Removed Commands
- `/claim` - Manual claiming (moved to web interface)
- `/get` - Account info (moved to web interface)
- `/claim-all` - Bulk claiming (moved to admin dashboard)

## 📊 Database Models

### Registration Collection
```typescript
{
  _id: ObjectId,
  eightBallPoolId: string (unique),
  username: string,
  createdAt: Date,
  updatedAt: Date
}
```

### Claim Records Collection
```typescript
{
  _id: ObjectId,
  eightBallPoolId: string,
  websiteUserId: string,
  status: 'success' | 'failed',
  itemsClaimed: string[],
  error?: string,
  claimedAt: Date,
  schedulerRun: Date
}
```

### Log Entries Collection
```typescript
{
  _id: ObjectId,
  level: 'error' | 'warn' | 'info' | 'debug',
  message: string,
  meta: any,
  timestamp: Date,
  service: string,
  userId?: string,
  action?: string,
  ip?: string,
  userAgent?: string
}
```

## 🔄 Scheduler

### Schedule
- **Frequency**: Every 6 hours
- **Times**: 00:00, 06:00, 12:00, 18:00 UTC
- **Timezone**: UTC (configurable)

### Notifications
- **Success**: Posted to `SCHEDULER_CHANNEL_ID`
- **Failures**: DM sent to all `ALLOWED_ADMINS`
- **Summary**: Includes totals and per-user results

## 🚀 Deployment

### Cloudflare Tunnels (Recommended)
```bash
# Install cloudflared
# Visit: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

# Setup tunnel
./setup-cloudflare-tunnel.sh
```

### Manual Deployment
```bash
# Complete system deployment
./deploy.sh

# Individual services
npm run start:backend    # Backend API
npm run start:frontend   # Frontend (development)
npm run bot             # Discord bot
```

### Docker Deployment
```bash
# Production deployment
docker-compose up -d

# Development with hot reload
docker-compose -f docker-compose.dev.yml up
```

## 🔧 Development

### Scripts
```bash
# Development
npm run dev              # Start both frontend and backend
npm run dev:backend      # Backend only
npm run dev:frontend     # Frontend only

# Building
npm run build            # Build both frontend and backend
npm run build:backend    # Backend only
npm run build:frontend   # Frontend only

# Testing
npm run test            # Run tests
npm run test:backend    # Backend tests
npm run test:frontend    # Frontend tests
```

### Project Structure
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: MongoDB Atlas
- **Authentication**: Discord OAuth2
- **Email**: Nodemailer with SMTP
- **Logging**: Winston with MongoDB transport
- **Automation**: Playwright for browser automation

## 📈 Monitoring & Logging

### System Status
- **Backend Health**: `/api/status`
- **Database Status**: `/api/status/database`
- **Scheduler Status**: `/api/status/scheduler`
- **Memory Usage**: `/api/status/metrics`

### Logging
- **Winston Logger**: Structured logging with multiple transports
- **MongoDB Storage**: Logs stored in database for admin viewing
- **File Logs**: Local file logging for debugging
- **Console Output**: Real-time console logging

### Admin Dashboard
- **Real-time Monitoring**: System health and performance
- **Log Viewer**: Filtered and paginated log viewing
- **User Management**: Complete registration management
- **Analytics**: Claim statistics and trends

## 🔒 Security

### Authentication
- **Discord OAuth2**: Secure admin authentication
- **Session Management**: Express sessions with MongoDB store
- **Rate Limiting**: API rate limiting for security

### Data Protection
- **Environment Variables**: All sensitive data in .env
- **MongoDB Atlas**: Secure cloud database
- **HTTPS**: SSL/TLS encryption via Cloudflare
- **Input Validation**: Comprehensive input sanitization

## 🆘 Troubleshooting

### Common Issues

1. **Discord Bot Not Responding**
   ```bash
   # Check bot status
   sudo systemctl status 8bp-rewards-discord.service
   
   # View logs
   sudo journalctl -u 8bp-rewards-discord.service -f
   ```

2. **Backend API Errors**
   ```bash
   # Check backend status
   sudo systemctl status 8bp-rewards-backend.service
   
   # Test API
   curl http://localhost:2600/health
   ```

3. **Database Connection Issues**
   ```bash
   # Check MongoDB connection
   curl http://localhost:2600/api/status/database
   ```

4. **Frontend Build Issues**
   ```bash
   # Clear cache and rebuild
   cd frontend
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

### Debug Mode
```bash
# Enable debug logging
export LOG_LEVEL=debug
npm run dev:backend
```

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Create GitHub issues for bugs and feature requests
- **Contact**: Use the contact form at `/contact`
- **Discord**: Use `/help` command in Discord for bot assistance

## 🔄 Migration from v1.0

### Breaking Changes
- **Discord Commands**: Several commands removed, new ones added
- **Database Schema**: New models for registration and logging
- **API Structure**: New RESTful API endpoints
- **Authentication**: Discord OAuth2 for admin access

### Migration Steps
1. **Backup Data**: Export existing user mappings
2. **Update Environment**: Add new environment variables
3. **Database Migration**: Run migration scripts
4. **Deploy New Version**: Use deployment script
5. **Test System**: Verify all functionality works

---

**Version**: 2.0.0  
**Last Updated**: 2025  
**Author**: Blake McBride  
**Organization**: EpilDevConnect
