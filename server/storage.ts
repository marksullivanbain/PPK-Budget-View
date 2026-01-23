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
  type ProgramSpendItem
} from "@shared/schema";
import { randomUUID } from "crypto";

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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private costCenters: Map<string, CostCenter>;
  private spendCategories: Map<string, SpendCategory>;
  private budgets: Map<string, Budget>;
  private expenses: Map<string, Expense>;

  constructor() {
    this.users = new Map();
    this.costCenters = new Map();
    this.spendCategories = new Map();
    this.budgets = new Map();
    this.expenses = new Map();
    
    this.seedData();
  }

  private seedData() {
    // Create cost centers
    const maPractice: CostCenter = { id: "cc-1", name: "M&A Practice", description: "Mergers & Acquisitions Practice" };
    const taxPractice: CostCenter = { id: "cc-2", name: "Tax Practice", description: "Tax Advisory Practice" };
    const auditPractice: CostCenter = { id: "cc-3", name: "Audit Practice", description: "Audit & Assurance Practice" };
    
    this.costCenters.set(maPractice.id, maPractice);
    this.costCenters.set(taxPractice.id, taxPractice);
    this.costCenters.set(auditPractice.id, auditPractice);

    // Create spend categories for M&A Practice
    const categories: SpendCategory[] = [
      { id: "cat-1", name: "Compensation", color: "#3B82F6", costCenterId: "cc-1" },
      { id: "cat-2", name: "Marketing", color: "#F59E0B", costCenterId: "cc-1" },
      { id: "cat-3", name: "Program - General", color: "#10B981", costCenterId: "cc-1" },
    ];
    
    categories.forEach(cat => this.spendCategories.set(cat.id, cat));

    // Create budgets for 2025 - matching the screenshot values
    // Compensation: $274,592, Marketing: $37,500, Program - General: $11,000
    // Note: Screenshot total budget $328,092 may include other categories
    const budgetData: Budget[] = [
      { id: "bud-1", categoryId: "cat-1", amount: 274592, year: 2025 },
      { id: "bud-2", categoryId: "cat-2", amount: 37500, year: 2025 },
      { id: "bud-3", categoryId: "cat-3", amount: 11000, year: 2025 },
    ];
    
    budgetData.forEach(bud => this.budgets.set(bud.id, bud));

    // Create expenses - matching the screenshot values
    // Total Spend: $298,641.21
    const expenseData: Expense[] = [
      // Compensation expenses (112 items totaling $232,742)
      ...this.generateFixedExpenses("cat-1", "cc-1", 232742, 112, null),
      // Marketing expenses (13 items totaling $35,361.21)
      ...this.generateFixedExpenses("cat-2", "cc-1", 35361.21, 13, null),
      // Program - General expenses (67 items totaling $30,538 to match breakdown)
      ...this.generateProgramExpenses("cat-3", "cc-1"),
    ];
    
    expenseData.forEach(exp => this.expenses.set(exp.id, exp));

    // Add Tax Practice data
    const taxCategories: SpendCategory[] = [
      { id: "cat-4", name: "Compensation", color: "#3B82F6", costCenterId: "cc-2" },
      { id: "cat-5", name: "Technology", color: "#8B5CF6", costCenterId: "cc-2" },
      { id: "cat-6", name: "Training", color: "#EC4899", costCenterId: "cc-2" },
    ];
    taxCategories.forEach(cat => this.spendCategories.set(cat.id, cat));

    const taxBudgets: Budget[] = [
      { id: "bud-4", categoryId: "cat-4", amount: 180000, year: 2025 },
      { id: "bud-5", categoryId: "cat-5", amount: 45000, year: 2025 },
      { id: "bud-6", categoryId: "cat-6", amount: 25000, year: 2025 },
    ];
    taxBudgets.forEach(bud => this.budgets.set(bud.id, bud));

    const taxExpenses: Expense[] = [
      ...this.generateFixedExpenses("cat-4", "cc-2", 165000, 85, null),
      ...this.generateFixedExpenses("cat-5", "cc-2", 42000, 28, "Software Licenses"),
      ...this.generateFixedExpenses("cat-6", "cc-2", 18500, 15, "Certifications"),
    ];
    taxExpenses.forEach(exp => this.expenses.set(exp.id, exp));
  }

  private generateFixedExpenses(categoryId: string, costCenterId: string, total: number, count: number, programCategory: string | null): Expense[] {
    const expenses: Expense[] = [];
    const amountPerItem = total / count;
    
    for (let i = 0; i < count; i++) {
      expenses.push({
        id: randomUUID(),
        description: `Expense item ${i + 1}`,
        amount: amountPerItem,
        categoryId,
        costCenterId,
        programCategory,
        month: 12,
        year: 2025,
      });
    }
    
    return expenses;
  }

  private generateProgramExpenses(categoryId: string, costCenterId: string): Expense[] {
    const expenses: Expense[] = [];
    // Total for Program - General should be $25,738 with 67 items
    // Breakdown displayed in Program Spend panel (over $1k):
    // Professional Services: 6 items
    // Travel (Transportation): 6 items
    // Other: 40 items
    // Plus additional small items: 15 items
    
    // Professional Services: 6 items, scaled proportionally
    const profServicesTotal = 10500; // ~41% of program spend
    for (let i = 0; i < 6; i++) {
      expenses.push({
        id: randomUUID(),
        description: `Professional Services ${i + 1}`,
        amount: profServicesTotal / 6,
        categoryId,
        costCenterId,
        programCategory: "Professional Services",
        month: 12,
        year: 2025,
      });
    }
    
    // Travel (Transportation): 6 items
    const travelTotal = 7200;
    for (let i = 0; i < 6; i++) {
      expenses.push({
        id: randomUUID(),
        description: `Travel expense ${i + 1}`,
        amount: travelTotal / 6,
        categoryId,
        costCenterId,
        programCategory: "Travel (Transportation)",
        month: 12,
        year: 2025,
      });
    }
    
    // Other: 40 items
    const otherTotal = 5500;
    for (let i = 0; i < 40; i++) {
      expenses.push({
        id: randomUUID(),
        description: `Other expense ${i + 1}`,
        amount: otherTotal / 40,
        categoryId,
        costCenterId,
        programCategory: "Other",
        month: 12,
        year: 2025,
      });
    }
    
    // Small miscellaneous items (15 items, under $1k total each)
    const miscTotal = 2538; // Remaining to reach $25,738
    for (let i = 0; i < 15; i++) {
      expenses.push({
        id: randomUUID(),
        description: `Miscellaneous ${i + 1}`,
        amount: miscTotal / 15,
        categoryId,
        costCenterId,
        programCategory: "Supplies",
        month: 12,
        year: 2025,
      });
    }
    
    return expenses;
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
    };
    this.expenses.set(id, newExpense);
    return newExpense;
  }

  async getDashboardSummary(costCenterId: string): Promise<DashboardSummary> {
    const categories = await this.getSpendCategories(costCenterId);
    const expenses = await this.getExpenses(costCenterId);
    
    // Calculate spend type breakdown
    const spendTypeBreakdown: SpendTypeBreakdown[] = [];
    let totalActual = 0;
    let totalBudget = 0;
    
    for (const category of categories) {
      const categoryExpenses = expenses.filter(e => e.categoryId === category.id);
      const actual = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
      const budgets = await this.getBudgets(category.id);
      const budget = budgets.find(b => b.year === 2025)?.amount || 0;
      
      totalActual += actual;
      totalBudget += budget;
      
      const variance = budget - actual;
      const percentUsed = budget > 0 ? Math.round((actual / budget) * 100) : 0;
      
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
    
    // Calculate program spend breakdown (from Program - General category)
    const programCategoryExpenses = expenses.filter(e => e.programCategory);
    const programGroups = new Map<string, { count: number; amount: number }>();
    
    for (const expense of programCategoryExpenses) {
      const key = expense.programCategory!;
      const existing = programGroups.get(key) || { count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += expense.amount;
      programGroups.set(key, existing);
    }
    
    const programColors: Record<string, string> = {
      "Professional Services": "#F59E0B",
      "Travel (Transportation)": "#8B5CF6",
      "Other": "#10B981",
      "Software Licenses": "#3B82F6",
      "Certifications": "#EC4899",
    };
    
    const programSpendBreakdown: ProgramSpendItem[] = Array.from(programGroups.entries())
      .filter(([_, data]) => data.amount >= 1000)
      .map(([category, data]) => ({
        category,
        itemCount: data.count,
        amount: Math.round(data.amount),
        color: programColors[category] || "#6B7280",
      }))
      .sort((a, b) => b.amount - a.amount);
    
    const totalProgramSpend = programSpendBreakdown.reduce((sum, item) => sum + item.amount, 0);
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
}

export const storage = new MemStorage();
