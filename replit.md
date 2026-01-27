# Expense/Cost Tracking Dashboard

## Overview
An internal expense and cost tracking dashboard for cost center managers. The dashboard displays budget vs actual spending, variance analysis, and program spend breakdowns with a dark-themed UI. Access is controlled via email-based authentication.

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL (for auth sessions)
- **Authentication**: Replit Auth (OpenID Connect)
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
- **Authentication**: Users must log in via Replit Auth (Google, GitHub, email, etc.)
- **Access Control**: Users only see practices they're assigned to in the security access table
- Cost center selection dropdown (19 cost centers from CSV data)
- KPI cards showing: Total Spend, Total Budget, Budget Used %, Variance (all rounded to nearest dollar)
- Spend Type Breakdown with progress bars per category
- Program Spend Breakdown: Groups by Account Name (column AB), excludes Compensation, shows items ≥$1k
- Total Program Spend = Total Spend minus Compensation actual
- **Expense Details Drill-Down**: Click any category or program to see individual expense line items with search and period filters
- Dark theme UI matching the original design

## Access Control
- Security table: `attached_assets/Replit_Security_Access_Table_*.csv`
- Format: Practice Name, eCode, Employee Name, Bain email
- Email matching: Extracts email from "Name <email@bain.com>" format, case-insensitive
- Users see only practices mapped to their email address
- If user's email is not in the table, they see no practices

## Data Source
- Budget data: `attached_assets/2025_Budget_by_Category_-_Dec*.csv` - December 2025 budget allocations
- Expense data: `attached_assets/Full_Practice_Expense_data_(2025)*.csv` - Full year 2025, 53,413 expense records (~40MB)
- Marketing mapping: `attached_assets/Replit_Marketing_Mapping_Table_*.csv` - Maps Case Group IDs to practices

## Expense Column Mapping (Full Year 2025 file format)
- **Practice**: Column L (index 11) - Cost Center Name - overridden by marketing mapping when Case Group ID matches
- **Spend Type**: Column T (index 19) - Account Type: "Comp" → Compensation, else → Program
- **Category**: Column N (index 13) - Case Group Code determines subcategory:
  - XXXX0201 = General
  - XXXX0203 = Databases
  - XXXX0204 = BCN
  - XXXX0205 = IP
  - Fallback: "Program" expenses map to "General" budget category
- Marketing practice mapping: Expenses with matching Case Group IDs are automatically assigned to practices (e.g., 56500008 → M&A Practice)
- Program grouping: Uses Account Name (column W, index 22) for more granular breakdown

## Practice Consolidation Mapping
The following practices are consolidated for reporting:
- HC Practice → HLS Practice
- Strategy & Transformation Practice, Bain Futures Practice, Transform & Chg Practice → S&T Practice
- Vector Practice, I&D Practice → AIS Practice
- DE&I Practice, SI Practice → Further Practice
- CME Practice → TMT Practice
- Practice Area Prgrm Office → Practice Area Program Office (spelling normalization)
- Industry Marketing (fallback) → Other Industry

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
