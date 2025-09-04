# Overview

Sabiscore is a football analytics and betting insights platform that provides advanced football predictions and analysis. The application consists of a React-based frontend with a Node.js/Express backend, designed to deliver real-time football match predictions, team statistics, and value betting opportunities. The platform focuses on providing users with comprehensive analytics for various football leagues including Premier League, La Liga, Bundesliga, Serie A, Ligue 1, and Champions League.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript, using Vite as the build tool
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Design System**: Component-based architecture with consistent spacing, colors, and typography

## Backend Architecture
- **Framework**: Express.js with TypeScript in ESM module format
- **Data Layer**: In-memory storage implementation with interface-based design for future database integration
- **API Design**: RESTful endpoints for leagues, matches, predictions, and team statistics
- **Development Setup**: Hot reloading with TSX, custom logging middleware, and error handling

## Component Structure
- **Dashboard-centric Design**: Single-page application with modular components
- **Key Components**: LeagueSelector, UpcomingMatches, AnalyticsDashboard, DetailedAnalysis
- **Responsive Layout**: Mobile-first design with adaptive grid systems
- **Interactive Elements**: Real-time match selection, filtering, and search functionality

## Data Architecture
- **Schema**: Drizzle ORM with PostgreSQL dialect for database operations
- **Models**: Leagues, Teams, Matches, Predictions, and TeamStats with proper relationships
- **Storage Interface**: Abstracted storage layer allowing for multiple backend implementations
- **Data Flow**: RESTful API endpoints serving enriched data with nested relationships

## Development Environment
- **Build System**: Vite with React plugin and runtime error overlay
- **Type Safety**: Strict TypeScript configuration with path mapping
- **Code Quality**: ESLint integration through Vite plugins
- **Development Tools**: Replit-specific plugins for enhanced development experience

# External Dependencies

## Database & ORM
- **Drizzle ORM**: Type-safe database operations with PostgreSQL support
- **Neon Database**: Serverless PostgreSQL database via @neondatabase/serverless

## UI & Design
- **Radix UI**: Comprehensive primitive components for accessibility and functionality
- **Tailwind CSS**: Utility-first CSS framework with custom configuration
- **Lucide React**: Icon library for consistent iconography
- **Class Variance Authority**: Type-safe component variant management

## Data Fetching & State
- **TanStack Query**: Server state management with caching and synchronization
- **React Hook Form**: Form management with validation resolvers

## Development & Build
- **Vite**: Modern build tool with React plugin support
- **TypeScript**: Static type checking and enhanced developer experience
- **PostCSS**: CSS processing with Tailwind and Autoprefixer

## Utility Libraries
- **Date-fns**: Date manipulation and formatting
- **clsx & tailwind-merge**: Conditional class name utilities
- **nanoid**: Unique ID generation
- **Wouter**: Lightweight routing solution