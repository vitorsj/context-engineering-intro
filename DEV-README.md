# Lawyerless - Development Environment

Complete development setup guide for the Lawyerless contract analysis system.

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Git
- LLM API key (OpenAI or Anthropic)

### One-Command Setup
```bash
make setup
```

This will:
1. Check system requirements
2. Setup environment files
3. Build Docker images
4. Start all services
5. Run health checks

## 📋 Manual Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd Lawerless
```

### 2. Configure Environment
```bash
cp .env.example .env.local
# Edit .env.local and add your API keys
```

### 3. Build and Start
```bash
make build
make start
```

### 4. Verify Installation
```bash
make health
```

## 🏗️ Architecture Overview

```
Lawyerless/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py         # FastAPI application
│   │   ├── models.py       # Pydantic models
│   │   ├── services/       # PDF processing & LLM integration
│   │   ├── agents/         # PydanticAI agents
│   │   └── api/           # API routes
│   ├── tests/             # Backend tests
│   └── Dockerfile.dev     # Development Docker image
├── frontend/              # Next.js frontend
│   ├── src/
│   │   ├── app/          # Next.js 14 app router
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom hooks
│   │   ├── types/        # TypeScript types
│   │   └── utils/        # Utilities (PDF.js config)
│   └── Dockerfile.dev    # Development Docker image
├── docker/               # Docker configuration
├── scripts/              # Development scripts
├── docker-compose.yml    # Development environment
└── Makefile             # Development commands
```

## 🛠️ Services

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3000 | Next.js React application |
| Backend | 8000 | FastAPI REST API |
| Redis | 6379 | WebSocket sessions & caching |
| PostgreSQL | 5432 | Database (optional) |
| Prometheus | 9090 | Metrics (with monitoring profile) |
| Grafana | 3001 | Dashboards (with monitoring profile) |

## 🔧 Development Commands

### Essential Commands
```bash
make help           # Show all available commands
make start          # Start all services
make stop           # Stop all services  
make restart        # Restart all services
make logs           # Show all logs
make health         # Check service health
```

### Service-Specific Commands
```bash
make logs-backend   # Backend logs only
make logs-frontend  # Frontend logs only
make restart-backend    # Restart backend only
make shell-backend  # Access backend container
make shell-frontend # Access frontend container
```

### Code Quality
```bash
make test           # Run all tests
make format         # Format all code
make lint           # Lint all code
make type-check     # Run type checking
```

### Database Operations
```bash
make db-reset       # Reset database
make db-migrate     # Run migrations
make db-backup      # Create backup
make shell-db       # Access PostgreSQL shell
```

## 🧪 Testing

### Backend Testing
```bash
# Run all backend tests
make test-backend

# Run with coverage
make test-backend-coverage

# Run specific test file
docker-compose exec backend python -m pytest tests/test_pdf_processor.py -v
```

### Frontend Testing
```bash
# Run frontend tests
make test-frontend

# Run type checking
docker-compose exec frontend npm run type-check

# Run linting
docker-compose exec frontend npm run lint
```

## 🔍 Development Workflow

### 1. Starting Development
```bash
make start
```

### 2. Making Changes
- Backend code auto-reloads on changes
- Frontend has hot-reload enabled
- Changes reflect immediately in containers

### 3. Running Tests
```bash
make test
```

### 4. Code Quality Checks
```bash
make format
make lint
make type-check
```

### 5. Viewing Logs
```bash
make logs           # All services
make logs-backend   # Backend only
```

## 📁 Key Files

### Configuration Files
- `.env.local` - Main environment configuration
- `backend/.env.local` - Backend-specific config  
- `frontend/.env.local` - Frontend-specific config
- `docker-compose.yml` - Service orchestration
- `Makefile` - Development commands

### Application Entry Points
- `backend/app/main.py` - FastAPI application
- `frontend/src/app/page.tsx` - Next.js home page
- `frontend/src/app/layout.tsx` - Root layout

### Core Components
- `backend/app/services/pdf_processor.py` - PDF processing
- `backend/app/agents/contract_analyzer.py` - LLM analysis
- `frontend/src/components/PDFViewer.tsx` - PDF viewer
- `frontend/src/components/AnalysisPanel.tsx` - Analysis display

## 🚨 Troubleshooting

### Service Won't Start
```bash
# Check logs
make logs-[service]

# Restart specific service
make restart-[service]

# Full reset
make reset
```

### Port Conflicts
```bash
# Check what's using ports
make ports

# Stop all services and restart
make stop
make start
```

### API Key Issues
```bash
# Check environment configuration
make env-check

# Edit configuration
vim .env.local
```

### Database Issues
```bash
# Reset database
make db-reset

# Check database logs
make logs-db

# Access database shell
make shell-db
```

### Frontend Build Issues
```bash
# Clear frontend cache
docker-compose exec frontend npm run clean

# Reinstall dependencies
docker-compose exec frontend rm -rf node_modules
docker-compose exec frontend npm install
```

### Backend Issues
```bash
# Check Python environment
docker-compose exec backend python --version
docker-compose exec backend pip list

# Run diagnostics
docker-compose exec backend python -c "import app; print('App loaded successfully')"
```

## 🔒 Environment Variables

### Required Variables
```bash
# LLM API (choose one)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# LLM Configuration
LLM_PROVIDER=openai  # or anthropic
LLM_MODEL=gpt-4      # or claude-3-sonnet-20240229
```

### Optional Variables
```bash
# Performance
MAX_CONCURRENT_ANALYSES=3
ANALYSIS_TIMEOUT=600

# Features
NEXT_PUBLIC_ENABLE_DEBUG=true
ENABLE_HOT_RELOAD=true
```

## 📊 Monitoring

### With Monitoring Profile
```bash
# Start with monitoring services
make start-monitoring

# Access metrics
open http://localhost:9090  # Prometheus
open http://localhost:3001  # Grafana (admin/admin)
```

### Health Checks
```bash
# Check all services
make health

# Manual health checks
curl http://localhost:8000/health  # Backend
curl http://localhost:3000         # Frontend
```

### Resource Monitoring
```bash
# Show resource usage
make monitor

# View detailed stats
docker stats
```

## 🚀 Production Notes

### Environment Differences
- Use `ENVIRONMENT=production` in production
- Set `DEBUG=false` 
- Use strong secrets for `JWT_SECRET_KEY`
- Enable HTTPS with proper certificates
- Use production database credentials

### Performance Tuning
- Adjust `WORKERS` based on CPU cores
- Increase `MAX_CONCURRENT_ANALYSES` for high load
- Configure Redis for persistence
- Set up database connection pooling

### Security Considerations
- Change all default passwords
- Use environment variables for secrets
- Enable proper CORS settings
- Set up firewall rules
- Regular security updates

## 📚 Additional Resources

- [Backend API Documentation](http://localhost:8000/docs)
- [Frontend README](frontend/README.md)
- [Backend README](backend/README.md)
- [PRP Documentation](PRPs/lawyerless-contract-analyzer.md)

## 🤝 Contributing

1. Make changes in feature branch
2. Run tests: `make test`
3. Check code quality: `make format lint type-check`
4. Ensure health checks pass: `make health`
5. Submit pull request

## 📞 Support

- Check logs: `make logs`
- Run diagnostics: `make health`
- Reset environment: `make reset`
- View help: `make help`

---

🎉 **Happy Development!** The Lawyerless system is now ready for contract analysis development.