# Sabiscore - Developer Quick Reference

**🚀 Essential commands and workflows for Sabiscore development**

## ⚡ Quick Start

```bash
# Clone and setup
git clone <repo-url> && cd sabiscore
npm install
npm run dev

# Open browser at http://localhost:5000
```

## 🏗 Project Architecture Overview

```
Frontend (React + TypeScript) ←→ Backend (Express + TypeScript) ←→ Data Layer (In-Memory/PostgreSQL)
     │                                  │                              │
     ├── Shadcn/ui Components          ├── RESTful API Routes         ├── Drizzle ORM
     ├── TanStack Query                 ├── Storage Interface          ├── Type-safe schemas
     └── Tailwind CSS                   └── Prediction Engine          └── Real-time updates
```

## 📁 Key Directories

```bash
client/src/components/    # UI components
client/src/pages/        # Page routes  
server/                  # Backend API
shared/schema.ts         # Type definitions
```

## 🛠 Essential Commands

### Development
```bash
npm run dev              # Start dev server (port 5000)
npm run build           # Production build
npm run type-check      # TypeScript validation
```

### Database
```bash
# In-memory storage (default)
# No additional setup required

# PostgreSQL (production)
npm install pg @types/pg
# Set DATABASE_URL in .env
```

## 🧩 Component Quick Reference

### Adding a New Component

1. **Create component file:**
```typescript
// client/src/components/new-component.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

interface NewComponentProps {
  data: any;
}

export default function NewComponent({ data }: NewComponentProps) {
  const { data: apiData, isLoading } = useQuery<any>({
    queryKey: ["/api/endpoint"],
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Component Title</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Component content */}
      </CardContent>
    </Card>
  );
}
```

2. **Add to parent component:**
```typescript
import NewComponent from "@/components/new-component";

// In parent component JSX:
<NewComponent data={someData} />
```

### Available UI Components

```typescript
// Import from "@/components/ui/*"
import { Button, Card, Badge, Input, Select, Skeleton, Tooltip } from "@/components/ui/...";

// Common patterns:
<Button variant="outline" size="sm">Click me</Button>
<Badge variant="secondary">Label</Badge>
<Skeleton className="h-4 w-32" />
<Tooltip>
  <TooltipTrigger>Hover me</TooltipTrigger>
  <TooltipContent>Tooltip text</TooltipContent>
</Tooltip>
```

## 🌐 API Development

### Adding New API Endpoint

1. **Add to server/routes.ts:**
```typescript
app.get("/api/new-endpoint", async (req, res) => {
  try {
    const data = await storage.getNewData();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Error fetching data" });
  }
});
```

2. **Add storage method (server/storage.ts):**
```typescript
// In IStorage interface:
getNewData(): Promise<DataType[]>;

// In MemStorage class:
async getNewData(): Promise<DataType[]> {
  return Array.from(this.newDataMap.values());
}
```

3. **Use in frontend:**
```typescript
const { data, isLoading } = useQuery<DataType[]>({
  queryKey: ["/api/new-endpoint"],
});
```

## 🎨 Styling Quick Reference

### Tailwind Classes

```css
/* Layout */
flex flex-col items-center justify-between
grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4
max-w-7xl mx-auto px-4 sm:px-6 lg:px-8

/* Colors (using CSS variables) */
bg-background text-foreground
bg-primary text-primary-foreground  
bg-card text-card-foreground
text-muted-foreground

/* Spacing */
p-4 px-6 py-8 m-4 mb-8 space-y-4 space-x-2

/* Effects */
hover:shadow-lg transition-all duration-200
rounded-lg border border-border
```

### Design Tokens
```css
/* CSS Variables (defined in index.css) */
--primary: hsl(210, 60%, 22%)        /* Deep navy */
--secondary: hsl(16, 100%, 60%)      /* Vibrant orange */
--success: hsl(142, 71%, 45%)        /* Green */
--background: hsl(210, 40%, 96%)     /* Light grey */
```

## 📊 Data Flow Patterns

### Adding New Data Type

1. **Define schema (shared/schema.ts):**
```typescript
export const newDataTable = pgTable("new_data", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  value: integer("value"),
});

export const insertNewDataSchema = createInsertSchema(newDataTable).omit({ id: true });
export type NewData = typeof newDataTable.$inferSelect;
export type InsertNewData = z.infer<typeof insertNewDataSchema>;
```

2. **Add to storage interface:**
```typescript
// In IStorage interface
getNewData(): Promise<NewData[]>;
addNewData(data: InsertNewData): Promise<NewData>;

// In MemStorage implementation
private newDataMap: Map<string, NewData>;
```

3. **Create API routes and frontend queries**

## 🧪 Testing Patterns

### Component Testing
```typescript
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Component from './Component';

const queryClient = new QueryClient();

test('renders component correctly', () => {
  render(
    <QueryClientProvider client={queryClient}>
      <Component />
    </QueryClientProvider>
  );
  
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

### API Testing
```typescript
// Test API endpoint
test('GET /api/endpoint returns data', async () => {
  const response = await fetch('/api/endpoint');
  const data = await response.json();
  
  expect(response.status).toBe(200);
  expect(data).toHaveLength(expectedLength);
});
```

## 🐛 Common Issues & Solutions

### TypeScript Errors

**Import path not found:**
```bash
# Check vite.config.ts aliases are correct:
"@": path.resolve(import.meta.dirname, "client", "src")
```

**Type errors in components:**
```typescript
// Always type your props and API responses
interface ComponentProps {
  data: SpecificType;
}

const { data } = useQuery<SpecificType>({
  queryKey: ["/api/endpoint"],
});
```

### React Query Issues

**Data not updating:**
```typescript
// Invalidate queries after mutations
import { queryClient } from "@/lib/queryClient";

queryClient.invalidateQueries({ queryKey: ["/api/endpoint"] });
```

**Loading states:**
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ["/api/endpoint"],
});

if (isLoading) return <Skeleton />;
if (error) return <div>Error loading data</div>;
if (!data) return <div>No data available</div>;
```

### Styling Issues

**Tailwind classes not working:**
```bash
# Check tailwind.config.ts content paths include your files
content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"]
```

**Dark mode not working:**
```typescript
// Ensure dark mode is configured in tailwind.config.ts
darkMode: ["class"]

// Use dark: prefix for dark mode styles
className="bg-white dark:bg-black text-black dark:text-white"
```

## 🚀 Performance Tips

### Component Optimization
```typescript
// Use React.memo for expensive components
import { memo } from 'react';

const ExpensiveComponent = memo(({ data }) => {
  // Heavy computation here
  return <div>{processedData}</div>;
});

// Use useMemo for expensive calculations
const expensiveValue = useMemo(() => {
  return heavyComputation(data);
}, [data]);
```

### Query Optimization
```typescript
// Use staleTime to reduce unnecessary refetches
const { data } = useQuery({
  queryKey: ["/api/endpoint"],
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Prefetch data for better UX
queryClient.prefetchQuery({
  queryKey: ["/api/upcoming-matches"],
});
```

## 📦 Package Management

### Adding Dependencies
```bash
# Frontend dependencies
npm install package-name

# TypeScript types
npm install -D @types/package-name

# Dev dependencies  
npm install -D package-name
```

### Common Dependencies
```typescript
// UI & Styling
"@radix-ui/react-*"     // UI primitives
"tailwindcss"           // CSS framework
"lucide-react"          // Icons

// State Management
"@tanstack/react-query" // Server state
"wouter"               // Routing

// Backend
"express"              // Web framework
"drizzle-orm"          // Database ORM
"tsx"                  // TypeScript execution
```

## 🔧 Environment Setup

### Development Environment
```env
# .env file
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/sabiscore_dev
VITE_API_URL=http://localhost:5000
```

### IDE Configuration (VS Code)
```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

### Recommended Extensions
- TypeScript Importer
- Tailwind CSS IntelliSense  
- ES7+ React/Redux/React-Native snippets
- Auto Rename Tag
- Bracket Pair Colorizer

## 🚨 Emergency Fixes

### Server Won't Start
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Build Failures
```bash
# Check TypeScript errors
npm run type-check

# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

### Database Issues
```bash
# Reset in-memory storage (restart server)
npm run dev

# For PostgreSQL issues
# Check DATABASE_URL in .env
# Verify database is running
```

## 📚 Quick Links

- **Component Library**: `client/src/components/ui/`
- **API Routes**: `server/routes.ts`
- **Type Definitions**: `shared/schema.ts`
- **Styling**: `client/src/index.css`
- **Configuration**: `vite.config.ts`, `tailwind.config.ts`

## 🎯 Production Checklist

```bash
✅ npm run type-check    # No TypeScript errors
✅ npm run build        # Build succeeds
✅ npm run test         # All tests pass
✅ Environment variables set
✅ Database migrations applied
✅ Performance tested
✅ Error handling verified
✅ Security headers configured
```

---

**Need More Help?**
- Check the main [README.md](./README.md)
- Review component source code in `client/src/components/`
- Look at existing API patterns in `server/routes.ts`

*Last Updated: January 2024*