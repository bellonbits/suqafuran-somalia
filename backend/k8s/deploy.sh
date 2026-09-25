#!/bin/bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="suqafuran"
APP_NAME="suqafuran-api"
REGISTRY="${DOCKER_REGISTRY:-your-registry}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo -e "${YELLOW}🚀 Deploying Suqafuran Backend to Kubernetes${NC}"

# Check prerequisites
echo -e "\n${YELLOW}📋 Checking prerequisites...${NC}"
command -v kubectl >/dev/null 2>&1 || { echo -e "${RED}kubectl not found${NC}"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo -e "${RED}docker not found${NC}"; exit 1; }

# Build Docker image
echo -e "\n${YELLOW}🔨 Building Docker image...${NC}"
docker build -t "$REGISTRY/$APP_NAME:$IMAGE_TAG" ..
docker push "$REGISTRY/$APP_NAME:$IMAGE_TAG"
echo -e "${GREEN}✅ Docker image built and pushed${NC}"

# Create namespace
echo -e "\n${YELLOW}📦 Creating namespace...${NC}"
kubectl create namespace "$NAMESPACE" 2>/dev/null || echo "Namespace already exists"

# Update image in deployment
echo -e "\n${YELLOW}🔄 Updating deployment image...${NC}"
sed -i '' "s|suqafuran-backend:latest|$REGISTRY/$APP_NAME:$IMAGE_TAG|g" deployment.yaml

# Deploy manifests
echo -e "\n${YELLOW}📦 Deploying Kubernetes manifests...${NC}"
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f hpa.yaml
kubectl apply -f network-policy.yaml
kubectl apply -f pdb.yaml
kubectl apply -f ingress.yaml
echo -e "${GREEN}✅ Manifests deployed${NC}"

# Wait for rollout
echo -e "\n${YELLOW}⏳ Waiting for rollout to complete...${NC}"
kubectl rollout status deployment/$APP_NAME -n "$NAMESPACE" --timeout=5m
echo -e "${GREEN}✅ Rollout completed${NC}"

# Print status
echo -e "\n${YELLOW}📊 Deployment Status${NC}"
echo -e "${GREEN}Pods:${NC}"
kubectl get pods -n "$NAMESPACE" -l app=$APP_NAME

echo -e "\n${GREEN}Service:${NC}"
kubectl get svc -n "$NAMESPACE" -l app=$APP_NAME

echo -e "\n${GREEN}HPA:${NC}"
kubectl get hpa -n "$NAMESPACE"

echo -e "\n${GREEN}Ingress:${NC}"
kubectl get ingress -n "$NAMESPACE"

# Print next steps
echo -e "\n${YELLOW}📝 Next Steps:${NC}"
echo "1. Check pod logs: kubectl logs -f deployment/$APP_NAME -n $NAMESPACE"
echo "2. Monitor HPA: kubectl get hpa -n $NAMESPACE --watch"
echo "3. View all resources: kubectl get all -n $NAMESPACE"
echo "4. Access API at: https://api.suqafuran.com (after DNS setup)"

echo -e "\n${GREEN}✨ Deployment complete!${NC}"
