import { 
  type User, 
  type InsertUser, 
  type CostCenter,
  type InsertCostCenter,
  type SpendCategory,
  type InsertSpendCategory,
  type Budget,
  type InsertBudget,
  type Expense,
  type InsertExpense,
  type DashboardSummary,
  type SpendTypeBreakdown,
  type ProgramSpendItem,
  type AccountSpendItem,
  type ExpenseDetail,
  type MonthlyTrendData,
  type KeyVarianceItem,
  type IPTeamEntry,
  type IPTeamData,
  type IPTeamSummary,
  type BudgetGroup,
  type InsertBudgetGroup,
  type CaseCodeMapping,
  type InsertCaseCodeMapping,
  type CaseCodeWithExpense,
  type BudgetGroupWithCodes,
  type DynamicBudgetData,
  budgetGroups,
  caseCodeMappings
} from "@shared/schema";
import { randomUUID } from "crypto";
import { parseBudgetCSV, parseExpenseCSV, parseMarketingMappingCSV, aggregateData, parseIPTeamsCSV, type IPTeamRow } from "./csv-parser";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getCostCenters(): Promise<CostCenter[]>;
  getCostCenter(id: string): Promise<CostCenter | undefined>;
  createCostCenter(costCenter: InsertCostCenter): Promise<CostCenter>;
  
  getSpendCategories(costCenterId: string): Promise<SpendCategory[]>;
  createSpendCategory(category: InsertSpendCategory): Promise<SpendCategory>;
  
  getBudgets(categoryId: string): Promise<Budget[]>;
  createBudget(budget: InsertBudget): Promise<Budget>;
  
  getExpenses(costCenterId: string): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  
  getDashboardSummary(costCenterId: string, periodMode?: 'ytd' | 'month', month?: number, caseGroupFilter?: string): Promise<DashboardSummary>;
  
  getExpenseDetails(costCenterId: string, filterType: 'category' | 'program' | 'account' | 'caseCode', filterValue: string, periodMode?: 'ytd' | 'month', month?: number, caseGroupFilter?: string): Promise<ExpenseDetail[]>;
  
  getMonthlyTrends(costCenterId: string): Promise<MonthlyTrendData[]>;
  
  getKeyVariances(periodMode: 'ytd' | 'month', month: number, limit?: number): Promise<KeyVarianceItem[]>;
  
  getIPTeamsPractices(): Promise<string[]>;
  getIPTeamsData(practice: string | null, month: number, allowedPractices?: string[] | null): Promise<IPTeamData>;
  
  // Dynamic Budget Group methods
  getBudgetGroups(practiceId: string): Promise<BudgetGroup[]>;
  createBudgetGroup(group: InsertBudgetGroup): Promise<BudgetGroup>;
  updateBudgetGroup(id: string, updates: Partial<InsertBudgetGroup>): Promise<BudgetGroup | undefined>;
  deleteBudgetGroup(id: string): Promise<boolean>;
  
  getCaseCodeMappings(practiceId: string): Promise<CaseCodeMapping[]>;
  assignCaseCodeToGroup(practiceId: string, caseCode: string, groupId: string): Promise<CaseCodeMapping>;
  removeCaseCodeFromGroup(practiceId: string, caseCode: string): Promise<boolean>;
  
  getDynamicBudgetData(practiceId: string, month: number): Promise<DynamicBudgetData>;
  getCaseCodesWithExpenses(practiceId: string, month: number): Promise<CaseCodeWithExpense[]>;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Compensation": "#3B82F6",
  "General": "#10B981",
  "Programs": "#10B981",
  "Databases": "#8B5CF6",
  "BCN": "#F59E0B",
  "IP": "#EC4899",
  "Marketing": "#A855F7",
  "Technology": "#06B6D4",
  "Training": "#F97316",
};

function getCategoryColor(name: string): string {
  return CATEGORY_COLORS[name] || "#6B7280";
}

function parseMonthFromPeriod(period: string | null | undefined): number {
  if (!period) return 12;
  const num = parseInt(period.trim());
  if (!isNaN(num) && num >= 1 && num <= 12) {
    return num;
  }
  return 12;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private costCenters: Map<string, CostCenter>;
  private spendCategories: Map<string, SpendCategory>;
  private budgets: Map<string, Budget>;
  private monthlyBudgets: Map<string, number[]>;  // categoryId -> monthly amounts array
  private expenses: Map<string, Expense>;
  private costCenterIdMap: Map<string, string>;
  private ipTeamEntries: IPTeamEntry[];

  constructor() {
    this.users = new Map();
    this.costCenters = new Map();
    this.spendCategories = new Map();
    this.budgets = new Map();
    this.monthlyBudgets = new Map();
    this.expenses = new Map();
    this.costCenterIdMap = new Map();
    this.ipTeamEntries = [];
    
    this.loadCSVData();
    this.loadIPTeamsData();
  }

  private loadCSVData() {
    try {
      const budgetPath = "attached_assets/2025_Budget_by_Category_1769533343675.csv";
      const expensePath = "attached_assets/Full_Practice_Expense_data_(2025)_1769531712720.csv";
      const marketingMappingPath = "attached_assets/Replit_Marketing_Mapping_Table_1769530429336.csv";
      
      const marketingMapping = parseMarketingMappingCSV(marketingMappingPath);
      const budgetRows = parseBudgetCSV(budgetPath, marketingMapping);
      const expenseRows = parseExpenseCSV(expensePath, marketingMapping);
      
      const aggregated = aggregateData(budgetRows, expenseRows);
      
      let costCenterIndex = 1;
      const costCenterNames: string[] = [];
      Array.from(aggregated.costCenters.entries()).forEach(([name, data]) => {
        const id = `cc-${costCenterIndex++}`;
        this.costCenterIdMap.set(name, id);
        this.costCenters.set(id, {
          id,
          name,
          description: data.description,
        });
        costCenterNames.push(name);
      });
      console.log('Cost centers loaded:', costCenterNames.sort().join(', '));
      
      let categoryIndex = 1;
      const categoryIdMap = new Map<string, string>();
      
      Array.from(aggregated.categoryBudgets.entries()).forEach(([costCenterName, budgetMap]) => {
        const costCenterId = this.costCenterIdMap.get(costCenterName);
        if (!costCenterId) return;
        
        Array.from(budgetMap.entries()).forEach(([categoryName, monthlyAmounts]) => {
          const catKey = `${costCenterName}|${categoryName}`;
          const catId = `cat-${categoryIndex++}`;
          categoryIdMap.set(catKey, catId);
          
          this.spendCategories.set(catId, {
            id: catId,
            name: categoryName,
            color: getCategoryColor(categoryName),
            costCenterId,
          });
          
          // Store monthly amounts array
          this.monthlyBudgets.set(catId, monthlyAmounts);
          
          // Calculate annual total for default budget display
          const annualAmount = monthlyAmounts.reduce((sum, val) => sum + val, 0);
          this.budgets.set(`bud-${catId}`, {
            id: `bud-${catId}`,
            categoryId: catId,
            amount: Math.round(annualAmount),
            year: 2025,
          });
        });
      });
      
      Array.from(aggregated.categoryActuals.entries()).forEach(([costCenterName, actualMap]) => {
        const costCenterId = this.costCenterIdMap.get(costCenterName);
        if (!costCenterId) return;
        
        Array.from(actualMap.entries()).forEach(([categoryName, _]) => {
          const catKey = `${costCenterName}|${categoryName}`;
          if (!categoryIdMap.has(catKey)) {
            const catId = `cat-${categoryIndex++}`;
            categoryIdMap.set(catKey, catId);
            
            this.spendCategories.set(catId, {
              id: catId,
              name: categoryName,
              color: getCategoryColor(categoryName),
              costCenterId,
            });
            
            this.budgets.set(`bud-${catId}`, {
              id: `bud-${catId}`,
              categoryId: catId,
              amount: 0,
              year: 2025,
            });
          }
        });
      });
      
      let expenseIndex = 1;
      let skippedExpenses = 0;
      for (const row of expenseRows) {
        const costCenterId = this.costCenterIdMap.get(row.practice);
        if (!costCenterId) {
          skippedExpenses++;
          continue;
        }
        
        const catKey = `${row.practice}|${row.normalizedSpendType}`;
        const categoryId = categoryIdMap.get(catKey);
        if (!categoryId) {
          skippedExpenses++;
          continue;
        }
        
        const expId = `exp-${expenseIndex++}`;
        this.expenses.set(expId, {
          id: expId,
          description: row.lineDescription || `Expense ${expenseIndex}`,
          amount: row.amount,
          categoryId,
          costCenterId,
          programCategory: row.coreProgram,
          month: parseMonthFromPeriod(row.period),
          year: 2025,
          lineDescription: row.lineDescription,
          summaryAccount: row.summaryAccount,
          accountName: row.accountName,
          caseCode: row.caseCode,
          caseName: row.caseName,
          documentDescription: row.documentDescription,
          postedBy: row.postedBy,
          vendorName: row.vendorName,
          period: row.period,
          spendType: row.spendType,
          sapInvoiceDocUrl: row.sapInvoiceDocUrl,
        });
      }
      
      if (skippedExpenses > 0) {
        console.log(`Skipped ${skippedExpenses} expenses due to missing category mappings`);
      }
      
      console.log(`Loaded ${this.costCenters.size} cost centers, ${this.spendCategories.size} categories, ${this.expenses.size} expenses`);
      
    } catch (error) {
      console.error("Error loading CSV data, falling back to seed data:", error);
      this.seedFallbackData();
    }
  }

  private seedFallbackData() {
    const maPractice: CostCenter = { id: "cc-1", name: "M&A Practice", description: "Mergers & Acquisitions Practice" };
    this.costCenters.set(maPractice.id, maPractice);

    const categories: SpendCategory[] = [
      { id: "cat-1", name: "Compensation", color: "#3B82F6", costCenterId: "cc-1" },
      { id: "cat-2", name: "General", color: "#10B981", costCenterId: "cc-1" },
    ];
    categories.forEach(cat => this.spendCategories.set(cat.id, cat));

    const budgetData: Budget[] = [
      { id: "bud-1", categoryId: "cat-1", amount: 274592, year: 2025 },
      { id: "bud-2", categoryId: "cat-2", amount: 16000, year: 2025 },
    ];
    budgetData.forEach(bud => this.budgets.set(bud.id, bud));
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getCostCenters(): Promise<CostCenter[]> {
    return Array.from(this.costCenters.values());
  }

  async getCostCenter(id: string): Promise<CostCenter | undefined> {
    return this.costCenters.get(id);
  }

  async createCostCenter(costCenter: InsertCostCenter): Promise<CostCenter> {
    const id = randomUUID();
    const newCostCenter: CostCenter = { 
      id, 
      name: costCenter.name, 
      description: costCenter.description ?? null 
    };
    this.costCenters.set(id, newCostCenter);
    return newCostCenter;
  }

  async getSpendCategories(costCenterId: string): Promise<SpendCategory[]> {
    if (costCenterId === "all") {
      // Return all categories for aggregation
      return Array.from(this.spendCategories.values());
    }
    return Array.from(this.spendCategories.values()).filter(
      cat => cat.costCenterId === costCenterId
    );
  }

  async createSpendCategory(category: InsertSpendCategory): Promise<SpendCategory> {
    const id = randomUUID();
    const newCategory: SpendCategory = { ...category, id };
    this.spendCategories.set(id, newCategory);
    return newCategory;
  }

  async getBudgets(categoryId: string): Promise<Budget[]> {
    return Array.from(this.budgets.values()).filter(
      budget => budget.categoryId === categoryId
    );
  }

  async createBudget(budget: InsertBudget): Promise<Budget> {
    const id = randomUUID();
    const newBudget: Budget = { ...budget, id };
    this.budgets.set(id, newBudget);
    return newBudget;
  }

  async getExpenses(costCenterId: string): Promise<Expense[]> {
    if (costCenterId === "all") {
      return Array.from(this.expenses.values());
    }
    return Array.from(this.expenses.values()).filter(
      expense => expense.costCenterId === costCenterId
    );
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const id = randomUUID();
    const newExpense: Expense = { 
      id,
      description: expense.description,
      amount: expense.amount,
      categoryId: expense.categoryId,
      costCenterId: expense.costCenterId,
      programCategory: expense.programCategory ?? null,
      month: expense.month,
      year: expense.year,
      lineDescription: expense.lineDescription ?? null,
      summaryAccount: expense.summaryAccount ?? null,
      accountName: expense.accountName ?? null,
      caseCode: expense.caseCode ?? null,
      caseName: expense.caseName ?? null,
      documentDescription: expense.documentDescription ?? null,
      postedBy: expense.postedBy ?? null,
      vendorName: expense.vendorName ?? null,
      period: expense.period ?? null,
      spendType: expense.spendType ?? null,
      sapInvoiceDocUrl: expense.sapInvoiceDocUrl ?? null,
    };
    this.expenses.set(id, newExpense);
    return newExpense;
  }

  async getDashboardSummary(costCenterId: string, periodMode: 'ytd' | 'month' = 'ytd', month: number = 12, caseGroupFilter?: string): Promise<DashboardSummary> {
    const categories = await this.getSpendCategories(costCenterId);
    const allExpenses = await this.getExpenses(costCenterId);
    
    // Filter expenses by period
    const expenses = allExpenses.filter(e => {
      if (!e.month) return true; // Include if no month data
      if (periodMode === 'month') {
        return e.month === month;
      } else {
        // YTD: include all months up to and including selected month
        return e.month <= month;
      }
    });
    
    // Helper to calculate budget for period
    const getBudgetForPeriod = (categoryId: string): number => {
      const monthlyAmounts = this.monthlyBudgets.get(categoryId);
      if (!monthlyAmounts) return 0;
      
      if (periodMode === 'month') {
        return monthlyAmounts[month - 1] || 0;
      } else {
        // YTD: sum months 0 to month-1
        return monthlyAmounts.slice(0, month).reduce((sum, val) => sum + val, 0);
      }
    };
    
    const spendTypeBreakdown: SpendTypeBreakdown[] = [];
    let totalActual = 0;
    let totalBudget = 0;
    
    if (costCenterId === "all") {
      // Aggregate by category name across all cost centers
      const categoryAggregates = new Map<string, { 
        actual: number; 
        budget: number; 
        itemCount: number; 
        color: string;
        categoryIds: string[];
      }>();
      
      for (const category of categories) {
        const categoryExpenses = expenses.filter(e => e.categoryId === category.id);
        const actual = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
        const budget = getBudgetForPeriod(category.id);
        
        const existing = categoryAggregates.get(category.name) || { 
          actual: 0, budget: 0, itemCount: 0, color: category.color, categoryIds: [] 
        };
        existing.actual += actual;
        existing.budget += budget;
        existing.itemCount += categoryExpenses.length;
        existing.categoryIds.push(category.id);
        categoryAggregates.set(category.name, existing);
      }
      
      for (const [name, data] of Array.from(categoryAggregates.entries())) {
        totalActual += data.actual;
        totalBudget += data.budget;
        
        const variance = data.budget - data.actual;
        const percentUsed = data.budget > 0 ? Math.round((data.actual / data.budget) * 100) : (data.actual > 0 ? 100 : 0);
        
        spendTypeBreakdown.push({
          categoryId: name, // Use name as ID for "all" view
          categoryName: name,
          color: data.color,
          actual: data.actual,
          budget: data.budget,
          itemCount: data.itemCount,
          percentUsed,
          variance: Math.abs(variance),
          isOverBudget: variance < 0,
        });
      }
    } else {
      for (const category of categories) {
        const categoryExpenses = expenses.filter(e => e.categoryId === category.id);
        const actual = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
        const budget = getBudgetForPeriod(category.id);
        
        totalActual += actual;
        totalBudget += budget;
        
        const variance = budget - actual;
        const percentUsed = budget > 0 ? Math.round((actual / budget) * 100) : (actual > 0 ? 100 : 0);
        
        spendTypeBreakdown.push({
          categoryId: category.id,
          categoryName: category.name,
          color: category.color,
          actual,
          budget,
          itemCount: categoryExpenses.length,
          percentUsed,
          variance: Math.abs(variance),
          isOverBudget: variance < 0,
        });
      }
    }
    
    spendTypeBreakdown.sort((a, b) => b.actual - a.actual);
    
    // Find Compensation category IDs to exclude those expenses
    const compensationCategoryIds = categories.filter(c => c.name === "Compensation").map(c => c.id);
    
    // Only include expenses that have an accountName AND are not in the Compensation category
    const accountNameExpenses = expenses.filter(e => 
      e.accountName && !compensationCategoryIds.includes(e.categoryId)
    );
    const programGroups = new Map<string, { count: number; amount: number }>();
    
    for (const expense of accountNameExpenses) {
      const key = expense.accountName!;
      const existing = programGroups.get(key) || { count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += expense.amount;
      programGroups.set(key, existing);
    }
    
    const programColors: Record<string, string> = {
      "Professional Services": "#F59E0B",
      "Travel (Transportation)": "#8B5CF6",
      "Travel (Meals)": "#A855F7",
      "Travel (Hotel)": "#7C3AED",
      "Travel (Other)": "#6D28D9",
      "Other": "#10B981",
      "Software Licenses": "#3B82F6",
      "Certifications": "#EC4899",
      "Fringe / Benefits": "#14B8A6",
      "Salary": "#3B82F6",
      "Bonus (Individual Perf.)": "#F97316",
      "Bonus (Firm Perf.)": "#FB923C",
      "Bonus (Signing)": "#FDBA74",
      "Technology": "#06B6D4",
      "Office Services": "#84CC16",
      "Dues/Memberships": "#22C55E",
      "Communication": "#0EA5E9",
      "Research and Data Services": "#6366F1",
      "Events and Meetings": "#D946EF",
      "Recruitment": "#F43F5E",
      "Occupancy": "#78716C",
      "Other Compensation": "#EAB308",
    };
    
    const compensationAccounts = [
      "Salary", 
      "Bonus (Individual Perf.)", 
      "Bonus (Firm Perf.)", 
      "Bonus (Signing)",
      "Fringe / Benefits",
      "Other Compensation"
    ];
    
    // Dynamic threshold: $1K for single month, $20K for YTD
    const programThreshold = periodMode === 'month' ? 1000 : 20000;
    
    const programSpendBreakdown: ProgramSpendItem[] = Array.from(programGroups.entries())
      .filter(([category, data]) => data.amount >= programThreshold && !compensationAccounts.includes(category))
      .map(([category, data]) => ({
        category,
        itemCount: data.count,
        amount: Math.round(data.amount),
        color: programColors[category] || "#6B7280",
      }))
      .sort((a, b) => b.amount - a.amount);
    
    // Total program spend = Total spend minus Compensation
    const compensationActual = spendTypeBreakdown.find(s => s.categoryName === "Compensation")?.actual || 0;
    const totalProgramSpend = Math.round(totalActual - compensationActual);
    const variance = totalBudget - totalActual;
    
    // Compensation by Summary Account
    const compensationExpenses = expenses.filter(e => compensationCategoryIds.includes(e.categoryId));
    const compAccountGroups = new Map<string, { count: number; amount: number }>();
    for (const expense of compensationExpenses) {
      const key = expense.summaryAccount || 'Other Compensation';
      const existing = compAccountGroups.get(key) || { count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += expense.amount;
      compAccountGroups.set(key, existing);
    }
    
    const compensationByAccount: AccountSpendItem[] = Array.from(compAccountGroups.entries())
      .map(([account, data]) => ({
        account,
        amount: Math.round(data.amount),
        itemCount: data.count,
        color: programColors[account] || "#6B7280",
      }))
      .sort((a, b) => b.amount - a.amount);
    
    // Program spend by Summary Account (non-Compensation)
    // Get category IDs for the case group filter if specified
    let caseGroupCategoryIds: string[] | null = null;
    if (caseGroupFilter) {
      caseGroupCategoryIds = categories
        .filter(c => c.name === caseGroupFilter)
        .map(c => c.id);
    }
    
    const programExpenses = expenses.filter(e => {
      if (compensationCategoryIds.includes(e.categoryId)) return false;
      if (caseGroupCategoryIds && !caseGroupCategoryIds.includes(e.categoryId)) return false;
      return true;
    });
    const progAccountGroups = new Map<string, { count: number; amount: number }>();
    for (const expense of programExpenses) {
      const key = expense.summaryAccount || 'Other';
      const existing = progAccountGroups.get(key) || { count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += expense.amount;
      progAccountGroups.set(key, existing);
    }
    
    const programByAccount: AccountSpendItem[] = Array.from(progAccountGroups.entries())
      .filter(([account, data]) => data.amount >= programThreshold)
      .map(([account, data]) => ({
        account,
        amount: Math.round(data.amount),
        itemCount: data.count,
        color: programColors[account] || "#6B7280",
      }))
      .sort((a, b) => b.amount - a.amount);
    
    // Group program expenses by case code
    const caseCodeColors = [
      "#06B6D4", "#8B5CF6", "#F59E0B", "#10B981", "#EC4899", 
      "#6366F1", "#14B8A6", "#F97316", "#84CC16", "#A855F7"
    ];
    const progCaseCodeGroups = new Map<string, { count: number; amount: number; caseName: string }>();
    for (const expense of programExpenses) {
      const key = expense.caseCode || 'No Case Code';
      const existing = progCaseCodeGroups.get(key) || { count: 0, amount: 0, caseName: '' };
      existing.count += 1;
      existing.amount += expense.amount;
      // Keep the first non-empty case name found
      if (!existing.caseName && expense.caseName) {
        existing.caseName = expense.caseName;
      }
      progCaseCodeGroups.set(key, existing);
    }
    
    const programByCaseCode: AccountSpendItem[] = Array.from(progCaseCodeGroups.entries())
      .filter(([caseCode, data]) => data.amount >= programThreshold)
      .map(([caseCode, data], index) => ({
        account: caseCode,
        amount: Math.round(data.amount),
        itemCount: data.count,
        color: caseCodeColors[index % caseCodeColors.length],
        caseName: data.caseName || undefined,
      }))
      .sort((a, b) => b.amount - a.amount);
    
    return {
      totalSpend: Math.round(totalActual * 100) / 100,
      totalBudget: Math.round(totalBudget),
      budgetUsedPercent: totalBudget > 0 ? Math.round((totalActual / totalBudget) * 1000) / 10 : 0,
      variance: Math.abs(variance),
      isUnderBudget: variance >= 0,
      spendTypeBreakdown,
      programSpendBreakdown,
      totalProgramSpend,
      compensationByAccount,
      programByAccount,
      programByCaseCode,
    };
  }

  async getExpenseDetails(
    costCenterId: string, 
    filterType: 'category' | 'program' | 'account' | 'caseCode', 
    filterValue: string,
    periodMode?: 'ytd' | 'month',
    month?: number,
    caseGroupFilter?: string
  ): Promise<ExpenseDetail[]> {
    let expenses = costCenterId === "all" 
      ? Array.from(this.expenses.values())
      : Array.from(this.expenses.values()).filter(
          expense => expense.costCenterId === costCenterId
        );
    
    // Apply period filtering if specified
    if (periodMode && month) {
      expenses = expenses.filter(exp => {
        const expMonth = exp.postingPeriod || 12;
        if (periodMode === 'ytd') {
          return expMonth <= month;
        } else {
          return expMonth === month;
        }
      });
    }
    
    let filtered: Expense[];
    let isCompensation = false;
    
    // Apply case group filter for account filter type
    if (filterType === 'account' && caseGroupFilter) {
      const caseGroupCategoryIds = Array.from(this.spendCategories.values())
        .filter(c => c.name === caseGroupFilter)
        .map(c => c.id);
      expenses = expenses.filter(e => caseGroupCategoryIds.includes(e.categoryId));
    }
    
    if (filterType === 'category') {
      if (costCenterId === "all") {
        // For "all" view, filterValue is the category name
        const categoryIds = Array.from(this.spendCategories.values())
          .filter(cat => cat.name === filterValue)
          .map(cat => cat.id);
        filtered = expenses.filter(exp => categoryIds.includes(exp.categoryId));
        isCompensation = filterValue === "Compensation";
      } else {
        const category = Array.from(this.spendCategories.values()).find(
          cat => cat.id === filterValue
        );
        if (category) {
          filtered = expenses.filter(exp => exp.categoryId === filterValue);
          isCompensation = category.name === "Compensation";
        } else {
          filtered = [];
        }
      }
    } else if (filterType === 'program' || filterType === 'account') {
      // Both program and account filter by summary account name
      filtered = expenses.filter(exp => exp.summaryAccount === filterValue);
    } else if (filterType === 'caseCode') {
      // Filter by case code
      if (filterValue === 'No Case Code') {
        filtered = expenses.filter(exp => !exp.caseCode || exp.caseCode === '');
      } else {
        filtered = expenses.filter(exp => exp.caseCode === filterValue);
      }
    } else {
      filtered = [];
    }
    
    // For Compensation, aggregate by Summary Account instead of showing line items
    if (isCompensation) {
      const summaryMap = new Map<string, { amount: number; count: number }>();
      
      for (const exp of filtered) {
        const summaryAcct = exp.summaryAccount || 'Other Compensation';
        const existing = summaryMap.get(summaryAcct) || { amount: 0, count: 0 };
        existing.amount += exp.amount;
        existing.count += 1;
        summaryMap.set(summaryAcct, existing);
      }
      
      return Array.from(summaryMap.entries()).map(([summaryAcct, data], idx) => ({
        id: `comp-summary-${idx}`,
        lineDescription: summaryAcct,
        spendType: 'Comp',
        summaryAccount: summaryAcct,
        caseCode: '',
        caseName: '',
        documentDescription: `${data.count} line items`,
        period: '',
        amount: Math.round(data.amount),
        vendorName: '',
        sapInvoiceDocUrl: '',
      })).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    }
    
    return filtered.map(exp => ({
      id: exp.id,
      lineDescription: exp.lineDescription || exp.description,
      spendType: exp.spendType || '',
      summaryAccount: exp.accountName || exp.summaryAccount || '',
      caseCode: exp.caseCode || '',
      caseName: exp.caseName || '',
      documentDescription: exp.documentDescription || '',
      period: exp.period || `Dec 2025`,
      amount: exp.amount,
      vendorName: exp.vendorName || '',
      sapInvoiceDocUrl: exp.sapInvoiceDocUrl || '',
    })).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }

  async getMonthlyTrends(costCenterId: string): Promise<MonthlyTrendData[]> {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const categories = await this.getSpendCategories(costCenterId);
    const allExpenses = await this.getExpenses(costCenterId);
    
    const result: MonthlyTrendData[] = [];
    
    // Build category ID maps for each case group
    const getCategoryIds = (name: string) => categories.filter(c => c.name === name).map(c => c.id);
    const compensationCategoryIds = getCategoryIds("Compensation");
    const generalCategoryIds = getCategoryIds("General");
    const databasesCategoryIds = getCategoryIds("Databases");
    const bcnCategoryIds = getCategoryIds("BCN");
    const ipCategoryIds = getCategoryIds("IP");
    const marketingCategoryIds = getCategoryIds("Marketing");
    
    for (let month = 1; month <= 12; month++) {
      const monthExpenses = allExpenses.filter(e => e.month === month);
      
      // Calculate actual spend for this month
      const actual = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
      
      // Calculate budget for this month using the monthlyBudgets map
      let monthBudget = 0;
      let compensationBudget = 0;
      let programBudget = 0;
      for (const category of categories) {
        const monthlyAmounts = this.monthlyBudgets.get(category.id);
        if (monthlyAmounts && Array.isArray(monthlyAmounts)) {
          const catBudget = monthlyAmounts[month - 1] || 0;
          monthBudget += catBudget;
          if (compensationCategoryIds.includes(category.id)) {
            compensationBudget += catBudget;
          } else {
            programBudget += catBudget;
          }
        }
      }
      
      // Calculate compensation vs program actual
      const compensationActual = monthExpenses
        .filter(e => compensationCategoryIds.includes(e.categoryId))
        .reduce((sum, e) => sum + e.amount, 0);
      
      const programActual = actual - compensationActual;
      
      // Calculate case group breakdowns (excluding Compensation)
      const generalActual = monthExpenses
        .filter(e => generalCategoryIds.includes(e.categoryId))
        .reduce((sum, e) => sum + e.amount, 0);
      
      const databasesActual = monthExpenses
        .filter(e => databasesCategoryIds.includes(e.categoryId))
        .reduce((sum, e) => sum + e.amount, 0);
      
      const bcnActual = monthExpenses
        .filter(e => bcnCategoryIds.includes(e.categoryId))
        .reduce((sum, e) => sum + e.amount, 0);
      
      const ipActual = monthExpenses
        .filter(e => ipCategoryIds.includes(e.categoryId))
        .reduce((sum, e) => sum + e.amount, 0);
      
      const marketingActual = monthExpenses
        .filter(e => marketingCategoryIds.includes(e.categoryId))
        .reduce((sum, e) => sum + e.amount, 0);
      
      result.push({
        month,
        monthName: monthNames[month - 1],
        actual: Math.round(actual),
        budget: Math.round(monthBudget),
        variance: Math.round(monthBudget - actual),
        compensationActual: Math.round(compensationActual),
        compensationBudget: Math.round(compensationBudget),
        programActual: Math.round(programActual),
        programBudget: Math.round(programBudget),
        generalActual: Math.round(generalActual),
        databasesActual: Math.round(databasesActual),
        bcnActual: Math.round(bcnActual),
        ipActual: Math.round(ipActual),
        marketingActual: Math.round(marketingActual),
      });
    }
    
    return result;
  }

  async getKeyVariances(periodMode: 'ytd' | 'month', month: number, limit: number = 20): Promise<KeyVarianceItem[]> {
    const costCenters = await this.getCostCenters();
    const variances: KeyVarianceItem[] = [];

    // Helper to calculate budget for period
    const getBudgetForPeriod = (categoryId: string): number => {
      const monthlyAmounts = this.monthlyBudgets.get(categoryId);
      if (!monthlyAmounts) return 0;
      
      if (periodMode === 'month') {
        return monthlyAmounts[month - 1] || 0;
      } else {
        // YTD: sum months 0 to month-1
        return monthlyAmounts.slice(0, month).reduce((sum, val) => sum + val, 0);
      }
    };

    // Process each practice
    for (const costCenter of costCenters) {
      const categories = await this.getSpendCategories(costCenter.id);
      const allExpenses = await this.getExpenses(costCenter.id);
      
      // Filter expenses by period
      const expenses = allExpenses.filter(e => {
        if (!e.month) return true;
        if (periodMode === 'month') {
          return e.month === month;
        } else {
          return e.month <= month;
        }
      });

      // Group by category (case group)
      for (const category of categories) {
        // Skip Compensation - focus on program spend variances
        if (category.name === "Compensation") continue;
        
        const categoryExpenses = expenses.filter(e => e.categoryId === category.id);
        const actual = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
        const budget = getBudgetForPeriod(category.id);
        
        // Only include if there's meaningful spend or budget
        if (actual > 0 || budget > 0) {
          const variance = budget - actual;
          const percentUsed = budget > 0 ? Math.round((actual / budget) * 100) : (actual > 0 ? 100 : 0);
          
          variances.push({
            practice: costCenter.name,
            caseGroup: category.name,
            actual: Math.round(actual),
            budget: Math.round(budget),
            variance: Math.round(variance),
            isOverBudget: variance < 0,
            percentUsed,
          });
        }
      }
    }

    // Sort by absolute variance (largest first)
    variances.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
    
    // Return top N
    return variances.slice(0, limit);
  }

  private loadIPTeamsData() {
    try {
      const ipTeamsPath = "attached_assets/IP_data_(2025)_1769541304144.csv";
      const rows = parseIPTeamsCSV(ipTeamsPath);
      
      let id = 1;
      for (const row of rows) {
        this.ipTeamEntries.push({
          id: `ip-${id++}`,
          costCenter: row.costCenter,
          type: row.type,
          interlock1: row.interlock1,
          interlock2: row.interlock2,
          interlock3: row.interlock3,
          serviceLine: row.serviceLine,
          name: row.name,
          caseCode: row.caseCode,
          caseName: row.caseName,
          level: row.level,
          percentage: row.percentage,
          monthlyAmounts: row.monthlyAmounts,
          ytd: row.ytd,
          cy25: row.cy25,
        });
      }
      
      console.log(`Loaded ${this.ipTeamEntries.length} IP team entries`);
    } catch (error) {
      console.error("Error loading IP Teams data:", error);
    }
  }

  async getIPTeamsPractices(): Promise<string[]> {
    const practices = new Set<string>();
    for (const entry of this.ipTeamEntries) {
      practices.add(entry.costCenter);
    }
    return Array.from(practices).sort();
  }

  async getIPTeamsData(practice: string | null, month: number, allowedPractices?: string[] | null): Promise<IPTeamData> {
    // Helper to check if practice matches (handles missing "Practice" suffix)
    const practiceMatches = (value: string, targetPractice: string): boolean => {
      if (!value || value === 'n/a') return false;
      const normalized = value.trim().toLowerCase();
      const target = targetPractice.toLowerCase();
      // Exact match or match with "Practice" suffix added
      return normalized === target || 
             normalized + ' practice' === target ||
             normalized === target.replace(' practice', '');
    };
    
    // Helper to check if entry is accessible based on allowed practices
    const isAccessible = (entry: IPTeamEntry): boolean => {
      if (!allowedPractices || allowedPractices.includes('All Practices')) {
        return true;
      }
      // Check if any of the practice columns match allowed practices
      return allowedPractices.some(ap => 
        entry.costCenter === ap ||
        practiceMatches(entry.interlock1, ap) ||
        practiceMatches(entry.interlock2, ap) ||
        practiceMatches(entry.interlock3, ap)
      );
    };
    
    // Split by type first, filtering by access control
    const allTraditional = this.ipTeamEntries.filter(e => e.type === 'Traditional' && isAccessible(e));
    const allInterlock = this.ipTeamEntries.filter(e => e.type === 'Interlock' && isAccessible(e));
    const allRotations = this.ipTeamEntries.filter(e => e.type === 'Rotations' && isAccessible(e));
    
    let traditionalRows = allTraditional;
    let interlockRows = allInterlock;
    let rotationsRows = allRotations;
    
    // Filter by practice if specified
    if (practice && practice !== 'all') {
      // Traditional and Rotations filter by costCenter (column A)
      traditionalRows = allTraditional.filter(e => e.costCenter === practice);
      rotationsRows = allRotations.filter(e => e.costCenter === practice);
      
      // Interlock filters by costCenter (column A) OR columns B, C, D (interlock1, interlock2, interlock3)
      interlockRows = allInterlock.filter(e => 
        e.costCenter === practice ||
        practiceMatches(e.interlock1, practice) ||
        practiceMatches(e.interlock2, practice) ||
        practiceMatches(e.interlock3, practice)
      );
    }
    
    // Helper to calculate YTD through month
    const calcYTD = (amounts: number[], throughMonth: number): number => {
      return amounts.slice(0, throughMonth).reduce((sum, val) => sum + val, 0);
    };
    
    // Helper to sum monthly amounts arrays
    const sumMonthly = (rows: IPTeamEntry[]): number[] => {
      const result = new Array(12).fill(0);
      for (const row of rows) {
        for (let m = 0; m < 12; m++) {
          result[m] += row.monthlyAmounts[m] || 0;
        }
      }
      return result;
    };
    
    // Calculate subtotals
    const traditionalMonthly = sumMonthly(traditionalRows);
    const interlockMonthly = sumMonthly(interlockRows);
    const rotationsMonthly = sumMonthly(rotationsRows);
    
    const traditionalSubtotal: IPTeamSummary = {
      costCenter: practice || 'All',
      type: 'Traditional',
      ytdActual: calcYTD(traditionalMonthly, month),
      estimatedBudget: traditionalRows.reduce((sum, r) => sum + r.cy25, 0),
      monthlyAmounts: traditionalMonthly,
    };
    
    const interlockSubtotal: IPTeamSummary = {
      costCenter: practice || 'All',
      type: 'Interlock',
      ytdActual: calcYTD(interlockMonthly, month),
      estimatedBudget: interlockRows.reduce((sum, r) => sum + r.cy25, 0),
      monthlyAmounts: interlockMonthly,
    };
    
    const rotationsSubtotal: IPTeamSummary = {
      costCenter: practice || 'All',
      type: 'Rotations',
      ytdActual: calcYTD(rotationsMonthly, month),
      estimatedBudget: rotationsRows.reduce((sum, r) => sum + r.cy25, 0),
      monthlyAmounts: rotationsMonthly,
    };
    
    // Grand total (combine all filtered rows)
    const allFilteredRows = [...traditionalRows, ...interlockRows, ...rotationsRows];
    const grandMonthly = sumMonthly(allFilteredRows);
    const grandTotal: IPTeamSummary = {
      costCenter: practice || 'All',
      type: 'Total',
      ytdActual: calcYTD(grandMonthly, month),
      estimatedBudget: allFilteredRows.reduce((sum, r) => sum + r.cy25, 0),
      monthlyAmounts: grandMonthly,
    };
    
    // Get practices list, filtered by access control
    let practices = await this.getIPTeamsPractices();
    if (allowedPractices && !allowedPractices.includes('All Practices')) {
      practices = practices.filter(p => allowedPractices.includes(p));
    }

    return {
      practices,
      traditionalRows,
      interlockRows,
      rotationsRows,
      traditionalSubtotal,
      interlockSubtotal,
      rotationsSubtotal,
      grandTotal,
    };
  }

  // Dynamic Budget Group Methods
  async getBudgetGroups(practiceId: string): Promise<BudgetGroup[]> {
    const groups = await db.select().from(budgetGroups).where(eq(budgetGroups.practiceId, practiceId));
    return groups.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async createBudgetGroup(group: InsertBudgetGroup): Promise<BudgetGroup> {
    const [newGroup] = await db.insert(budgetGroups).values(group).returning();
    return newGroup;
  }

  async updateBudgetGroup(id: string, updates: Partial<InsertBudgetGroup>): Promise<BudgetGroup | undefined> {
    const [updated] = await db.update(budgetGroups).set(updates).where(eq(budgetGroups.id, id)).returning();
    return updated;
  }

  async deleteBudgetGroup(id: string): Promise<boolean> {
    // First delete all case code mappings for this group
    await db.delete(caseCodeMappings).where(eq(caseCodeMappings.budgetGroupId, id));
    // Then delete the group
    const result = await db.delete(budgetGroups).where(eq(budgetGroups.id, id)).returning();
    return result.length > 0;
  }

  async getCaseCodeMappings(practiceId: string): Promise<CaseCodeMapping[]> {
    return await db.select().from(caseCodeMappings).where(eq(caseCodeMappings.practiceId, practiceId));
  }

  async assignCaseCodeToGroup(practiceId: string, caseCode: string, groupId: string): Promise<CaseCodeMapping> {
    // First remove any existing mapping for this case code
    await db.delete(caseCodeMappings).where(
      and(
        eq(caseCodeMappings.practiceId, practiceId),
        eq(caseCodeMappings.caseCode, caseCode)
      )
    );
    // Then create the new mapping
    const [mapping] = await db.insert(caseCodeMappings).values({
      budgetGroupId: groupId,
      caseCode,
      practiceId
    }).returning();
    return mapping;
  }

  async removeCaseCodeFromGroup(practiceId: string, caseCode: string): Promise<boolean> {
    const result = await db.delete(caseCodeMappings).where(
      and(
        eq(caseCodeMappings.practiceId, practiceId),
        eq(caseCodeMappings.caseCode, caseCode)
      )
    ).returning();
    return result.length > 0;
  }

  async getCaseCodesWithExpenses(practiceId: string, month: number): Promise<CaseCodeWithExpense[]> {
    // Get cost center info
    const costCenter = await this.getCostCenter(practiceId);
    if (!costCenter) return [];
    
    // Get existing mappings
    const mappings = await this.getCaseCodeMappings(practiceId);
    const mappingByCaseCode = new Map(mappings.map(m => [m.caseCode, m.budgetGroupId]));
    
    // Find Compensation category IDs to exclude those expenses
    const categories = await this.getSpendCategories(practiceId);
    const compensationCategoryIds = new Set(
      categories.filter(c => c.name === "Compensation").map(c => c.id)
    );
    
    // Get all non-comp expenses for this practice, grouped by case code
    const caseCodeExpenses = new Map<string, { caseName: string; amount: number }>();
    
    const expenseArray = Array.from(this.expenses.values());
    for (const expense of expenseArray) {
      if (expense.costCenterId !== practiceId) continue;
      // Exclude compensation by checking category (more reliable than spendType field)
      if (compensationCategoryIds.has(expense.categoryId)) continue;
      if (expense.month > month) continue; // Only YTD expenses
      
      const code = expense.caseCode || 'Unknown';
      const existing = caseCodeExpenses.get(code);
      if (existing) {
        existing.amount += expense.amount;
      } else {
        caseCodeExpenses.set(code, {
          caseName: expense.caseName || '',
          amount: expense.amount
        });
      }
    }
    
    // Convert to array
    const result: CaseCodeWithExpense[] = [];
    const caseCodeEntries = Array.from(caseCodeExpenses.entries());
    for (const [caseCode, data] of caseCodeEntries) {
      result.push({
        caseCode,
        caseName: data.caseName,
        ytdActual: data.amount,
        groupId: mappingByCaseCode.get(caseCode) || null
      });
    }
    
    // Sort by amount descending
    return result.sort((a, b) => Math.abs(b.ytdActual) - Math.abs(a.ytdActual));
  }

  async getDynamicBudgetData(practiceId: string, month: number): Promise<DynamicBudgetData> {
    const costCenter = await this.getCostCenter(practiceId);
    if (!costCenter) {
      return {
        practiceId,
        practiceName: 'Unknown',
        coreProgramBudget: 0,
        marketingBudget: 0,
        totalProgramBudget: 0,
        totalAllocated: 0,
        unallocatedBudget: 0,
        groups: [],
        unassignedCaseCodes: []
      };
    }
    
    // Calculate core program budget and marketing budget separately
    let coreProgramBudget = 0;
    let marketingBudget = 0;
    const categoryArray = Array.from(this.spendCategories.values());
    const budgetArray = Array.from(this.budgets.values());
    for (const category of categoryArray) {
      if (category.costCenterId !== practiceId) continue;
      if (category.name === 'Compensation') continue;
      
      for (const budget of budgetArray) {
        if (budget.categoryId === category.id) {
          if (category.name === 'Marketing') {
            marketingBudget += budget.amount;
          } else {
            coreProgramBudget += budget.amount;
          }
        }
      }
    }
    const totalProgramBudget = coreProgramBudget + marketingBudget;
    
    // Get all case codes with expenses
    const allCaseCodes = await this.getCaseCodesWithExpenses(practiceId, month);
    
    // Get budget groups
    let groups = await this.getBudgetGroups(practiceId);
    
    // Auto-create Marketing group if practice has marketing budget and no Marketing group exists
    // Use case-insensitive check to avoid duplicates like "Marketing" vs "marketing"
    const hasMarketingGroup = groups.some(g => g.name.toLowerCase() === 'marketing');
    if (marketingBudget > 0 && !hasMarketingGroup) {
      // Create the Marketing group
      const marketingGroup = await this.createBudgetGroup({
        practiceId,
        name: 'Marketing',
        allocatedBudget: marketingBudget,
        displayOrder: 0, // Put it first
      });
      
      // Find and auto-assign ONLY UNASSIGNED marketing case codes
      // (Don't override user-defined assignments)
      const marketingCategoryIds = new Set(
        categoryArray.filter(c => c.name === 'Marketing' && c.costCenterId === practiceId).map(c => c.id)
      );
      
      // Get all marketing case codes from expenses
      const expenseArray = Array.from(this.expenses.values());
      const marketingCaseCodes = new Set<string>();
      for (const expense of expenseArray) {
        if (expense.costCenterId !== practiceId) continue;
        if (!marketingCategoryIds.has(expense.categoryId)) continue;
        if (expense.caseCode) {
          marketingCaseCodes.add(expense.caseCode);
        }
      }
      
      // Only assign case codes that are currently unassigned
      for (const caseCode of marketingCaseCodes) {
        const existingAssignment = allCaseCodes.find(cc => cc.caseCode === caseCode);
        if (!existingAssignment || existingAssignment.groupId === null) {
          await this.assignCaseCodeToGroup(practiceId, caseCode, marketingGroup.id);
        }
      }
      
      // Refresh groups and case codes after creating Marketing group
      groups = await this.getBudgetGroups(practiceId);
      // Update case code groupId mappings
      const updatedMappings = await this.getCaseCodeMappings(practiceId);
      const mappingByCaseCode = new Map(updatedMappings.map(m => [m.caseCode, m.budgetGroupId]));
      for (const cc of allCaseCodes) {
        cc.groupId = mappingByCaseCode.get(cc.caseCode) || null;
      }
    }
    
    // Build groups with their case codes and calculations
    const groupsWithCodes: BudgetGroupWithCodes[] = [];
    let totalAllocated = 0;
    
    for (const group of groups) {
      const caseCodes = allCaseCodes.filter(cc => cc.groupId === group.id);
      const ytdActual = caseCodes.reduce((sum, cc) => sum + cc.ytdActual, 0);
      const ytdBudget = group.allocatedBudget * (month / 12);
      
      totalAllocated += group.allocatedBudget;
      
      groupsWithCodes.push({
        ...group,
        caseCodes,
        ytdActual,
        fullYearBudget: group.allocatedBudget,
        ytdBudget,
        variance: ytdBudget - ytdActual
      });
    }
    
    // Get unassigned case codes
    const unassignedCaseCodes = allCaseCodes.filter(cc => cc.groupId === null);
    
    return {
      practiceId,
      practiceName: costCenter.name,
      coreProgramBudget,
      marketingBudget,
      totalProgramBudget,
      totalAllocated,
      unallocatedBudget: totalProgramBudget - totalAllocated,
      groups: groupsWithCodes,
      unassignedCaseCodes
    };
  }
}

export const storage = new MemStorage();
