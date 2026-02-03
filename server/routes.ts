import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./replit_integrations/auth";
import { getPracticesForEmail, hasAccessToPractice } from "./access-control";

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
      
      const summary = await storage.getDashboardSummary(costCenterId, periodMode, month, caseGroupFilter);
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
      const { filterType, filterValue, periodMode, month, caseGroup } = req.query;
      
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
        caseGroup as string | undefined
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
      
      const variances = await storage.getKeyVariances(periodMode, month, limit);
      res.json(variances);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch key variances" });
    }
  });

  // Get IP Teams practices list
  app.get("/api/ip-teams/practices", isAuthenticated, async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      const allowedPractices = getPracticesForEmail(userEmail || '');
      
      const allPractices = await storage.getIPTeamsPractices();
      
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
      
      // Check access to requested practice
      if (practice && allowedPractices !== null && !allowedPractices.includes('All Practices')) {
        if (!allowedPractices.includes(practice)) {
          return res.status(403).json({ error: "Access denied to this practice" });
        }
      }
      
      const data = await storage.getIPTeamsData(practice, month, allowedPractices);
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
      
      const trends = await storage.getMonthlyTrends(costCenterId);
      res.json(trends);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trend data" });
    }
  });

  return httpServer;
}
