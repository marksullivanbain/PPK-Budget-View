import * as fs from 'fs';
import * as path from 'path';

interface BudgetRow {
  costCenter: string;
  type: string;
  month12Amount: number;
}

// Marketing mapping: Case Group ID -> Practice Cost Center
let marketingMappingCache: Map<string, string> | null = null;

export function parseMarketingMappingCSV(filePath: string): Map<string, string> {
  if (marketingMappingCache) return marketingMappingCache;
  
  try {
    const absolutePath = path.resolve(filePath);
    const content = fs.readFileSync(absolutePath, 'utf-8');
    // Remove BOM if present
    const cleanContent = content.replace(/^\uFEFF/, '');
    const lines = cleanContent.split('\n').filter(line => line.trim());
    
    const mapping = new Map<string, string>();
    
    for (let i = 1; i < lines.length; i++) {
      const fields = parseCSVLine(lines[i]);
      if (fields.length >= 3) {
        const caseGroupId = fields[0]?.trim();
        const practiceCenter = fields[2]?.trim();
        
        if (caseGroupId && practiceCenter) {
          mapping.set(caseGroupId, practiceCenter);
        }
      }
    }
    
    marketingMappingCache = mapping;
    console.log(`Loaded ${mapping.size} marketing practice mappings`);
    return mapping;
  } catch (error) {
    console.error("Error loading marketing mapping CSV:", error);
    return new Map();
  }
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
  caseCode: string;
  caseName: string;
  caseGroupCode: string;
  documentDescription: string;
  postedBy: string;
  vendorName: string;
  period: string;
  sapInvoiceDocUrl: string;
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

function getCategoryFromCaseGroupCode(caseGroupCode: string): string | null {
  if (!caseGroupCode) return null;
  
  // Extract last 4 digits and match:
  // XXXX0201 = General, XXX0203 = Databases, XXX0204 = BCN, XXX0205 = IP
  if (caseGroupCode.endsWith('0201')) return 'General';
  if (caseGroupCode.endsWith('0203')) return 'Databases';
  if (caseGroupCode.endsWith('0204')) return 'BCN';
  if (caseGroupCode.endsWith('0205')) return 'IP';
  
  return null;
}

function getSpendTypeFromAccountType(accountType: string): string {
  if (!accountType) return 'General';
  const normalized = accountType.trim().toLowerCase();
  if (normalized === 'comp' || normalized === 'compensation') {
    return 'Compensation';
  }
  return 'Program';
}

export function parseExpenseCSV(filePath: string, marketingMapping?: Map<string, string>): ExpenseRow[] {
  const absolutePath = path.resolve(filePath);
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const rows: ExpenseRow[] = [];
  let marketingMappedCount = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length >= 65) {
      // Use column Q (index 16) for Practice instead of column A
      let practice = fields[16]?.trim() || '';
      // Use column Y (index 24) for Account Type to determine Comp vs Program
      const accountType = fields[24]?.trim() || '';
      const spendType = getSpendTypeFromAccountType(accountType);
      // Use column S (index 18) for Case Group - program categorization
      const caseGroupCode = fields[18]?.trim() || '';
      const caseCode = fields[20]?.trim() || '';
      const caseName = fields[21]?.trim() || '';
      const summaryAccount = fields[25]?.trim() || '';
      const accountName = fields[27]?.trim() || '';
      const period = fields[31]?.trim() || '';
      const documentDescription = fields[35]?.trim() || '';
      const lineDescription = fields[38]?.trim() || '';
      const postedBy = fields[40]?.trim() || '';
      const vendorName = fields[54]?.trim() || '';
      const sapInvoiceDocUrl = fields[60]?.trim() || '';
      const amount = parseNumber(fields[64]);
      
      // Check if Case Group Code maps to a practice via marketing mapping
      if (marketingMapping && caseGroupCode && marketingMapping.has(caseGroupCode)) {
        practice = marketingMapping.get(caseGroupCode)!;
        marketingMappedCount++;
      }
      
      // Map category based on case group code (column S) for non-Compensation items
      let normalizedSpendType = spendType;
      if (spendType !== 'Compensation') {
        const mappedCategory = getCategoryFromCaseGroupCode(caseGroupCode);
        normalizedSpendType = mappedCategory || normalizeCategory(spendType);
      }
      
      if (practice && spendType) {
        rows.push({ 
          practice, 
          spendType, 
          normalizedSpendType,
          coreProgram: caseGroupCode || null,
          amount,
          lineDescription,
          summaryAccount,
          accountName,
          caseCode,
          caseName,
          caseGroupCode,
          documentDescription,
          postedBy,
          vendorName,
          period,
          sapInvoiceDocUrl
        });
      }
    }
  }
  
  if (marketingMappedCount > 0) {
    console.log(`Mapped ${marketingMappedCount} expenses to practices via marketing mapping`);
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
    
    // Use pre-computed normalizedSpendType which includes Databases detection
    const normalizedType = row.normalizedSpendType;
    const actualMap = categoryActuals.get(row.practice)!;
    const currentActual = actualMap.get(normalizedType) || 0;
    actualMap.set(normalizedType, currentActual + row.amount);
  }
  
  return { costCenters, categoryBudgets, categoryActuals };
}
