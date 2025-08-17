# Interview Assistant - Build and Deployment Scripts

Utility scripts for building, testing, and deploying the Interview Assistant application.

## Scripts

### Development
- `dev.sh` - Start development environment
- `test.sh` - Run all tests
- `lint.sh` - Run code quality checks

### Build
- `build-backend.sh` - Build backend JAR
- `build-frontend.sh` - Build frontend production bundle
- `build-docker.sh` - Build Docker images

### Deployment
- `deploy-dev.sh` - Deploy to development environment
- `deploy-staging.sh` - Deploy to staging environment
- `deploy-prod.sh` - Deploy to production environment

### Utilities
- `setup-env.sh` - Set up environment variables
- `check-deps.sh` - Check required dependencies
- `clean.sh` - Clean build artifacts

## Usage

Make scripts executable:
```bash
chmod +x scripts/*.sh
```

Run a script:
```bash
./scripts/dev.sh
```

## Requirements

- Bash 4+
- Docker
- Node.js 18+
- Java 17+
- Maven 3.8+