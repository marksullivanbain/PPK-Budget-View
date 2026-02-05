import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// Cost Centers (e.g., M&A Practice, Tax Practice, etc.)
export const costCenters = pgTable("cost_centers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
});

export const insertCostCenterSchema = createInsertSchema(costCenters).omit({ id: true });
export type InsertCostCenter = z.infer<typeof insertCostCenterSchema>;
export type CostCenter = typeof costCenters.$inferSelect;

// Spend Categories (e.g., Compensation, Marketing, Program - General)
export const spendCategories = pgTable("spend_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  color: text("color").notNull(), // Hex color for the progress bar
  costCenterId: varchar("cost_center_id").notNull(),
});

export const insertSpendCategorySchema = createInsertSchema(spendCategories).omit({ id: true });
export type InsertSpendCategory = z.infer<typeof insertSpendCategorySchema>;
export type SpendCategory = typeof spendCategories.$inferSelect;

// Budgets (annual budget per category)
export const budgets = pgTable("budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull(),
  amount: real("amount").notNull(),
  year: integer("year").notNull(),
});

export const insertBudgetSchema = createInsertSchema(budgets).omit({ id: true });
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgets.$inferSelect;

// Expenses (individual expense items)
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  categoryId: varchar("category_id").notNull(),
  costCenterId: varchar("cost_center_id").notNull(),
  programCategory: text("program_category"), // e.g., Professional Services, Travel, Other
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  // Detail fields for drill-down view
  lineDescription: text("line_description"),
  summaryAccount: text("summary_account"),
  accountName: text("account_name"),
  caseCode: text("case_code"),
  caseName: text("case_name"),
  documentDescription: text("document_description"),
  postedBy: text("posted_by"),
  vendorName: text("vendor_name"),
  period: text("period"),
  spendType: text("spend_type"),
  sapInvoiceDocUrl: text("sap_invoice_doc_url"),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// Aggregated types for dashboard display
export interface SpendTypeBreakdown {
  categoryId: string;
  categoryName: string;
  color: string;
  actual: number;
  budget: number;
  itemCount: number;
  percentUsed: number;
  variance: number;
  isOverBudget: boolean;
}

export interface ProgramSpendItem {
  category: string;
  itemCount: number;
  amount: number;
  color: string;
}

export interface AccountSpendItem {
  account: string;
  amount: number;
  itemCount: number;
  color: string;
  caseName?: string; // For case code view - displays "code - name"
}

export interface DashboardSummary {
  totalSpend: number;
  totalBudget: number;
  budgetUsedPercent: number;
  variance: number;
  isUnderBudget: boolean;
  spendTypeBreakdown: SpendTypeBreakdown[];
  programSpendBreakdown: ProgramSpendItem[];
  totalProgramSpend: number;
  compensationByAccount: AccountSpendItem[];
  programByAccount: AccountSpendItem[];
  programByCaseCode: AccountSpendItem[];
}

// Expense detail for drill-down view
export interface ExpenseDetail {
  id: string;
  lineDescription: string;
  spendType: string;
  summaryAccount: string;
  caseCode: string;
  caseName: string;
  documentDescription: string;
  period: string;
  amount: number;
  vendorName: string;
  sapInvoiceDocUrl: string;
}

// Monthly trend data for visualization
export interface MonthlyTrendData {
  month: number;
  monthName: string;
  actual: number;
  budget: number;
  variance: number;
  compensationActual: number;
  compensationBudget: number;
  programActual: number;
  programBudget: number;
  // Case group breakdown (excluding Compensation)
  generalActual: number;
  databasesActual: number;
  bcnActual: number;
  ipActual: number;
  marketingActual: number;
}

// Key variance item for "All Practices" view
export interface KeyVarianceItem {
  practice: string;
  caseGroup: string;
  actual: number;
  budget: number;
  variance: number;
  isOverBudget: boolean;
  percentUsed: number;
}

// IP Teams data for investment tracking
export interface IPTeamEntry {
  id: string;
  costCenter: string;
  type: 'Traditional' | 'Interlock' | 'Rotations';
  interlock1: string;
  interlock2: string;
  interlock3: string;
  serviceLine: string;
  name: string;
  caseCode: string;
  caseName: string;
  level: string;
  percentage: number;
  monthlyAmounts: number[]; // 12 months (Jan-Dec)
  ytd: number;
  cy25: number; // Full year / estimated budget
}

export interface IPTeamSummary {
  costCenter: string;
  type: string;
  ytdActual: number;
  estimatedBudget: number;
  monthlyAmounts: number[];
}

export interface IPTeamData {
  practices: string[];
  traditionalRows: IPTeamEntry[];
  interlockRows: IPTeamEntry[];
  rotationsRows: IPTeamEntry[];
  traditionalSubtotal: IPTeamSummary;
  interlockSubtotal: IPTeamSummary;
  rotationsSubtotal: IPTeamSummary;
  grandTotal: IPTeamSummary;
}

// Dynamic Budget Groups (user-created groupings for case codes)
export const budgetGroups = pgTable("budget_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  practiceId: varchar("practice_id").notNull(), // Which practice this group belongs to
  name: text("name").notNull(), // User-defined group name
  allocatedBudget: real("allocated_budget").notNull().default(0), // Budget allocated to this group
  displayOrder: integer("display_order").notNull().default(0), // Order for display
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBudgetGroupSchema = createInsertSchema(budgetGroups).omit({ id: true, createdAt: true });
export type InsertBudgetGroup = z.infer<typeof insertBudgetGroupSchema>;
export type BudgetGroup = typeof budgetGroups.$inferSelect;

// Case Code to Budget Group mappings
export const caseCodeMappings = pgTable("case_code_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  budgetGroupId: varchar("budget_group_id").notNull(), // References budgetGroups.id
  caseCode: text("case_code").notNull(), // The case code being assigned
  practiceId: varchar("practice_id").notNull(), // Practice for quick lookup
});

export const insertCaseCodeMappingSchema = createInsertSchema(caseCodeMappings).omit({ id: true });
export type InsertCaseCodeMapping = z.infer<typeof insertCaseCodeMappingSchema>;
export type CaseCodeMapping = typeof caseCodeMappings.$inferSelect;

// Types for Dynamic Budget Tracking UI
export interface CaseCodeWithExpense {
  caseCode: string;
  caseName: string;
  ytdActual: number;
  groupId: string | null; // null if unassigned
}

export interface BudgetGroupWithCodes extends BudgetGroup {
  caseCodes: CaseCodeWithExpense[];
  ytdActual: number; // Sum of all case code actuals in this group
  fullYearBudget: number; // Same as allocatedBudget
  ytdBudget: number; // allocatedBudget * (month / 12)
  variance: number; // ytdBudget - ytdActual
}

export interface DynamicBudgetData {
  practiceId: string;
  practiceName: string;
  totalProgramBudget: number; // Total non-comp budget available
  totalAllocated: number; // Sum of all group allocations
  unallocatedBudget: number; // totalProgramBudget - totalAllocated
  groups: BudgetGroupWithCodes[];
  unassignedCaseCodes: CaseCodeWithExpense[];
}
