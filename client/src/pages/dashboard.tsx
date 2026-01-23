import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { KpiCard } from "@/components/kpi-card";
import { SpendTypeBreakdown } from "@/components/spend-type-breakdown";
import { ProgramSpendBreakdown } from "@/components/program-spend-breakdown";
import { CostCenterSelector } from "@/components/cost-center-selector";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
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

export default function Dashboard() {
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>("");
  const [selectedSpendCategory, setSelectedSpendCategory] = useState<string | null>(null);
  const [selectedProgramCategory, setSelectedProgramCategory] = useState<string | null>(null);

  const { data: costCenters, isLoading: costCentersLoading } = useQuery<CostCenter[]>({
    queryKey: ['/api/cost-centers'],
  });

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardSummary>({
    queryKey: ['/api/dashboard', selectedCostCenterId],
    enabled: !!selectedCostCenterId,
  });

  // Set initial cost center when data loads
  if (costCenters && costCenters.length > 0 && !selectedCostCenterId) {
    setSelectedCostCenterId(costCenters[0].id);
  }

  const handleSpendCategoryClick = (categoryId: string) => {
    setSelectedSpendCategory(prev => prev === categoryId ? null : categoryId);
  };

  const handleProgramCategoryClick = (category: string) => {
    setSelectedProgramCategory(prev => prev === category ? null : category);
  };

  const isLoading = costCentersLoading || dashboardLoading || !dashboardData;
  const selectedCostCenter = costCenters?.find(c => c.id === selectedCostCenterId);

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground" data-testid="text-dashboard-title">
              2025 {selectedCostCenter?.name || 'Expense'} Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">December Month Actuals vs. Budget</p>
          </div>
          {costCenters && costCenters.length > 0 && (
            <CostCenterSelector
              costCenters={costCenters}
              selectedId={selectedCostCenterId}
              onSelect={setSelectedCostCenterId}
            />
          )}
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
                value={formatCurrency(dashboardData.totalSpend)}
                subtitle="Actual expenses"
                icon="dollar"
              />
              <KpiCard
                title="Total Budget"
                value={formatCurrency(dashboardData.totalBudget)}
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
                value={`${dashboardData.isUnderBudget ? '+' : '-'}${formatCurrency(Math.abs(dashboardData.variance))}`}
                subtitle={dashboardData.isUnderBudget ? "Under budget" : "Over budget"}
                icon="variance"
                trend={dashboardData.isUnderBudget ? "down" : "up"}
                accentColor={dashboardData.isUnderBudget ? "green" : "default"}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          </>
        )}
      </div>
    </div>
  );
}
