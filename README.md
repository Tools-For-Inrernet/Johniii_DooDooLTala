# Johniii_DooDooLTala

Website HTML Static Meter with **Webvisor** - Session Recording & Replay System

[![Node.js](https://img.shields.io/badge/Node.js-22%20LTS-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What is this?

Johniii_DooDooLTala is a lightweight session recording tool that captures user interactions on your website. It records mouse movements, clicks, scrolling, form inputs, and DOM changes - allowing you to replay and analyze user sessions.

**Use cases:**
- Understand how users interact with your website
- Debug UI issues by watching real user sessions
- Analyze user flows and drop-off points
- Quality assurance and testing

---

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Deploy to Your Server](#deploy-to-your-server)
- [Make it Public](#make-it-public)
- [Add to Your Website](#add-to-your-website)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Privacy & Security](#privacy--security)
- [License](#license)

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Tools-For-Inrernet/Johniii_DooDooLTala.git
cd Johniii_DooDooLTala

# 2. Start the server (requires Node.js 22+)
node src/server/index.js

# 3. Open http://localhost:3000 in your browser
```

That's it! The demo page will load and you can test the recording functionality.

---

## Installation

### Requirements

- **Node.js 22 LTS** or higher ([Download](https://nodejs.org/))
- No additional dependencies required

### Steps

```bash
# Clone the repository
git clone https://github.com/Tools-For-Inrernet/Johniii_DooDooLTala.git

# Navigate to the project
cd Johniii_DooDooLTala

# Verify Node.js version
node --version  # Should be v22.x.x or higher

# Start the server
node src/server/index.js
```

---

## Deploy to Your Server

### Option 1: Traditional VPS/Dedicated Server

#### 1. Upload Files

```bash
# Using SCP
scp -r Johniii_DooDooLTala user@your-server.com:/var/www/

# Or using rsync
rsync -avz Johniii_DooDooLTala user@your-server.com:/var/www/
```

#### 2. Install Node.js 22 on Server

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo yum install -y nodejs

# Verify installation
node --version
```

#### 3. Start the Server

```bash
cd /var/www/Johniii_DooDooLTala

# Set environment variables
export PORT=3000
export HOST=0.0.0.0
export DATA_PATH=/var/www/Johniii_DooDooLTala/data/sessions

# Start server
node src/server/index.js
```

#### 4. Run as a Service (Recommended)

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/webvisor.service
```

```ini
[Unit]
Description=Webvisor Session Recording Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/Johniii_DooDooLTala
ExecStart=/usr/bin/node src/server/index.js
Restart=on-failure
RestartSec=10
Environment=PORT=3000
Environment=HOST=0.0.0.0
Environment=DATA_PATH=/var/www/Johniii_DooDooLTala/data/sessions
Environment=RETENTION_DAYS=15

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable webvisor
sudo systemctl start webvisor

# Check status
sudo systemctl status webvisor
```

---

### Option 2: Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY . .

RUN mkdir -p /app/data/sessions

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATA_PATH=/app/data/sessions

CMD ["node", "src/server/index.js"]
```

Build and run:

```bash
# Build image
docker build -t webvisor .

# Run container
docker run -d \
  --name webvisor \
  -p 3000:3000 \
  -v webvisor-data:/app/data \
  webvisor

# View logs
docker logs -f webvisor
```

#### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  webvisor:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - webvisor-data:/app/data
    environment:
      - PORT=3000
      - HOST=0.0.0.0
      - RETENTION_DAYS=15
    restart: unless-stopped

volumes:
  webvisor-data:
```

Run:

```bash
docker-compose up -d
```

---

### Option 3: Cloud Platforms

#### Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

#### Deploy to Render

1. Connect your GitHub repository to [Render](https://render.com)
2. Create a new **Web Service**
3. Set build command: `(none)`
4. Set start command: `node src/server/index.js`
5. Add environment variables

#### Deploy to DigitalOcean App Platform

1. Fork this repository
2. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
3. Create App > GitHub > Select repository
4. Configure:
   - Run Command: `node src/server/index.js`
   - HTTP Port: `3000`

---

## Make it Public

### Step 1: Configure Reverse Proxy (Nginx)

```bash
sudo nano /etc/nginx/sites-available/webvisor
```

```nginx
server {
    listen 80;
    server_name webvisor.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/webvisor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 2: Add SSL Certificate (HTTPS)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d webvisor.yourdomain.com

# Auto-renewal is configured automatically
```

### Step 3: Configure DNS

Add an A record in your domain's DNS settings:

| Type | Name | Value |
|------|------|-------|
| A | webvisor | YOUR_SERVER_IP |

### Step 4: Configure Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Enable firewall
sudo ufw enable
```

---

## Add to Your Website

### Basic Integration

Add this script to any page you want to track:

```html
<script type="module">
  import { Webvisor } from 'https://webvisor.yourdomain.com/src/client/Webvisor.js';

  const webvisor = new Webvisor({
    endpoint: 'https://webvisor.yourdomain.com/api/webvisor/events',
    samplingRate: 100  // Record 100% of sessions
  });

  webvisor.start();
</script>
```

### With Privacy Controls

```html
<script type="module">
  import { Webvisor } from 'https://webvisor.yourdomain.com/src/client/Webvisor.js';

  const webvisor = new Webvisor({
    endpoint: 'https://webvisor.yourdomain.com/api/webvisor/events',
    samplingRate: 50,  // Record 50% of sessions
    privacy: {
      maskAllInputs: false,
      maskSensitiveInputs: true,
      excludeAttribute: 'data-no-record',
      excludePages: [
        '/admin/.*',
        '/checkout/.*',
        '/account/.*'
      ]
    }
  });

  webvisor.start();
</script>
```

### Exclude Sensitive Elements

```html
<!-- This section won't be recorded -->
<div data-ym-disable>
  <form id="payment-form">
    <input type="text" name="card-number">
    <input type="text" name="cvv">
  </form>
</div>
```

### NPM Package (Coming Soon)

```bash
npm install johniii-webvisor
```

```javascript
import { Webvisor } from 'johniii-webvisor';

const webvisor = new Webvisor({ /* config */ });
webvisor.start();
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server listening port |
| `HOST` | `0.0.0.0` | Server bind address |
| `DATA_PATH` | `./data/sessions` | Session storage path |
| `RETENTION_DAYS` | `15` | Days to keep sessions |

### Client Options

```javascript
{
  // Server endpoint
  endpoint: '/api/webvisor/events',

  // Sampling rate (0-100%)
  samplingRate: 100,

  // Batch settings
  batchSize: 50,
  batchInterval: 1000,

  // Throttling
  mouseThrottle: 50,
  scrollThrottle: 100,

  // Privacy
  privacy: {
    maskAllInputs: false,
    maskSensitiveInputs: true,
    excludeAttribute: 'data-ym-disable',
    excludePages: []
  }
}
```

---

## API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/webvisor/events` | Receive event batches |
| `GET` | `/api/webvisor/sessions` | List all sessions |
| `GET` | `/api/webvisor/sessions/:id` | Get session details |
| `DELETE` | `/api/webvisor/sessions/:id` | Delete a session |

### Example: List Sessions

```bash
curl https://webvisor.yourdomain.com/api/webvisor/sessions
```

```json
{
  "sessions": [
    {
      "sessionId": "wv_m3x7k_abc123",
      "updatedAt": 1700000000000,
      "size": 15234
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

### Example: Get Session

```bash
curl https://webvisor.yourdomain.com/api/webvisor/sessions/wv_m3x7k_abc123
```

---

## Privacy & Security

### Automatic Masking

These fields are automatically masked:
- Password inputs (`type="password"`)
- Credit card fields
- Fields with names containing: `password`, `credit`, `card`, `cvv`, `ssn`, `secret`, `token`

### Exclude Elements

Add `data-ym-disable` attribute:

```html
<div data-ym-disable>
  <!-- Content here is not recorded -->
</div>
```

### Exclude Pages

Configure page patterns:

```javascript
privacy: {
  excludePages: [
    '/admin/.*',
    '/private/.*'
  ]
}
```

### Security Recommendations

1. **Use HTTPS** - Always serve over SSL in production
2. **Restrict Access** - Add authentication to the API endpoints
3. **Limit Retention** - Set appropriate `RETENTION_DAYS`
4. **Monitor Storage** - Watch disk usage for session data
5. **GDPR Compliance** - Inform users about session recording

---

## Project Structure

```
Johniii_DooDooLTala/
├── index.html              # Demo page
├── package.json            # Node.js config
├── src/
│   ├── client/             # Browser SDK
│   │   ├── Webvisor.js     # Main client
│   │   └── recorder/       # Event recorders
│   ├── server/             # Node.js server
│   │   ├── index.js        # Entry point
│   │   ├── routes/         # API routes
│   │   └── storage/        # Session storage
│   └── shared/             # Shared constants
├── docs/
│   └── WEBVISOR.md         # Detailed documentation
└── data/
    └── sessions/           # Stored sessions (auto-created)
```

---

## Troubleshooting

### Server won't start

```bash
# Check Node.js version (must be 22+)
node --version

# Check if port is in use
lsof -i :3000

# Check logs
journalctl -u webvisor -f
```

### Events not recording

1. Check browser console for errors
2. Verify endpoint URL is correct
3. Check CORS headers if cross-origin
4. Ensure sampling rate > 0

### High disk usage

```bash
# Check session storage size
du -sh /var/www/Johniii_DooDooLTala/data/sessions

# Reduce retention period
export RETENTION_DAYS=7
```

---

## License

MIT License - 2025 Tools for Internet

See [LICENSE](LICENSE) for full text.

---

## Links

- [Detailed Documentation](docs/WEBVISOR.md)
- [Report Issues](https://github.com/Tools-For-Inrernet/Johniii_DooDooLTala/issues)
