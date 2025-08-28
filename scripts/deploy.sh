#!/bin/bash

# AI Interview Assistant - Production Deployment Script
# This script provides various deployment options for production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="ai-interview"
VERSION=$(node -p "require('./package.json').version")
BUILD_DIR=".next"
DOCKER_IMAGE="ai-interview"
DOCKER_TAG="latest"

# Functions
print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  AI Interview Assistant${NC}"
    echo -e "${BLUE}  Production Deployment${NC}"
    echo -e "${BLUE}================================${NC}"
    echo ""
}

print_step() {
    echo -e "${YELLOW}➤ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

check_prerequisites() {
    print_step "Checking prerequisites..."
    
    # Check Node.js version
    NODE_VERSION=$(node --version)
    if [[ "${NODE_VERSION}" < "v18.17.0" ]]; then
        print_error "Node.js 18.17.0 or higher is required. Current: ${NODE_VERSION}"
        exit 1
    fi
    print_success "Node.js version: ${NODE_VERSION}"
    
    # Check npm version
    NPM_VERSION=$(npm --version)
    if [[ "${NPM_VERSION}" < "9.0.0" ]]; then
        print_error "npm 9.0.0 or higher is required. Current: ${NPM_VERSION}"
        exit 1
    fi
    print_success "npm version: ${NPM_VERSION}"
    
    # Check environment file
    if [[ ! -f ".env.local" ]]; then
        print_error ".env.local file not found. Please create it from env.example"
        exit 1
    fi
    print_success "Environment file found"
    
    echo ""
}

build_application() {
    print_step "Building application..."
    
    # Clean previous build
    if [[ -d "${BUILD_DIR}" ]]; then
        rm -rf "${BUILD_DIR}"
        print_success "Cleaned previous build"
    fi
    
    # Install dependencies
    npm ci --only=production
    print_success "Dependencies installed"
    
    # Build application
    npm run build
    print_success "Application built successfully"
    
    echo ""
}

test_application() {
    print_step "Running tests..."
    
    # Run linting
    npm run lint
    print_success "Linting passed"
    
    # Run type checking
    npm run type-check
    print_success "Type checking passed"
    
    # Run tests if available
    if npm run test --silent 2>/dev/null; then
        print_success "Tests passed"
    else
        print_error "Tests failed or not configured"
        exit 1
    fi
    
    echo ""
}

deploy_docker() {
    print_step "Deploying with Docker..."
    
    # Build Docker image
    docker build -t "${DOCKER_IMAGE}:${DOCKER_TAG}" .
    print_success "Docker image built"
    
    # Stop existing container
    if docker ps -q -f name="${APP_NAME}" | grep -q .; then
        docker stop "${APP_NAME}"
        docker rm "${APP_NAME}"
        print_success "Existing container stopped and removed"
    fi
    
    # Run new container
    docker run -d \
        --name "${APP_NAME}" \
        --restart unless-stopped \
        -p 3000:3000 \
        --env-file .env.local \
        "${DOCKER_IMAGE}:${DOCKER_TAG}"
    
    print_success "Container started successfully"
    echo -e "${GREEN}Application available at: http://localhost:3000${NC}"
    
    echo ""
}

deploy_docker_compose() {
    print_step "Deploying with Docker Compose..."
    
    # Deploy production stack
    docker-compose --profile prod up -d
    
    print_success "Production stack deployed"
    echo -e "${GREEN}Application available at: http://localhost:3000${NC}"
    
    echo ""
}

deploy_vercel() {
    print_step "Deploying to Vercel..."
    
    # Check if Vercel CLI is installed
    if ! command -v vercel &> /dev/null; then
        print_error "Vercel CLI not found. Installing..."
        npm install -g vercel
    fi
    
    # Deploy to Vercel
    vercel --prod
    
    print_success "Deployed to Vercel successfully"
    
    echo ""
}

deploy_traditional() {
    print_step "Deploying to traditional server..."
    
    # Create deployment package
    DEPLOY_DIR="deploy-${VERSION}"
    mkdir -p "${DEPLOY_DIR}"
    
    # Copy necessary files
    cp -r "${BUILD_DIR}" "${DEPLOY_DIR}/"
    cp -r "public" "${DEPLOY_DIR}/"
    cp "package.json" "${DEPLOY_DIR}/"
    cp "package-lock.json" "${DEPLOY_DIR}/"
    cp ".env.local" "${DEPLOY_DIR}/"
    
    # Create deployment script
    cat > "${DEPLOY_DIR}/deploy.sh" << 'EOF'
#!/bin/bash
npm ci --only=production
npm start
EOF
    chmod +x "${DEPLOY_DIR}/deploy.sh"
    
    # Create PM2 ecosystem file
    cat > "${DEPLOY_DIR}/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: 'ai-interview',
    script: 'npm',
    args: 'start',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
EOF
    
    # Create tar archive
    tar -czf "${DEPLOY_DIR}.tar.gz" "${DEPLOY_DIR}"
    
    print_success "Deployment package created: ${DEPLOY_DIR}.tar.gz"
    echo -e "${YELLOW}Upload this file to your server and run:${NC}"
    echo -e "${YELLOW}tar -xzf ${DEPLOY_DIR}.tar.gz${NC}"
    echo -e "${YELLOW}cd ${DEPLOY_DIR}${NC}"
    echo -e "${YELLOW}./deploy.sh${NC}"
    
    # Cleanup
    rm -rf "${DEPLOY_DIR}"
    
    echo ""
}

show_help() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  docker        Deploy using Docker"
    echo "  compose       Deploy using Docker Compose"
    echo "  vercel        Deploy to Vercel"
    echo "  traditional   Create deployment package for traditional server"
    echo "  all           Run all deployment methods"
    echo "  help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 docker"
    echo "  $0 compose"
    echo "  $0 vercel"
    echo "  $0 traditional"
    echo ""
}

# Main script
main() {
    print_header
    
    # Parse command line arguments
    case "${1:-help}" in
        "docker")
            check_prerequisites
            build_application
            test_application
            deploy_docker
            ;;
        "compose")
            check_prerequisites
            build_application
            test_application
            deploy_docker_compose
            ;;
        "vercel")
            check_prerequisites
            build_application
            test_application
            deploy_vercel
            ;;
        "traditional")
            check_prerequisites
            build_application
            test_application
            deploy_traditional
            ;;
        "all")
            check_prerequisites
            build_application
            test_application
            deploy_docker
            deploy_docker_compose
            deploy_vercel
            deploy_traditional
            ;;
        "help"|*)
            show_help
            exit 0
            ;;
    esac
    
    print_success "Deployment completed successfully!"
}

# Run main function with all arguments
main "$@"
