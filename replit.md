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
│   │   ├── expense-details.tsx  # Expense drill-down table
│   │   └── cost-center-selector.tsx  # Cost center dropdown
│   ├── pages/
│   │   └── dashboard.tsx  # Main dashboard page
│   └── App.tsx           # App entry with routing
server/
├── routes.ts             # API endpoints
├── storage.ts            # In-memory storage with CSV data
├── csv-parser.ts         # CSV file parsing utilities
└── index.ts              # Express server setup
shared/
└── schema.ts             # TypeScript types and Zod schemas
```

## Key Features
- Cost center selection dropdown (16 cost centers from CSV data)
- KPI cards showing: Total Spend, Total Budget, Budget Used %, Variance
- Spend Type Breakdown with progress bars per category
- Program Spend Breakdown filtered by amount threshold
- **Expense Details Drill-Down**: Click any category or program to see individual expense line items with search and period filters
- Dark theme UI matching the original design

## Data Source
- Budget data: `attached_assets/2025_Budget_by_Category_-_Dec*.csv` - December 2025 budget allocations
- Expense data: `attached_assets/Full_Practice_Expense_data_(Dec_2025)*.csv` - 5,814 expense records
- Category mapping: "Program" expenses map to "General" budget category

## API Endpoints
- `GET /api/cost-centers` - List all cost centers
- `GET /api/dashboard/:costCenterId` - Get dashboard summary for a cost center
- `GET /api/cost-centers/:costCenterId/categories` - Get spend categories
- `GET /api/cost-centers/:costCenterId/expenses` - Get expenses
- `GET /api/cost-centers/:costCenterId/expense-details?filterType=category|program&filterValue=value` - Get expense line items for drill-down

## Data Model
- **CostCenter**: Practice areas (M&A, Tax, Audit)
- **SpendCategory**: Expense categories with budget tracking
- **Budget**: Annual budget allocations per category
- **Expense**: Individual expense items with program categorization

## Running the Application
The application runs on port 5000 via `npm run dev`.
