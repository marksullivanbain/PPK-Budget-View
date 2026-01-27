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
  type ExpenseDetail
} from "@shared/schema";
import { randomUUID } from "crypto";
import { parseBudgetCSV, parseExpenseCSV, parseMarketingMappingCSV, aggregateData } from "./csv-parser";

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
  
  getDashboardSummary(costCenterId: string): Promise<DashboardSummary>;
  
  getExpenseDetails(costCenterId: string, filterType: 'category' | 'program', filterValue: string): Promise<ExpenseDetail[]>;
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

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private costCenters: Map<string, CostCenter>;
  private spendCategories: Map<string, SpendCategory>;
  private budgets: Map<string, Budget>;
  private expenses: Map<string, Expense>;
  private costCenterIdMap: Map<string, string>;

  constructor() {
    this.users = new Map();
    this.costCenters = new Map();
    this.spendCategories = new Map();
    this.budgets = new Map();
    this.expenses = new Map();
    this.costCenterIdMap = new Map();
    
    this.loadCSVData();
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
        
        Array.from(budgetMap.entries()).forEach(([categoryName, budgetAmount]) => {
          const catKey = `${costCenterName}|${categoryName}`;
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
            amount: Math.round(budgetAmount),
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
          month: 12,
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

  async getDashboardSummary(costCenterId: string): Promise<DashboardSummary> {
    const categories = await this.getSpendCategories(costCenterId);
    const expenses = await this.getExpenses(costCenterId);
    
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
        const budgets = await this.getBudgets(category.id);
        const budget = budgets.find(b => b.year === 2025)?.amount || 0;
        
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
        const budgets = await this.getBudgets(category.id);
        const budget = budgets.find(b => b.year === 2025)?.amount || 0;
        
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
    
    const programSpendBreakdown: ProgramSpendItem[] = Array.from(programGroups.entries())
      .filter(([category, data]) => data.amount >= 1000 && !compensationAccounts.includes(category))
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
    
    return {
      totalSpend: Math.round(totalActual * 100) / 100,
      totalBudget: Math.round(totalBudget),
      budgetUsedPercent: totalBudget > 0 ? Math.round((totalActual / totalBudget) * 1000) / 10 : 0,
      variance: Math.abs(variance),
      isUnderBudget: variance >= 0,
      spendTypeBreakdown,
      programSpendBreakdown,
      totalProgramSpend,
    };
  }

  async getExpenseDetails(
    costCenterId: string, 
    filterType: 'category' | 'program', 
    filterValue: string
  ): Promise<ExpenseDetail[]> {
    const expenses = costCenterId === "all" 
      ? Array.from(this.expenses.values())
      : Array.from(this.expenses.values()).filter(
          expense => expense.costCenterId === costCenterId
        );
    
    let filtered: Expense[];
    
    if (filterType === 'category') {
      if (costCenterId === "all") {
        // For "all" view, filterValue is the category name
        const categoryIds = Array.from(this.spendCategories.values())
          .filter(cat => cat.name === filterValue)
          .map(cat => cat.id);
        filtered = expenses.filter(exp => categoryIds.includes(exp.categoryId));
      } else {
        const category = Array.from(this.spendCategories.values()).find(
          cat => cat.id === filterValue
        );
        if (category) {
          filtered = expenses.filter(exp => exp.categoryId === filterValue);
        } else {
          filtered = [];
        }
      }
    } else {
      filtered = expenses.filter(exp => exp.accountName === filterValue);
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
}

export const storage = new MemStorage();
