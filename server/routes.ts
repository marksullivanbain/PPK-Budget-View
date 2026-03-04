import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./replit_integrations/auth";
import { getPracticesForEmail, hasAccessToPractice } from "./access-control";
import { generateVarianceSummary } from "./ai-summary";

// Helper to get user email from request
function getUserEmail(req: Request): string | null {
  const user = req.user as any;
  return user?.claims?.email || null;
}

// Helper to check if user has "All Practices" access
function hasAllPracticesAccess(email: string): boolean {
  const practices = getPracticesForEmail(email);
  return practices !== null && practices.includes('All Practices');
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Get user access info (whether they can see "All Practices" view)
  app.get("/api/user-access", isAuthenticated, async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      const canSeeAllPractices = hasAllPracticesAccess(userEmail || '');
      res.json({ canSeeAllPractices });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user access" });
    }
  });

  app.get("/api/latest-month", isAuthenticated, async (req, res) => {
    try {
      const year = parseInt(req.query.year as string) || 2026;
      const latestMonth = storage.getLatestMonth(year);
      res.json({ year, latestMonth });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch latest month" });
    }
  });

  // Get all cost centers (filtered by user access)
  app.get("/api/cost-centers", isAuthenticated, async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      const allowedPractices = getPracticesForEmail(userEmail || '');
      
      let costCenters = await storage.getCostCenters();
      
      // Filter cost centers if access control is enabled
      if (allowedPractices !== null && allowedPractices.length > 0) {
        // "All Practices" grants access to everything
        if (allowedPractices.includes('All Practices')) {
          // Return all cost centers
        } else {
          costCenters = costCenters.filter(cc => 
            allowedPractices.includes(cc.name)
          );
        }
      } else if (allowedPractices !== null && allowedPractices.length === 0) {
        // User has no access to any practice
        costCenters = [];
      }
      // If allowedPractices is null, no access control - return all
      
      res.json(costCenters);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cost centers" });
    }
  });

  // Get dashboard summary for a cost center
  app.get("/api/dashboard/:costCenterId", isAuthenticated, async (req, res) => {
    try {
      const costCenterId = req.params.costCenterId as string;
      const userEmail = getUserEmail(req);
      
      // Parse period filter parameters
      const periodMode = (req.query.periodMode as 'ytd' | 'month') || 'ytd';
      const month = parseInt(req.query.month as string) || 12;
      const year = parseInt(req.query.year as string) || 2026;
      const caseGroupFilter = req.query.caseGroup as string | undefined;
      
      // Allow "all" as a special case for combined view
      if (costCenterId !== "all") {
        const costCenter = await storage.getCostCenter(costCenterId);
        if (!costCenter) {
          return res.status(404).json({ error: "Cost center not found" });
        }
        
        // Check access
        if (!hasAccessToPractice(userEmail || '', costCenter.name)) {
          return res.status(403).json({ error: "Access denied to this practice" });
        }
      }
      
      const summary = await storage.getDashboardSummary(costCenterId, periodMode, month, caseGroupFilter, year);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });

  // Get spend categories for a cost center
  app.get("/api/cost-centers/:costCenterId/categories", isAuthenticated, async (req, res) => {
    try {
      const costCenterId = req.params.costCenterId as string;
      const userEmail = getUserEmail(req);
      
      // Validate cost center exists and check access
      const costCenter = await storage.getCostCenter(costCenterId);
      if (!costCenter) {
        return res.status(404).json({ error: "Cost center not found" });
      }
      if (!hasAccessToPractice(userEmail || '', costCenter.name)) {
        return res.status(403).json({ error: "Access denied to this practice" });
      }
      
      const categories = await storage.getSpendCategories(costCenterId);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Get expenses for a cost center
  app.get("/api/cost-centers/:costCenterId/expenses", isAuthenticated, async (req, res) => {
    try {
      const costCenterId = req.params.costCenterId as string;
      const userEmail = getUserEmail(req);
      
      // Validate cost center exists and check access
      const costCenter = await storage.getCostCenter(costCenterId);
      if (!costCenter) {
        return res.status(404).json({ error: "Cost center not found" });
      }
      if (!hasAccessToPractice(userEmail || '', costCenter.name)) {
        return res.status(403).json({ error: "Access denied to this practice" });
      }
      
      const expenses = await storage.getExpenses(costCenterId);
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  // Get expense details for drill-down (filtered by category or program)
  app.get("/api/cost-centers/:costCenterId/expense-details", isAuthenticated, async (req, res) => {
    try {
      const costCenterId = req.params.costCenterId as string;
      const userEmail = getUserEmail(req);
      const { filterType, filterValue, periodMode, month, caseGroup, year: yearParam } = req.query;
      const year = yearParam ? parseInt(yearParam as string) : 2025;
      
      // Validate cost center exists and check access
      const costCenter = await storage.getCostCenter(costCenterId);
      if (!costCenter) {
        return res.status(404).json({ error: "Cost center not found" });
      }
      if (!hasAccessToPractice(userEmail || '', costCenter.name)) {
        return res.status(403).json({ error: "Access denied to this practice" });
      }
      
      if (!filterType || !filterValue) {
        return res.status(400).json({ error: "filterType and filterValue are required" });
      }
      
      if (filterType !== 'category' && filterType !== 'program' && filterType !== 'account' && filterType !== 'caseCode') {
        return res.status(400).json({ error: "filterType must be 'category', 'program', 'account', or 'caseCode'" });
      }
      
      const details = await storage.getExpenseDetails(
        costCenterId, 
        filterType as 'category' | 'program' | 'account' | 'caseCode', 
        filterValue as string,
        periodMode as 'ytd' | 'month' | undefined,
        month ? parseInt(month as string) : undefined,
        caseGroup as string | undefined,
        year
      );
      res.json(details);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expense details" });
    }
  });

  // Get key variances across all practices (for "All Practices" view)
  app.get("/api/key-variances", isAuthenticated, async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      const allowedPractices = getPracticesForEmail(userEmail || '');
      
      // Only allow users with "All Practices" access
      if (!allowedPractices || !allowedPractices.includes('All Practices')) {
        return res.status(403).json({ error: "Access denied - requires All Practices access" });
      }
      
      const periodMode = (req.query.periodMode as 'ytd' | 'month') || 'ytd';
      const month = parseInt(req.query.month as string) || 12;
      const limit = parseInt(req.query.limit as string) || 20;
      const year = parseInt(req.query.year as string) || 2026;
      
      const variances = await storage.getKeyVariances(periodMode, month, limit, year);
      res.json(variances);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch key variances" });
    }
  });

  app.get("/api/admin-summary", isAuthenticated, async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      const allowedPractices = getPracticesForEmail(userEmail || '');

      if (!allowedPractices || !allowedPractices.includes('All Practices')) {
        return res.status(403).json({ error: "Access denied - requires All Practices access" });
      }

      const periodMode = (req.query.periodMode as 'ytd' | 'month') || 'ytd';
      const month = parseInt(req.query.month as string) || 12;
      const year = parseInt(req.query.year as string) || 2026;

      const summary = await storage.getAdminSummary(periodMode, month, year);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch admin summary" });
    }
  });

  app.get("/api/admin-summary/expense-details", isAuthenticated, async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      const allowedPractices = getPracticesForEmail(userEmail || '');

      if (!allowedPractices || !allowedPractices.includes('All Practices')) {
        return res.status(403).json({ error: "Access denied - requires All Practices access" });
      }

      const { practice, spendType, periodMode, month, year: yearParam } = req.query;
      if (!practice || !spendType) {
        return res.status(400).json({ error: "practice and spendType are required" });
      }

      const validSpendTypes = ['compensation', 'programs', 'databases', 'bcn'];
      if (!validSpendTypes.includes(spendType as string)) {
        return res.status(400).json({ error: `spendType must be one of: ${validSpendTypes.join(', ')}` });
      }

      const year = parseInt(yearParam as string) || 2026;
      const pm = (periodMode as 'ytd' | 'month') || 'ytd';
      const m = parseInt(month as string) || 12;
      const details = await storage.getAdminExpenseDetails(
        practice as string,
        spendType as string,
        pm,
        m,
        year
      );
      res.json(details);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch admin expense details" });
    }
  });

  // Get IP Teams practices list
  app.get("/api/ip-teams/practices", isAuthenticated, async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      const allowedPractices = getPracticesForEmail(userEmail || '');
      const year = parseInt(req.query.year as string) || 2026;
      
      const allPractices = await storage.getIPTeamsPractices(year);
      
      // Filter practices based on access control
      let filteredPractices = allPractices;
      if (allowedPractices !== null && !allowedPractices.includes('All Practices')) {
        filteredPractices = allPractices.filter(p => allowedPractices.includes(p));
      }
      
      res.json(filteredPractices);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch IP teams practices" });
    }
  });

  // Get IP Teams data
  app.get("/api/ip-teams/data", isAuthenticated, async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      const allowedPractices = getPracticesForEmail(userEmail || '');
      const practice = req.query.practice as string | null;
      const month = parseInt(req.query.month as string) || 12;
      const year = parseInt(req.query.year as string) || 2026;
      
      // Check access to requested practice
      if (practice && allowedPractices !== null && !allowedPractices.includes('All Practices')) {
        if (!allowedPractices.includes(practice)) {
          return res.status(403).json({ error: "Access denied to this practice" });
        }
      }
      
      const data = await storage.getIPTeamsData(practice, month, allowedPractices, year);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch IP teams data" });
    }
  });

  // Get monthly trends for a cost center
  app.get("/api/cost-centers/:costCenterId/trends", isAuthenticated, async (req, res) => {
    try {
      const costCenterId = req.params.costCenterId as string;
      const userEmail = getUserEmail(req);
      
      // Validate cost center exists and check access
      const costCenter = await storage.getCostCenter(costCenterId);
      if (!costCenter) {
        return res.status(404).json({ error: "Cost center not found" });
      }
      if (!hasAccessToPractice(userEmail || '', costCenter.name)) {
        return res.status(403).json({ error: "Access denied to this practice" });
      }
      
      const year = parseInt(req.query.year as string) || 2026;
      const trends = await storage.getMonthlyTrends(costCenterId, year);
      res.json(trends);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trend data" });
    }
  });

  // Dynamic Budget Tracking endpoints
  
  // Get dynamic budget data for a practice
  app.get("/api/budget-tracking/:practiceId", isAuthenticated, async (req, res) => {
    try {
      const practiceId = req.params.practiceId as string;
      const month = parseInt(req.query.month as string) || 12;
      const year = parseInt(req.query.year as string) || 2026;
      const userEmail = getUserEmail(req);
      
      const costCenter = await storage.getCostCenter(practiceId);
      if (!costCenter) {
        return res.status(404).json({ error: "Practice not found" });
      }
      if (!hasAccessToPractice(userEmail || '', costCenter.name)) {
        return res.status(403).json({ error: "Access denied to this practice" });
      }
      
      const data = await storage.getDynamicBudgetData(practiceId, month, year);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch budget tracking data" });
    }
  });

  // Create a new budget group
  app.post("/api/budget-tracking/:practiceId/groups", isAuthenticated, async (req, res) => {
    try {
      const practiceId = req.params.practiceId as string;
      const userEmail = getUserEmail(req);
      
      const costCenter = await storage.getCostCenter(practiceId);
      if (!costCenter) {
        return res.status(404).json({ error: "Practice not found" });
      }
      if (!hasAccessToPractice(userEmail || '', costCenter.name)) {
        return res.status(403).json({ error: "Access denied to this practice" });
      }
      
      const { name, allocatedBudget, displayOrder } = req.body;
      const group = await storage.createBudgetGroup({
        practiceId,
        name: name || 'New Group',
        allocatedBudget: allocatedBudget || 0,
        displayOrder: displayOrder || 0
      });
      
      res.json(group);
    } catch (error) {
      res.status(500).json({ error: "Failed to create budget group" });
    }
  });

  // Update a budget group
  app.put("/api/budget-tracking/groups/:groupId", isAuthenticated, async (req, res) => {
    try {
      const groupId = req.params.groupId as string;
      const userEmail = getUserEmail(req);

      const group = await storage.getBudgetGroupById(groupId);
      if (!group) {
        return res.status(404).json({ error: "Budget group not found" });
      }
      const costCenter = await storage.getCostCenter(group.practiceId);
      if (costCenter && !hasAccessToPractice(userEmail || '', costCenter.name)) {
        return res.status(403).json({ error: "Access denied to this practice" });
      }

      const { name, allocatedBudget, displayOrder } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (allocatedBudget !== undefined) updates.allocatedBudget = allocatedBudget;
      if (displayOrder !== undefined) updates.displayOrder = displayOrder;
      
      const updated = await storage.updateBudgetGroup(groupId, updates);
      if (!updated) {
        return res.status(404).json({ error: "Budget group not found" });
      }
      
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update budget group" });
    }
  });

  // Delete a budget group
  app.delete("/api/budget-tracking/groups/:groupId", isAuthenticated, async (req, res) => {
    try {
      const groupId = req.params.groupId as string;
      const userEmail = getUserEmail(req);

      const group = await storage.getBudgetGroupById(groupId);
      if (!group) {
        return res.status(404).json({ error: "Budget group not found" });
      }
      const costCenter = await storage.getCostCenter(group.practiceId);
      if (costCenter && !hasAccessToPractice(userEmail || '', costCenter.name)) {
        return res.status(403).json({ error: "Access denied to this practice" });
      }

      const success = await storage.deleteBudgetGroup(groupId);
      if (!success) {
        return res.status(404).json({ error: "Budget group not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete budget group" });
    }
  });

  // Assign a case code to a budget group
  app.post("/api/budget-tracking/:practiceId/assign", isAuthenticated, async (req, res) => {
    try {
      const practiceId = req.params.practiceId as string;
      const { caseCode, groupId } = req.body;
      const userEmail = getUserEmail(req);
      
      const costCenter = await storage.getCostCenter(practiceId);
      if (!costCenter) {
        return res.status(404).json({ error: "Practice not found" });
      }
      if (!hasAccessToPractice(userEmail || '', costCenter.name)) {
        return res.status(403).json({ error: "Access denied to this practice" });
      }
      
      if (!groupId) {
        // Remove from group (unassign)
        await storage.removeCaseCodeFromGroup(practiceId, caseCode);
        res.json({ success: true, unassigned: true });
      } else {
        // Assign to group
        const mapping = await storage.assignCaseCodeToGroup(practiceId, caseCode, groupId);
        res.json(mapping);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to assign case code" });
    }
  });

  // Export expense data for a budget group's case codes as CSV
  app.get("/api/budget-tracking/:practiceId/export/:groupId", isAuthenticated, async (req, res) => {
    try {
      const { practiceId, groupId } = req.params;
      const month = parseInt(req.query.month as string) || 12;
      const year = parseInt(req.query.year as string) || 2026;
      const userEmail = getUserEmail(req);

      const costCenter = await storage.getCostCenter(practiceId);
      if (!costCenter) {
        return res.status(404).json({ error: "Practice not found" });
      }
      if (!hasAccessToPractice(userEmail || '', costCenter.name)) {
        return res.status(403).json({ error: "Access denied to this practice" });
      }

      const data = await storage.getDynamicBudgetData(practiceId, month, year);
      const group = data.groups.find(g => g.id === groupId);
      if (!group) {
        return res.status(404).json({ error: "Budget group not found" });
      }

      const caseCodes = group.caseCodes.map(cc => cc.caseCode);
      const expenses = await storage.getExpensesForCaseCodes(practiceId, caseCodes, month, year);

      const headers = ["Practice", "Budget Group", "Case Code", "Case Name", "Account Name", "Summary Account", "Period", "Line Description", "Document Description", "T&E Employee", "Vendor", "Amount"];
      const csvRows = [headers.join(",")];
      for (const exp of expenses) {
        const row = [
          csvEscape(costCenter.name),
          csvEscape(group.name),
          csvEscape(exp.caseCode || ''),
          csvEscape(exp.caseName || ''),
          csvEscape(exp.accountName || ''),
          csvEscape(exp.summaryAccount || ''),
          csvEscape(exp.period || ''),
          csvEscape(exp.lineDescription || ''),
          csvEscape(exp.documentDescription || ''),
          csvEscape(exp.teeEmployeeName || ''),
          csvEscape(exp.vendorName || ''),
          exp.amount.toString()
        ];
        csvRows.push(row.join(","));
      }

      const csv = csvRows.join("\n");
      const filename = `${costCenter.name.replace(/[^a-zA-Z0-9]/g, '_')}_${group.name.replace(/[^a-zA-Z0-9]/g, '_')}_expenses.csv`;
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // Travel Detail endpoints
  app.get("/api/travel/:costCenterId/summary", isAuthenticated, async (req, res) => {
    try {
      const { costCenterId } = req.params;
      const periodMode = (req.query.periodMode as string) || 'ytd';
      const month = parseInt(req.query.month as string) || 12;
      const year = parseInt(req.query.year as string) || 2026;
      
      const userEmail = getUserEmail(req);
      if (!userEmail) {
        return res.status(403).json({ error: "No email found" });
      }

      const allowedPractices = getPracticesForEmail(userEmail);

      if (costCenterId !== "all") {
        const costCenter = await storage.getCostCenter(costCenterId);
        if (!costCenter) {
          return res.status(404).json({ error: "Cost center not found" });
        }
        if (!hasAccessToPractice(userEmail, costCenter.name)) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      const summary = await storage.getTravelSummaryByCaseCode(
        costCenterId,
        periodMode as 'ytd' | 'month',
        month,
        allowedPractices,
        year
      );
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch travel summary" });
    }
  });

  app.get("/api/travel/:costCenterId/expenses", isAuthenticated, async (req, res) => {
    try {
      const { costCenterId } = req.params;
      const caseCode = req.query.caseCode as string;
      const periodMode = (req.query.periodMode as string) || 'ytd';
      const month = parseInt(req.query.month as string) || 12;
      const year = parseInt(req.query.year as string) || 2026;
      
      if (!caseCode) {
        return res.status(400).json({ error: "caseCode query parameter required" });
      }
      
      const userEmail = getUserEmail(req);
      if (!userEmail) {
        return res.status(403).json({ error: "No email found" });
      }

      const allowedPractices = getPracticesForEmail(userEmail);

      if (costCenterId !== "all") {
        const costCenter = await storage.getCostCenter(costCenterId);
        if (!costCenter) {
          return res.status(404).json({ error: "Cost center not found" });
        }
        if (!hasAccessToPractice(userEmail, costCenter.name)) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
      
      const expenses = await storage.getTravelExpenseDetails(
        costCenterId,
        caseCode,
        periodMode as 'ytd' | 'month',
        month,
        allowedPractices,
        year
      );
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch travel expenses" });
    }
  });

  app.post("/api/ai-summary", isAuthenticated, async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      if (!userEmail) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { costCenterId, periodMode = 'ytd', month = 1, year = 2026 } = req.body;
      if (!costCenterId) {
        return res.status(400).json({ error: "costCenterId is required" });
      }

      if (costCenterId === "all") {
        if (!hasAllPracticesAccess(userEmail)) {
          return res.status(403).json({ error: "Access denied" });
        }
      } else {
        const costCenter = await storage.getCostCenter(costCenterId);
        if (!costCenter) {
          return res.status(404).json({ error: "Cost center not found" });
        }
        if (!hasAccessToPractice(userEmail, costCenter.name)) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      const dashboardData = await storage.getDashboardSummary(
        costCenterId,
        periodMode,
        month,
        undefined,
        year
      );

      const costCenter = costCenterId === "all"
        ? { name: "All Practices" }
        : await storage.getCostCenter(costCenterId);

      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const periodLabel = periodMode === 'ytd'
        ? `YTD through ${monthNames[month - 1]} ${year}`
        : `${monthNames[month - 1]} ${year}`;

      const summary = await generateVarianceSummary({
        practiceName: costCenter!.name,
        periodLabel,
        totalSpend: dashboardData.totalSpend,
        totalBudget: dashboardData.totalBudget,
        variance: dashboardData.variance,
        isUnderBudget: dashboardData.isUnderBudget,
        spendTypeBreakdown: dashboardData.spendTypeBreakdown.map(s => ({
          categoryName: s.categoryName,
          actual: s.actual,
          budget: s.budget,
          variance: s.variance,
          isOverBudget: s.isOverBudget,
          percentUsed: s.percentUsed,
        })),
        topExpenses: (dashboardData.programByCaseCode || []).slice(0, 8).map(e => ({
          account: e.account,
          amount: e.amount,
          caseName: e.caseName,
        })),
        compensationBreakdown: (dashboardData.compensationByAccount || []).map(c => ({
          account: c.account,
          amount: c.amount,
        })),
      });

      res.json({ summary });
    } catch (error: any) {
      console.error("AI summary error:", error?.message || error);
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });

  return httpServer;
}
