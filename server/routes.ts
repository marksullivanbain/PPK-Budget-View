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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Get all cost centers (filtered by user access)
  app.get("/api/cost-centers", isAuthenticated, async (req, res) => {
    try {
      const userEmail = getUserEmail(req);
      const allowedPractices = getPracticesForEmail(userEmail || '');
      
      let costCenters = await storage.getCostCenters();
      
      // Filter cost centers if access control is enabled
      if (allowedPractices !== null && allowedPractices.length > 0) {
        costCenters = costCenters.filter(cc => 
          allowedPractices.includes(cc.name)
        );
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
      
      const summary = await storage.getDashboardSummary(costCenterId);
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
      const { filterType, filterValue } = req.query;
      
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
      
      if (filterType !== 'category' && filterType !== 'program') {
        return res.status(400).json({ error: "filterType must be 'category' or 'program'" });
      }
      
      const details = await storage.getExpenseDetails(
        costCenterId, 
        filterType as 'category' | 'program', 
        filterValue as string
      );
      res.json(details);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expense details" });
    }
  });

  return httpServer;
}
