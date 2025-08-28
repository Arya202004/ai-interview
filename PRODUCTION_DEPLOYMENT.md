# 🚀 Production Deployment Guide

This guide provides comprehensive instructions for deploying the AI Interview Assistant to production environments.

## 📋 Prerequisites

### System Requirements
- **Node.js**: 18.17.0 or higher
- **npm**: 9.0.0 or higher
- **Docker**: 20.10 or higher (for containerized deployment)
- **Docker Compose**: 2.0 or higher
- **Memory**: Minimum 4GB RAM, Recommended 8GB+
- **Storage**: 2GB available space
- **Network**: Stable internet connection

### Required Accounts
- **Google Cloud Platform**: For TTS services
- **Google AI Studio**: For Gemini AI
- **Vercel**: For cloud deployment (optional)
- **GitHub**: For source code management

## 🔧 Pre-Deployment Setup

### 1. Environment Configuration

Create `.env.local` from `env.example`:

```bash
cp env.example .env.local
```

Fill in your production values:

```env
# Production environment
NODE_ENV=production
NEXT_PUBLIC_DEBUG_MODE=false

# Google Cloud TTS
GOOGLE_TTS_API_KEY=/path/to/production/service-account.json
GOOGLE_TTS_PROJECT_ID=your-production-project-id

# Gemini AI
GOOGLE_AI_API_KEY=your_production_gemini_key

# Security
API_RATE_LIMIT_WINDOW_MS=900000
API_RATE_LIMIT_MAX_REQUESTS=100
SESSION_SECRET=your-super-secret-production-key

# Performance
NEXT_PUBLIC_MAX_FPS=60
NEXT_PUBLIC_ANTIALIASING=true
```

### 2. Google Cloud Setup

#### Text-to-Speech API
1. **Enable API**:
   ```bash
   gcloud services enable texttospeech.googleapis.com
   ```

2. **Create Service Account**:
   ```bash
   gcloud iam service-accounts create ai-interview-tts \
     --display-name="AI Interview TTS Service Account"
   ```

3. **Assign Roles**:
   ```bash
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:ai-interview-tts@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/texttospeech.user"
   ```

4. **Generate Key**:
   ```bash
   gcloud iam service-accounts keys create service-account-key.json \
     --iam-account=ai-interview-tts@YOUR_PROJECT_ID.iam.gserviceaccount.com
   ```

#### Gemini AI
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Create API key
3. Set quota limits for production use

### 3. Security Configuration

#### API Rate Limiting
```typescript
// src/lib/rateLimiter.ts
import { RateLimiterMemory } from 'rate-limiter-flexible'

export const rateLimiter = new RateLimiterMemory({
  points: 100, // Number of requests
  duration: 900, // Per 15 minutes
})
```

#### CORS Configuration
```typescript
// next.config.ts
async headers() {
  return [
    {
      source: '/api/(.*)',
      headers: [
        {
          key: 'Access-Control-Allow-Origin',
          value: process.env.CORS_ORIGIN || 'https://yourdomain.com'
        }
      ]
    }
  ]
}
```

## 🐳 Docker Deployment

### 1. Build Production Image

```bash
# Build the Docker image
npm run docker:build

# Or manually
docker build -t ai-interview:latest .
```

### 2. Run Container

```bash
# Run with environment file
docker run -d \
  --name ai-interview \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env.local \
  ai-interview:latest

# Or use npm script
npm run docker:run
```

### 3. Docker Compose Deployment

```bash
# Deploy production stack
docker-compose --profile prod up -d

# View logs
docker-compose --profile prod logs -f

# Stop services
docker-compose --profile prod down
```

## ☁️ Cloud Deployment

### 1. Vercel Deployment

#### Automatic Deployment
1. **Connect Repository**:
   - Push code to GitHub
   - Connect repository in Vercel dashboard
   - Set environment variables

2. **Deploy**:
   ```bash
   npm run vercel:deploy
   ```

#### Manual Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### 2. AWS Deployment

#### ECS Fargate
```yaml
# task-definition.json
{
  "family": "ai-interview",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "ai-interview",
      "image": "ai-interview:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ]
    }
  ]
}
```

#### Deploy to ECS
```bash
# Create ECS service
aws ecs create-service \
  --cluster your-cluster \
  --service-name ai-interview \
  --task-definition ai-interview:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-12345],securityGroups=[sg-12345],assignPublicIp=ENABLED}"
```

### 3. Google Cloud Run

```bash
# Build and push to Container Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/ai-interview

# Deploy to Cloud Run
gcloud run deploy ai-interview \
  --image gcr.io/YOUR_PROJECT_ID/ai-interview \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2
```

## 🖥️ Traditional Server Deployment

### 1. Server Setup

#### Ubuntu/Debian
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y
```

#### CentOS/RHEL
```bash
# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo yum install nginx -y
```

### 2. Application Deployment

```bash
# Create deployment directory
sudo mkdir -p /var/www/ai-interview
sudo chown $USER:$USER /var/www/ai-interview

# Upload application files
scp -r ./* user@server:/var/www/ai-interview/

# On server
cd /var/www/ai-interview

# Install dependencies
npm ci --only=production

# Build application
npm run build

# Start with PM2
pm2 start npm --name "ai-interview" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### 3. Nginx Configuration

```nginx
# /etc/nginx/sites-available/ai-interview
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static assets
    location /_next/static/ {
        alias /var/www/ai-interview/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # GLB files
    location ~* \.(glb|gltf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/ai-interview /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🔒 SSL/TLS Configuration

### 1. Let's Encrypt (Free)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 2. Self-Signed Certificate

```bash
# Generate private key
openssl genrsa -out private.key 2048

# Generate certificate
openssl req -new -x509 -key private.key -out certificate.crt -days 365

# Update Nginx configuration
ssl_certificate /path/to/certificate.crt;
ssl_certificate_key /path/to/private.key;
```

## 📊 Monitoring & Logging

### 1. Application Logs

```typescript
// src/lib/logger.ts
import winston from 'winston'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
})

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }))
}
```

### 2. Health Checks

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version
  }
  
  return NextResponse.json(health)
}
```

### 3. Performance Monitoring

```typescript
// src/lib/performance.ts
export const performanceMetrics = {
  avatarLoadTime: 0,
  audioLatency: 0,
  renderFPS: 60,
  memoryUsage: 0
}

export const trackPerformance = (metric: string, value: number) => {
  performanceMetrics[metric] = value
  
  // Send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Send to your monitoring service
  }
}
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Avatar Not Loading
```bash
# Check WebGL support
npm run dev
# Open browser console and look for WebGL errors

# Check file permissions
ls -la public/avatar.glb
```

#### 2. Audio Issues
```bash
# Check microphone permissions
# Verify audio device selection
# Check browser audio settings
```

#### 3. Performance Issues
```bash
# Monitor memory usage
pm2 monit

# Check CPU usage
htop

# Analyze bundle size
npm run analyze
```

#### 4. API Errors
```bash
# Check environment variables
cat .env.local

# Verify API keys
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://generativelanguage.googleapis.com/v1beta/models
```

### Debug Mode

Enable debug mode temporarily:

```env
NEXT_PUBLIC_DEBUG_MODE=true
NODE_ENV=development
```

## 📈 Performance Optimization

### 1. Bundle Optimization

```typescript
// next.config.ts
experimental: {
  optimizePackageImports: ['@react-three/fiber', '@react-three/drei', 'three']
}
```

### 2. Image Optimization

```typescript
// Use Next.js Image component
import Image from 'next/image'

<Image
  src="/avatar.glb"
  alt="3D Avatar"
  width={800}
  height={600}
  priority
/>
```

### 3. Caching Strategy

```typescript
// Service Worker for offline support
// Cache static assets
// Implement stale-while-revalidate
```

## 🔄 CI/CD Pipeline

### 1. GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm run test
      - run: npm run deploy:docker
```

### 2. GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

test:
  stage: test
  script:
    - npm ci
    - npm run test

build:
  stage: build
  script:
    - npm ci
    - npm run build

deploy:
  stage: deploy
  script:
    - npm run deploy:docker
```

## 📚 Additional Resources

- [Next.js Deployment Documentation](https://nextjs.org/docs/deployment)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Nginx Configuration Guide](https://nginx.org/en/docs/)
- [PM2 Process Manager](https://pm2.keymetrics.io/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

## 🆘 Support

If you encounter issues during deployment:

1. Check the troubleshooting section above
2. Review application logs
3. Verify environment configuration
4. Check system requirements
5. Open an issue on GitHub

---

**Happy Deploying! 🚀**
