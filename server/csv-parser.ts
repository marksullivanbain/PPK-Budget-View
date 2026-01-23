import * as fs from 'fs';
import * as path from 'path';

interface BudgetRow {
  costCenter: string;
  type: string;
  month12Amount: number;
}

export interface ExpenseRow {
  practice: string;
  spendType: string;
  normalizedSpendType: string;
  coreProgram: string | null;
  amount: number;
  // Detail fields
  lineDescription: string;
  summaryAccount: string;
  accountName: string;
  caseName: string;
  postedBy: string;
  vendorName: string;
  period: string;
}

function parseNumber(value: string): number {
  if (!value || value.trim() === '') return 0;
  const cleaned = value.replace(/[",\s]/g, '').replace(/^\(/, '-').replace(/\)$/, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseBudgetCSV(filePath: string): BudgetRow[] {
  const absolutePath = path.resolve(filePath);
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const rows: BudgetRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length >= 30) {
      const costCenter = fields[0]?.trim();
      const type = fields[1]?.trim();
      const month12Amount = parseNumber(fields[29]);
      
      if (costCenter && type) {
        rows.push({ costCenter, type, month12Amount });
      }
    }
  }
  
  return rows;
}

export function parseExpenseCSV(filePath: string): ExpenseRow[] {
  const absolutePath = path.resolve(filePath);
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const rows: ExpenseRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length >= 65) {
      const practice = fields[0]?.trim();
      const spendType = fields[1]?.trim();
      const coreProgram = fields[2]?.trim();
      const caseName = fields[21]?.trim() || '';
      const summaryAccount = fields[25]?.trim() || '';
      const accountName = fields[27]?.trim() || '';
      const period = fields[31]?.trim() || '';
      const lineDescription = fields[38]?.trim() || '';
      const postedBy = fields[40]?.trim() || '';
      const vendorName = fields[54]?.trim() || '';
      const amount = parseNumber(fields[64]);
      
      if (practice && spendType) {
        rows.push({ 
          practice, 
          spendType, 
          normalizedSpendType: normalizeCategory(spendType),
          coreProgram: coreProgram && coreProgram !== "z.Not Program" ? coreProgram : null,
          amount,
          lineDescription,
          summaryAccount,
          accountName,
          caseName,
          postedBy,
          vendorName,
          period
        });
      }
    }
  }
  
  return rows;
}

export interface AggregatedData {
  costCenters: Map<string, { name: string; description: string }>;
  categoryBudgets: Map<string, Map<string, number>>;
  categoryActuals: Map<string, Map<string, number>>;
}

export function normalizeCategory(category: string): string {
  const normalized = category.trim();
  if (normalized === "Program" || normalized === "Programs") {
    return "General";
  }
  return normalized;
}

export function aggregateData(budgetRows: BudgetRow[], expenseRows: ExpenseRow[]): AggregatedData {
  const costCenters = new Map<string, { name: string; description: string }>();
  const categoryBudgets = new Map<string, Map<string, number>>();
  const categoryActuals = new Map<string, Map<string, number>>();
  
  for (const row of budgetRows) {
    if (!costCenters.has(row.costCenter)) {
      costCenters.set(row.costCenter, {
        name: row.costCenter,
        description: `${row.costCenter} cost center`
      });
    }
    
    if (!categoryBudgets.has(row.costCenter)) {
      categoryBudgets.set(row.costCenter, new Map());
    }
    
    const normalizedType = normalizeCategory(row.type);
    const budgetMap = categoryBudgets.get(row.costCenter)!;
    const currentBudget = budgetMap.get(normalizedType) || 0;
    budgetMap.set(normalizedType, currentBudget + row.month12Amount);
  }
  
  for (const row of expenseRows) {
    if (!costCenters.has(row.practice)) {
      costCenters.set(row.practice, {
        name: row.practice,
        description: `${row.practice} cost center`
      });
    }
    
    if (!categoryActuals.has(row.practice)) {
      categoryActuals.set(row.practice, new Map());
    }
    
    const normalizedType = normalizeCategory(row.spendType);
    const actualMap = categoryActuals.get(row.practice)!;
    const currentActual = actualMap.get(normalizedType) || 0;
    actualMap.set(normalizedType, currentActual + row.amount);
  }
  
  return { costCenters, categoryBudgets, categoryActuals };
}
