# SabiScore Architecture Overview

## System Architecture

SabiScore is built as a modern web application with a clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Data Layer    │
│   (React/Vite)  │◄──►│   (FastAPI)     │◄──►│   (Scrapers)    │
│                 │    │                 │    │                 │
│ - Match Search  │    │ - REST Endpoints│    │ - ESPN API      │
│ - Insights UI   │    │ - Data Validation│    │ - Odds APIs     │
│ - Charts        │    │ - ML Inference  │    │ - Transfermarkt  │
│ - Real-time     │    │ - Caching       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Database      │    │   ML Models      │
                       │   (PostgreSQL)  │    │   (Ensemble)     │
                       │                 │    │                 │
                       │ - Matches       │    │ - Random Forest  │
                       │ - Teams         │    │ - XGBoost        │
                       │ - Predictions   │    │ - LightGBM       │
                       │ - Odds          │    │ - Meta Model     │
                       └─────────────────┘    └─────────────────┘
```

## Core Components

### Backend Architecture

#### API Layer (`src/api/`)
- **FastAPI Application**: Main web framework with automatic OpenAPI docs
- **Pydantic Models**: Request/response validation and serialization
- **Middleware**: CORS, rate limiting, security headers, logging
- **Error Handling**: Consistent error responses and logging

#### Core Systems (`src/core/`)
- **Configuration**: Environment-based settings management
- **Database**: SQLAlchemy ORM with PostgreSQL
- **Cache**: Redis-based caching with TTL management

#### Data Layer (`src/data/`)
- **Aggregator**: Central data collection and processing
- **Scrapers**: BeautifulSoup-based web scraping for sports data
- **Transformers**: Feature engineering and data preprocessing

#### ML Models (`src/models/`)
- **Ensemble Model**: Weighted combination of multiple algorithms
- **Training Pipeline**: Automated model training and validation
- **Explainer**: SHAP-based model interpretability

#### Insights Engine (`src/insights/`)
- **Engine**: Main insights generation orchestration
- **Calculators**: Betting math and value calculations
- **Simulators**: Monte Carlo match outcome simulation

### Frontend Architecture

#### Core Application (`src/main.tsx`, `src/App.tsx`)
- **State Management**: TanStack Query coordinates health checks, insights fetches, and background refetch logic
- **API Integration**: Typed API client (`src/lib/api.ts`) enforces strict response contracts shared with the backend
- **Error Handling**: React Error Boundary surfaces fatal errors; toast notifications provide user feedback on degraded states
- **Routing & Layout**: Suspense-powered lazy loading keeps bundle size lean while preserving glassmorphism layout primitives

#### Components & Utilities
- **Match Selector**: React Hook Form + React Query powered suggestions with automatic league detection
- **Insights Display**: Null-safe rendering across prediction, betting, and team statistics panels with Chart.js doughnut charts
- **Error Boundary**: Class-based boundary hardened with `noImplicitOverride`
- **Testing Utilities**: Jest + Testing Library with global matcher registration in `src/test/setup.ts`

#### Styling
- **Design System**: CSS custom properties and design tokens
- **Component Styles**: Reusable component-specific styles
- **Responsive Design**: Mobile-first approach with breakpoints

## Data Flow

### Match Analysis Request Flow

1. **User Input** → Frontend collects match details
2. **API Request** → Frontend sends request to `/api/v1/insights`
3. **Data Aggregation** → Backend fetches data from multiple sources
4. **Feature Engineering** → Raw data transformed into ML features
5. **Model Inference** → Ensemble model generates predictions
6. **Insights Generation** → Results combined with betting analysis
7. **Response** → Structured insights returned to frontend
8. **UI Rendering** → Results displayed with charts and explanations

### Caching Strategy

- **API Responses**: 5-minute cache for search results
- **Match Data**: 1-hour cache for aggregated match data
- **Model Predictions**: 30-minute cache for repeated requests
- **Static Assets**: Browser caching with versioning

## Security Measures

### API Security
- **Rate Limiting**: 60 requests per minute per IP
- **Input Validation**: Pydantic models prevent malformed data
- **CORS Policy**: Configured origins for frontend access
- **Security Headers**: XSS protection, content type options

### Data Protection
- **Environment Variables**: Sensitive config in `.env`
- **Database Security**: Connection pooling and prepared statements
- **Scraping Ethics**: User-Agent headers and rate limiting

## Performance Optimizations

### Backend
- **Async Processing**: FastAPI async endpoints
- **Database Indexing**: Optimized queries with proper indexing
- **Redis Caching**: Frequently accessed data cached
- **Connection Pooling**: Efficient database connections

### Frontend
- **Code Splitting**: Dynamic imports for components
- **Asset Optimization**: Minified CSS/JS with Vite
- **Lazy Loading**: Charts loaded on demand
- **Responsive Images**: Optimized for different screen sizes

## Deployment Architecture

### Docker Containers
- **Backend**: Python/FastAPI container with ML models
- **Frontend**: Node.js build container with static assets
- **Database**: PostgreSQL with persistent volumes
- **Cache**: Redis for session and data caching

### Production Deployment
- **Orchestration**: Docker Compose for local development
- **Scaling**: Horizontal scaling with load balancers
- **Monitoring**: Health checks and logging aggregation
- **Backup**: Automated database backups

## Development Workflow

### Local Development
1. **Setup**: `docker-compose up --build`
2. **Backend**: Hot reload on code changes
3. **Frontend**: Vite dev server with HMR
4. **Database**: Persistent data with volume mounts

### Testing Strategy
- **Unit Tests**: Individual function/component testing
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Full user journey testing
- **Performance Tests**: Load testing and profiling

### CI/CD Pipeline
- **Automated Testing**: Run all test suites
- **Code Quality**: Linting and type checking
- **Security Scanning**: Dependency vulnerability checks
- **Deployment**: Automated deployment on main branch
