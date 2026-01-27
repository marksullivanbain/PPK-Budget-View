import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CostCenterSelector } from "@/components/cost-center-selector";
import { LogOut, LayoutDashboard, TrendingUp, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { CostCenter, MonthlyTrendData } from "@shared/schema";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

function formatFullCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function ChartSkeleton() {
  return (
    <Card className="p-6 border-card-border">
      <Skeleton className="h-6 w-48 mb-6" />
      <Skeleton className="h-[300px] w-full" />
    </Card>
  );
}

export default function Trends() {
  const { user } = useAuth();
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>("");

  const { data: costCenters, isLoading: costCentersLoading } = useQuery<CostCenter[]>({
    queryKey: ['/api/cost-centers'],
  });

  const { data: trendData, isLoading: trendLoading } = useQuery<MonthlyTrendData[]>({
    queryKey: ['/api/cost-centers', selectedCostCenterId, 'trends'],
    queryFn: async () => {
      const response = await fetch(`/api/cost-centers/${selectedCostCenterId}/trends`, { 
        credentials: 'include' 
      });
      if (!response.ok) throw new Error('Failed to fetch trend data');
      return response.json();
    },
    enabled: !!selectedCostCenterId,
  });

  const getUserInitials = () => {
    if (!user) return '';
    const first = user.firstName?.[0] || '';
    const last = user.lastName?.[0] || '';
    return (first + last).toUpperCase() || user.email?.[0]?.toUpperCase() || '?';
  };

  if (costCenters && costCenters.length > 0 && !selectedCostCenterId) {
    setSelectedCostCenterId(costCenters[0].id);
  }

  const selectedCostCenter = costCenters?.find(c => c.id === selectedCostCenterId);
  const isLoading = costCentersLoading || trendLoading || !trendData;

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {formatFullCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col gap-4 mb-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground" data-testid="text-trends-title">
                2025 {selectedCostCenter?.name || 'Cost'} Trends
              </h1>
              <p className="text-sm text-muted-foreground">
                Monthly cost trends and variance analysis
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild className="gap-1.5" data-testid="link-dashboard">
                <Link href="/">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-1.5" data-testid="link-ip-teams">
                <Link href="/ip-teams">
                  <Users className="h-4 w-4" />
                  IP Teams
                </Link>
              </Button>
              <Button variant="default" size="sm" className="gap-1.5" data-testid="link-trends-active">
                <TrendingUp className="h-4 w-4" />
                Trends
              </Button>
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
          <div className="grid gap-6">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        ) : (
          <div className="grid gap-6">
            <Card className="p-6 border-card-border">
              <h2 className="text-lg font-semibold text-foreground mb-6" data-testid="text-actuals-chart-title">
                Monthly Actuals vs Budget
              </h2>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="monthName" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      tickFormatter={formatCurrency}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip content={customTooltip} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="actual" 
                      name="Actual Spend"
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      dot={{ fill: '#3B82F6', strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="budget" 
                      name="Budget"
                      stroke="#10B981" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: '#10B981', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-6 border-card-border">
              <h2 className="text-lg font-semibold text-foreground mb-6" data-testid="text-variance-chart-title">
                Monthly Variance (Budget - Actual)
              </h2>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="monthName" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      tickFormatter={formatCurrency}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip content={customTooltip} />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                    <Bar 
                      dataKey="variance" 
                      name="Variance"
                      fill="#3B82F6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Positive values indicate under budget, negative values indicate over budget
              </p>
            </Card>

            <Card className="p-6 border-card-border">
              <h2 className="text-lg font-semibold text-foreground mb-6" data-testid="text-breakdown-chart-title">
                Compensation vs Program Spend by Month
              </h2>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="monthName" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis 
                      tickFormatter={formatCurrency}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip content={customTooltip} />
                    <Legend />
                    <Bar 
                      dataKey="compensationActual" 
                      name="Compensation"
                      stackId="a"
                      fill="#3B82F6"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar 
                      dataKey="programActual" 
                      name="Program Spend"
                      stackId="a"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
