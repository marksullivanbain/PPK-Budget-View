import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Get all cost centers
  app.get("/api/cost-centers", async (req, res) => {
    try {
      const costCenters = await storage.getCostCenters();
      res.json(costCenters);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch cost centers" });
    }
  });

  // Get dashboard summary for a cost center
  app.get("/api/dashboard/:costCenterId", async (req, res) => {
    try {
      const { costCenterId } = req.params;
      
      // Allow "all" as a special case for combined view
      if (costCenterId !== "all") {
        const costCenter = await storage.getCostCenter(costCenterId);
        if (!costCenter) {
          return res.status(404).json({ error: "Cost center not found" });
        }
      }
      
      const summary = await storage.getDashboardSummary(costCenterId);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });

  // Get spend categories for a cost center
  app.get("/api/cost-centers/:costCenterId/categories", async (req, res) => {
    try {
      const { costCenterId } = req.params;
      const categories = await storage.getSpendCategories(costCenterId);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Get expenses for a cost center
  app.get("/api/cost-centers/:costCenterId/expenses", async (req, res) => {
    try {
      const { costCenterId } = req.params;
      const expenses = await storage.getExpenses(costCenterId);
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  // Get expense details for drill-down (filtered by category or program)
  app.get("/api/cost-centers/:costCenterId/expense-details", async (req, res) => {
    try {
      const { costCenterId } = req.params;
      const { filterType, filterValue } = req.query;
      
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
