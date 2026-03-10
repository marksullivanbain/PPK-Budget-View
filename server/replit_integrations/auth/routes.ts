import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { db } from "../../db";
import { loginEvents } from "../../../shared/schema";

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);

      if (user && !req.session.loginRecorded) {
        db.insert(loginEvents).values({
          email: (user.email || '').toLowerCase(),
          firstName: user.firstName,
          lastName: user.lastName,
        }).execute().then(() => {
          req.session.loginRecorded = true;
        }).catch((err: any) => console.error("Failed to record login:", err));
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
