import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Trends from "@/pages/trends";
import IPTeamsPage from "@/pages/ip-teams";
import BudgetTracking from "@/pages/budget-tracking";
import TravelDetail from "@/pages/travel-detail";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LogIn, BarChart3 } from "lucide-react";

function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-primary/10 p-4 rounded-full">
            <BarChart3 className="h-12 w-12 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">Expense Tracking Dashboard</h1>
        <p className="text-muted-foreground mb-6">
          Sign in to view your practice's budget and expense data
        </p>
        <Button asChild size="lg" className="w-full gap-2">
          <a href="/api/login" data-testid="button-login">
            <LogIn className="h-5 w-5" />
            Sign in with Replit
          </a>
        </Button>
      </Card>
    </div>
  );
}

function LoadingPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/trends" component={Trends} />
      <Route path="/ip-teams" component={IPTeamsPage} />
      <Route path="/budget-tracking" component={BudgetTracking} />
      <Route path="/travel-detail" component={TravelDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingPage />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <Router />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
