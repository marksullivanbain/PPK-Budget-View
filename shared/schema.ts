import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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
  postedBy: text("posted_by"),
  vendorName: text("vendor_name"),
  period: text("period"),
  spendType: text("spend_type"),
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

export interface DashboardSummary {
  totalSpend: number;
  totalBudget: number;
  budgetUsedPercent: number;
  variance: number;
  isUnderBudget: boolean;
  spendTypeBreakdown: SpendTypeBreakdown[];
  programSpendBreakdown: ProgramSpendItem[];
  totalProgramSpend: number;
}

// Expense detail for drill-down view
export interface ExpenseDetail {
  id: string;
  lineDescription: string;
  spendType: string;
  summaryAccount: string;
  postedBy: string;
  period: string;
  amount: number;
  vendorName: string;
}
