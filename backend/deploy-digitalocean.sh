#!/bin/bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 DigitalOcean Deployment Script${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"
command -v docker >/dev/null 2>&1 || { echo -e "${RED}Docker not found${NC}"; exit 1; }
command -v doctl >/dev/null 2>&1 || { echo -e "${RED}doctl CLI not found. Install: https://docs.digitalocean.com/reference/doctl/how-to/install/${NC}"; exit 1; }

echo -e "${GREEN}✅ Docker and doctl found${NC}"
echo ""

# Get deployment option
echo -e "${YELLOW}Choose deployment method:${NC}"
echo "1) App Platform (easiest)"
echo "2) Kubernetes/DOKS (recommended for scale)"
echo "3) Droplet (simplest)"
read -p "Enter choice (1-3): " DEPLOY_METHOD

case $DEPLOY_METHOD in
  1)
    echo -e "${YELLOW}📦 Building Docker image...${NC}"
    docker build -t suqafuran-backend:latest .

    read -p "Enter Docker Hub username: " DOCKER_USER
    read -sp "Enter Docker Hub password: " DOCKER_PASS
    echo ""

    echo -e "${YELLOW}📤 Pushing to Docker Hub...${NC}"
    docker login -u "$DOCKER_USER" -p "$DOCKER_PASS"
    docker tag suqafuran-backend:latest $DOCKER_USER/suqafuran-backend:latest
    docker push $DOCKER_USER/suqafuran-backend:latest

    echo -e "${GREEN}✅ Image pushed to Docker Hub${NC}"
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Go to DigitalOcean Dashboard → Apps"
    echo "2. Click 'Create App'"
    echo "3. Select 'Docker Image'"
    echo "4. Use: $DOCKER_USER/suqafuran-backend:latest"
    echo "5. Add environment variables (see DIGITALOCEAN_DEPLOYMENT.md)"
    ;;

  2)
    echo -e "${YELLOW}🐳 Building Docker image...${NC}"
    docker build -t suqafuran-backend:latest .

    read -p "Enter DigitalOcean registry name (e.g., suqafuran): " REGISTRY_NAME

    echo -e "${YELLOW}🔑 Authenticating with DigitalOcean...${NC}"
    doctl registry login

    echo -e "${YELLOW}📤 Pushing to DigitalOcean Registry...${NC}"
    docker tag suqafuran-backend:latest registry.digitalocean.com/$REGISTRY_NAME/backend:latest
    docker push registry.digitalocean.com/$REGISTRY_NAME/backend:latest

    read -p "Enter Kubernetes cluster name: " K8S_CLUSTER

    echo -e "${YELLOW}📥 Getting kubeconfig...${NC}"
    doctl kubernetes cluster kubeconfig save $K8S_CLUSTER

    echo -e "${YELLOW}🚀 Deploying to Kubernetes...${NC}"

    # Update deployment image
    sed -i '' "s|suqafuran-backend:latest|registry.digitalocean.com/$REGISTRY_NAME/backend:latest|g" k8s/deployment.yaml

    # Create namespace
    kubectl apply -f k8s/namespace.yaml

    # Create secrets
    echo -e "${YELLOW}Enter database credentials:${NC}"
    read -sp "DATABASE_URL: " DB_URL
    echo ""
    read -sp "REDIS_URL: " REDIS_URL
    echo ""

    kubectl create secret generic suqafuran-secrets \
      --from-literal=DATABASE_URL="$DB_URL" \
      --from-literal=REDIS_URL="$REDIS_URL" \
      -n suqafuran --dry-run=client -o yaml | kubectl apply -f -

    # Deploy
    kubectl apply -f k8s/configmap.yaml
    kubectl apply -f k8s/deployment.yaml
    kubectl apply -f k8s/service.yaml
    kubectl apply -f k8s/hpa.yaml
    kubectl apply -f k8s/ingress.yaml
    kubectl apply -f k8s/network-policy.yaml
    kubectl apply -f k8s/pdb.yaml

    echo -e "${GREEN}✅ Deployed to Kubernetes!${NC}"
    echo ""
    echo -e "${YELLOW}Verify deployment:${NC}"
    echo "kubectl get pods -n suqafuran"
    echo "kubectl logs -f deployment/suqafuran-api -n suqafuran"
    ;;

  3)
    echo -e "${YELLOW}🖥️  Creating Droplet...${NC}"

    read -p "Enter droplet name (e.g., suqafuran-api): " DROPLET_NAME
    read -p "Enter SSH key name (or press Enter to create new): " SSH_KEY

    doctl compute droplet create $DROPLET_NAME \
      --image ubuntu-22-04-x64 \
      --size s-2vcpu-4gb \
      --region nyc3 \
      --enable-monitoring

    echo -e "${YELLOW}Waiting for droplet to be ready...${NC}"
    sleep 30

    DROPLET_IP=$(doctl compute droplet get $DROPLET_NAME --format PublicIPv4 --no-header)

    echo -e "${GREEN}✅ Droplet created: $DROPLET_IP${NC}"
    echo ""
    echo -e "${YELLOW}Next steps (SSH into droplet):${NC}"
    echo "ssh root@$DROPLET_IP"
    echo ""
    echo "Then follow the Droplet deployment steps in DIGITALOCEAN_DEPLOYMENT.md"
    ;;

  *)
    echo -e "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}✨ Deployment initiated!${NC}"
echo -e "${YELLOW}📖 See DIGITALOCEAN_DEPLOYMENT.md for complete guide${NC}"
