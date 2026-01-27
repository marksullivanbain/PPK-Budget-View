import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { KpiCard } from "@/components/kpi-card";
import { SpendTypeBreakdown } from "@/components/spend-type-breakdown";
import { ProgramSpendBreakdown } from "@/components/program-spend-breakdown";
import { ExpenseDetails } from "@/components/expense-details";
import { CostCenterSelector } from "@/components/cost-center-selector";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { CostCenter, DashboardSummary } from "@shared/schema";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function KpiCardSkeleton() {
  return (
    <Card className="p-5 flex flex-col gap-3 border-card-border">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
      </div>
      <div className="flex flex-col gap-1">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    </Card>
  );
}

function BreakdownCardSkeleton() {
  return (
    <Card className="p-5 flex flex-col border-card-border h-full">
      <div className="flex flex-col gap-1 mb-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex-1 flex flex-col gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>("");
  const [selectedSpendCategory, setSelectedSpendCategory] = useState<string | null>(null);
  const [selectedProgramCategory, setSelectedProgramCategory] = useState<string | null>(null);
  const [periodMode, setPeriodMode] = useState<'ytd' | 'month'>('ytd');
  const [selectedMonth, setSelectedMonth] = useState<number>(12);

  const { data: costCenters, isLoading: costCentersLoading } = useQuery<CostCenter[]>({
    queryKey: ['/api/cost-centers'],
  });
  
  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user) return '';
    const first = user.firstName?.[0] || '';
    const last = user.lastName?.[0] || '';
    return (first + last).toUpperCase() || user.email?.[0]?.toUpperCase() || '?';
  };

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardSummary>({
    queryKey: ['/api/dashboard', selectedCostCenterId, periodMode, selectedMonth],
    queryFn: async () => {
      const url = `/api/dashboard/${selectedCostCenterId}?periodMode=${periodMode}&month=${selectedMonth}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    },
    enabled: !!selectedCostCenterId,
  });

  // Set initial cost center when data loads
  if (costCenters && costCenters.length > 0 && !selectedCostCenterId) {
    setSelectedCostCenterId(costCenters[0].id);
  }

  const handleSpendCategoryClick = (categoryId: string) => {
    if (selectedSpendCategory === categoryId) {
      setSelectedSpendCategory(null);
    } else {
      setSelectedSpendCategory(categoryId);
      setSelectedProgramCategory(null);
    }
  };

  const handleProgramCategoryClick = (category: string) => {
    if (selectedProgramCategory === category) {
      setSelectedProgramCategory(null);
    } else {
      setSelectedProgramCategory(category);
      setSelectedSpendCategory(null);
    }
  };

  const clearFilter = () => {
    setSelectedSpendCategory(null);
    setSelectedProgramCategory(null);
  };

  const getSelectedSpendCategoryInfo = () => {
    if (!selectedSpendCategory || !dashboardData) return null;
    const category = dashboardData.spendTypeBreakdown.find(c => c.categoryId === selectedSpendCategory);
    return category ? { label: category.categoryName, color: category.color } : null;
  };

  const getSelectedProgramInfo = () => {
    if (!selectedProgramCategory || !dashboardData) return null;
    const program = dashboardData.programSpendBreakdown.find(p => p.category === selectedProgramCategory);
    return program ? { label: program.category, color: program.color } : null;
  };

  const isLoading = costCentersLoading || dashboardLoading || !dashboardData;
  const selectedCostCenter = costCenters?.find(c => c.id === selectedCostCenterId);

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col gap-4 mb-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground" data-testid="text-dashboard-title">
                2025 {selectedCostCenter?.name || 'Expense'} Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                {periodMode === 'ytd' 
                  ? `YTD through ${MONTH_NAMES[selectedMonth - 1]} Actuals vs. Budget`
                  : `${MONTH_NAMES[selectedMonth - 1]} Actuals vs. Budget`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {user && (
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || 'User'} />
                    <AvatarFallback className="bg-primary/20 text-primary text-sm">{getUserInitials()}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground hidden md:inline">
                    {user.firstName} {user.lastName}
                  </span>
                </div>
              )}
              <Button variant="outline" size="sm" asChild className="gap-1.5" data-testid="button-logout">
                <a href="/api/logout">
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign out</span>
                </a>
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select 
                value={periodMode} 
                onValueChange={(value: 'ytd' | 'month') => setPeriodMode(value)}
              >
                <SelectTrigger className="w-[120px]" data-testid="select-period-mode">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ytd">YTD</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
              <Select 
                value={selectedMonth.toString()} 
                onValueChange={(value) => setSelectedMonth(parseInt(value))}
              >
                <SelectTrigger className="w-[140px]" data-testid="select-month">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((month, index) => (
                    <SelectItem key={index + 1} value={(index + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {costCenters && costCenters.length > 0 && (
              <CostCenterSelector
                costCenters={costCenters}
                selectedId={selectedCostCenterId}
                onSelect={setSelectedCostCenterId}
              />
            )}
          </div>
        </header>

        {isLoading ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <KpiCardSkeleton key={i} />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BreakdownCardSkeleton />
              <BreakdownCardSkeleton />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KpiCard
                title="Total Spend"
                value={formatCurrency(Math.round(dashboardData.totalSpend))}
                subtitle="Actual expenses"
                icon="dollar"
              />
              <KpiCard
                title="Total Budget"
                value={formatCurrency(Math.round(dashboardData.totalBudget))}
                subtitle="Annual budget"
                icon="settings"
              />
              <KpiCard
                title="Budget Used"
                value={formatPercent(dashboardData.budgetUsedPercent)}
                subtitle="Of total budget"
                icon="chart"
              />
              <KpiCard
                title="Variance"
                value={`${dashboardData.isUnderBudget ? '+' : '-'}${formatCurrency(Math.round(Math.abs(dashboardData.variance)))}`}
                subtitle={dashboardData.isUnderBudget ? "Under budget" : "Over budget"}
                icon="variance"
                trend={dashboardData.isUnderBudget ? "down" : "up"}
                accentColor={dashboardData.isUnderBudget ? "green" : "default"}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <SpendTypeBreakdown
                data={dashboardData.spendTypeBreakdown}
                totalActual={dashboardData.totalSpend}
                totalBudget={dashboardData.totalBudget}
                variance={dashboardData.variance}
                onCategoryClick={handleSpendCategoryClick}
                selectedCategory={selectedSpendCategory}
              />
              <ProgramSpendBreakdown
                data={dashboardData.programSpendBreakdown}
                totalProgramSpend={dashboardData.totalProgramSpend}
                onCategoryClick={handleProgramCategoryClick}
                selectedCategory={selectedProgramCategory}
              />
            </div>

            {selectedSpendCategory && getSelectedSpendCategoryInfo() && (
              <ExpenseDetails
                costCenterId={selectedCostCenterId}
                filterType="category"
                filterValue={selectedSpendCategory}
                filterLabel={getSelectedSpendCategoryInfo()!.label}
                filterColor={getSelectedSpendCategoryInfo()!.color}
                onClearFilter={clearFilter}
              />
            )}

            {selectedProgramCategory && getSelectedProgramInfo() && (
              <ExpenseDetails
                costCenterId={selectedCostCenterId}
                filterType="program"
                filterValue={selectedProgramCategory}
                filterLabel={getSelectedProgramInfo()!.label}
                filterColor={getSelectedProgramInfo()!.color}
                onClearFilter={clearFilter}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
