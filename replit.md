# Expense/Cost Tracking Dashboard

## Overview
An internal expense and cost tracking dashboard for cost center managers. The dashboard displays budget vs actual spending, variance analysis, and program spend breakdowns with a dark-themed UI.

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: TanStack React Query
- **Routing**: Wouter

## Project Structure
```
client/
├── src/
│   ├── components/
│   │   ├── ui/           # shadcn/ui components
│   │   ├── kpi-card.tsx  # KPI metric cards
│   │   ├── spend-type-breakdown.tsx  # Budget vs actual by category
│   │   ├── program-spend-breakdown.tsx  # Program spend details
│   │   └── cost-center-selector.tsx  # Cost center dropdown
│   ├── pages/
│   │   └── dashboard.tsx  # Main dashboard page
│   └── App.tsx           # App entry with routing
server/
├── routes.ts             # API endpoints
├── storage.ts            # In-memory storage with seed data
└── index.ts              # Express server setup
shared/
└── schema.ts             # TypeScript types and Zod schemas
```

## Key Features
- Cost center selection dropdown
- KPI cards showing: Total Spend, Total Budget, Budget Used %, Variance
- Spend Type Breakdown with progress bars per category
- Program Spend Breakdown filtered by amount threshold
- Dark theme UI matching the original design

## API Endpoints
- `GET /api/cost-centers` - List all cost centers
- `GET /api/dashboard/:costCenterId` - Get dashboard summary for a cost center
- `GET /api/cost-centers/:costCenterId/categories` - Get spend categories
- `GET /api/cost-centers/:costCenterId/expenses` - Get expenses

## Data Model
- **CostCenter**: Practice areas (M&A, Tax, Audit)
- **SpendCategory**: Expense categories with budget tracking
- **Budget**: Annual budget allocations per category
- **Expense**: Individual expense items with program categorization

## Running the Application
The application runs on port 5000 via `npm run dev`.
