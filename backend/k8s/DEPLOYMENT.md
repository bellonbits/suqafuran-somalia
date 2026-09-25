# Kubernetes Deployment Guide for Suqafuran Backend

## Overview
This guide covers deploying the Suqafuran API to Kubernetes with high availability, auto-scaling, and proper timeout configurations.

## Prerequisites
- Kubernetes cluster (v1.20+)
- kubectl CLI
- Docker registry access
- nginx-ingress controller
- cert-manager (for SSL)
- metrics-server (for HPA)

## Architecture
- **3-10 replicas** (auto-scaled based on CPU/Memory)
- **Multi-zone deployment** (pod anti-affinity)
- **Health checks** (liveness, readiness, startup probes)
- **Network policies** for security
- **Pod Disruption Budget** for high availability

## Deployment Steps

### 1. Build Docker Image
```bash
cd /Users/mac/suqafuran/backend
docker build -t suqafuran-backend:latest .
docker tag suqafuran-backend:latest your-registry/suqafuran-backend:latest
docker push your-registry/suqafuran-backend:latest
```

### 2. Create Secrets
```bash
kubectl create secret generic suqafuran-secrets \
  --from-literal=DATABASE_URL='postgresql://...' \
  --from-literal=REDIS_URL='redis://...' \
  --from-literal=API_KEY='...' \
  -n suqafuran
```

### 3. Deploy to Kubernetes
```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Create ConfigMap
kubectl apply -f k8s/configmap.yaml

# Deploy API
kubectl apply -f k8s/deployment.yaml

# Create Service
kubectl apply -f k8s/service.yaml

# Set up Auto-scaling
kubectl apply -f k8s/hpa.yaml

# Network Policy
kubectl apply -f k8s/network-policy.yaml

# Pod Disruption Budget
kubectl apply -f k8s/pdb.yaml

# Ingress
kubectl apply -f k8s/ingress.yaml
```

### 4. Verify Deployment
```bash
# Check pods are running
kubectl get pods -n suqafuran

# Check rollout status
kubectl rollout status deployment/suqafuran-api -n suqafuran

# Check HPA status
kubectl get hpa -n suqafuran

# View logs
kubectl logs -f deployment/suqafuran-api -n suqafuran
```

## Key Configurations

### Timeouts
- **REQUEST_TIMEOUT**: 60 seconds (total request time)
- **DATABASE_TIMEOUT**: 30 seconds (DB queries)
- **CACHE_TIMEOUT**: 300 seconds (cache entries)
- **EXTERNAL_API_TIMEOUT**: 45 seconds (external API calls)

### Resource Limits
- **Requests**: 256m CPU, 512Mi memory
- **Limits**: 500m CPU, 1Gi memory
- **Min Replicas**: 3
- **Max Replicas**: 10

### Health Checks
- **Liveness**: Checks every 10s, fails after 3 attempts (30s total)
- **Readiness**: Checks every 5s, fails after 2 attempts (10s total)
- **Startup**: Allows 30 attempts (300s) for initial startup

### Database Connection Pool
- **Pool Size**: 20 connections
- **Max Overflow**: 40 additional connections
- **Pool Timeout**: 30 seconds
- **Pool Recycle**: 3600 seconds (connection refresh)

## Scaling

### Manual Scaling
```bash
kubectl scale deployment suqafuran-api --replicas=5 -n suqafuran
```

### Auto-scaling Configuration
The HPA will automatically scale based on:
- **CPU**: Target 70% utilization
- **Memory**: Target 80% utilization
- Scale up: +100% every 30 seconds
- Scale down: -50% every 60 seconds after 5 minute stability

## Monitoring

### View Metrics
```bash
kubectl top pods -n suqafuran
kubectl top nodes
```

### Check HPA Metrics
```bash
kubectl get hpa suqafuran-api-hpa -n suqafuran --watch
```

### Logs
```bash
# All pods
kubectl logs -f deployment/suqafuran-api -n suqafuran

# Specific pod
kubectl logs -f pod-name -n suqafuran

# Last 1000 lines
kubectl logs --tail=1000 deployment/suqafuran-api -n suqafuran
```

## Updates & Rollouts

### Rolling Update
```bash
kubectl set image deployment/suqafuran-api \
  api=your-registry/suqafuran-backend:v2.0 \
  -n suqafuran

# Monitor rollout
kubectl rollout status deployment/suqafuran-api -n suqafuran
```

### Rollback
```bash
kubectl rollout undo deployment/suqafuran-api -n suqafuran
```

## Performance Optimization

1. **Connection Pooling**: Configured for 20-60 concurrent connections
2. **Caching**: 5min for listings/shops, 1hr for categories
3. **Compression**: Response gzip compression enabled
4. **Rate Limiting**: 1000 req/min per IP
5. **Timeouts**: Aggressive timeouts to prevent hanging requests

## Production Checklist

- [ ] Update DATABASE_URL in secrets
- [ ] Update REDIS_URL in secrets
- [ ] Set ENVIRONMENT=production in configmap
- [ ] Configure API_KEY and sensitive data
- [ ] Set up monitoring and alerting
- [ ] Configure persistent volumes if needed
- [ ] Enable HTTPS/TLS
- [ ] Set up log aggregation
- [ ] Configure backup strategy
- [ ] Test failover scenarios

## Troubleshooting

### Pods not starting
```bash
kubectl describe pod pod-name -n suqafuran
kubectl logs pod-name -n suqafuran
```

### Slow responses
- Check HPA metrics: `kubectl get hpa -n suqafuran`
- Check database connections: Look at pool utilization
- Check external API timeouts in logs

### High memory usage
- Increase CACHE_TTL to reduce memory overhead
- Reduce MAX_REPLICAS if cluster is limited
- Check for memory leaks in application logs

### Connection pool exhaustion
- Increase DB_POOL_SIZE in configmap
- Reduce DATABASE_TIMEOUT to close idle connections faster
- Check for long-running queries

## Health Endpoint

The deployment expects a `/health` endpoint that returns 200 OK:
```bash
curl http://localhost:8000/health
```

This should be implemented in your FastAPI app:
```python
@app.get("/health")
async def health():
    return {"status": "healthy"}
```
