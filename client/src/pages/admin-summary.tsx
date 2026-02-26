import { useState, useEffect, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, Calendar, LayoutDashboard, TrendingUp, Users, Wallet, Plane, ShieldCheck, Download } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { AdminSummaryData } from "@shared/schema";

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function formatK(value: number): string {
  if (value === 0) return "-";
  const absVal = Math.abs(value);
  if (absVal >= 1000) {
    const k = Math.round(value / 1000);
    return k.toLocaleString();
  }
  return value.toLocaleString();
}

function varianceClass(value: number): string {
  if (value === 0) return "text-muted-foreground";
  return value < 0 ? "text-red-500" : "text-emerald-500";
}

function VarianceIndicator({ value }: { value: number }) {
  if (value === 0) return null;
  const isPositive = value > 0;
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
      data-testid={`indicator-${isPositive ? 'under' : 'over'}-budget`}
    />
  );
}

export default function AdminSummary() {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [periodMode, setPeriodMode] = useState<'ytd' | 'month'>('ytd');
  const [selectedMonth, setSelectedMonth] = useState<number>(1);

  const { data: latestMonthData } = useQuery<{ year: number; latestMonth: number }>({
    queryKey: ['/api/latest-month', selectedYear],
  });

  useEffect(() => {
    if (latestMonthData) {
      setSelectedMonth(latestMonthData.latestMonth);
    }
  }, [latestMonthData]);

  const { data: userAccess } = useQuery<{ canSeeAllPractices: boolean }>({
    queryKey: ['/api/user-access'],
  });

  const { data: summaryData, isLoading } = useQuery<AdminSummaryData>({
    queryKey: ['/api/admin-summary', periodMode, selectedMonth, selectedYear],
    queryFn: async () => {
      const url = `/api/admin-summary?periodMode=${periodMode}&month=${selectedMonth}&year=${selectedYear}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch admin summary');
      return response.json();
    },
    enabled: userAccess?.canSeeAllPractices === true,
  });

  const getUserInitials = () => {
    if (!user) return '?';
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`;
  };

  const handleExportCSV = () => {
    if (!summaryData) return;
    const headers = [
      'Practice', 'Group',
      'Actual Comp', 'Actual Prog', 'Actual DBs', 'Actual BCN', 'Actual Total',
      'Budget Comp', 'Budget Prog', 'Budget DBs', 'Budget BCN', 'Budget Total',
      'Var Comp', 'Var Prog', 'Var DBs', 'Var BCN', 'Var Total', 'Var %'
    ];
    const rows = summaryData.practices.map(p => [
      p.practice, p.group,
      p.actuals.compensation, p.actuals.programs, p.actuals.databases, p.actuals.bcn, p.actuals.total,
      p.budget.compensation, p.budget.programs, p.budget.databases, p.budget.bcn, p.budget.total,
      p.variance.compensation, p.variance.programs, p.variance.databases, p.variance.bcn, p.variance.total, `${p.variance.percentVariance}%`
    ]);
    const t = summaryData.totals;
    rows.push([
      'TOTAL', '',
      t.actuals.compensation, t.actuals.programs, t.actuals.databases, t.actuals.bcn, t.actuals.total,
      t.budget.compensation, t.budget.programs, t.budget.databases, t.budget.bcn, t.budget.total,
      t.variance.compensation, t.variance.programs, t.variance.databases, t.variance.bcn, t.variance.total, `${t.variance.percentVariance}%`
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin_summary_${selectedYear}_${MONTH_NAMES[selectedMonth - 1]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (userAccess && !userAccess.canSeeAllPractices) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-8 text-center max-w-md">
          <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground mb-4">This page is only available to users with All Practices access.</p>
          <Button asChild variant="outline">
            <Link href="/">Back to Dashboard</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const groups = ['Industries', 'Capabilities', 'Other PPK'] as const;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-[1600px] mx-auto">
        <header className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground" data-testid="text-admin-summary-title">
                Practice Summary - {selectedYear}
              </h1>
              <p className="text-sm text-muted-foreground">
                {periodMode === 'ytd'
                  ? `YTD through ${MONTH_NAMES[selectedMonth - 1]}`
                  : `${MONTH_NAMES[selectedMonth - 1]} only`} — All values in $000s
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
            <nav className="flex items-center gap-1">
              <Button variant="outline" size="sm" asChild className="gap-1.5" data-testid="link-dashboard">
                <Link href="/">
                  <LayoutDashboard className="h-4 w-4" />
                  Cost Dashboard
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-1.5" data-testid="link-trends">
                <Link href="/trends">
                  <TrendingUp className="h-4 w-4" />
                  Cost Trends
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-1.5" data-testid="link-ip-teams">
                <Link href="/ip-teams">
                  <Users className="h-4 w-4" />
                  IP Teams
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-1.5" data-testid="link-budget-tracking">
                <Link href="/budget-tracking">
                  <Wallet className="h-4 w-4" />
                  Budget Tracking
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-1.5" data-testid="link-travel-detail">
                <Link href="/travel-detail">
                  <Plane className="h-4 w-4" />
                  Travel Detail
                </Link>
              </Button>
              <Button variant="default" size="sm" className="gap-1.5" data-testid="link-admin-summary-active">
                <ShieldCheck className="h-4 w-4" />
                Admin Summary
              </Button>
            </nav>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger className="w-[100px]" data-testid="select-year">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={periodMode} onValueChange={(v) => setPeriodMode(v as 'ytd' | 'month')}>
                  <SelectTrigger className="w-[100px]" data-testid="select-period-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ytd">YTD</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                  <SelectTrigger className="w-[130px]" data-testid="select-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCSV} disabled={!summaryData} data-testid="button-export-csv">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        </header>

        {isLoading ? (
          <Card className="p-6">
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </Card>
        ) : summaryData ? (
          <Card className="border-card-border overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-admin-summary">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 pl-3 font-semibold text-foreground sticky left-0 bg-card z-10 min-w-[200px]">
                    {MONTH_NAMES[selectedMonth - 1]}
                  </th>
                  <th colSpan={5} className="text-center p-2 font-semibold text-foreground border-l border-border bg-muted/30">
                    ACTUALS
                  </th>
                  <th colSpan={5} className="text-center p-2 font-semibold text-foreground border-l border-border bg-muted/30">
                    BUDGET
                  </th>
                  <th colSpan={7} className="text-center p-2 font-semibold text-foreground border-l border-border bg-muted/30">
                    VARIANCE
                  </th>
                </tr>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left p-2 pl-3 sticky left-0 bg-card z-10"></th>
                  <th className="text-right p-2 border-l border-border w-[75px]">{periodMode === 'ytd' ? 'YTD' : ''} Comp</th>
                  <th className="text-right p-2 w-[75px]">{periodMode === 'ytd' ? 'YTD' : ''} Prog.</th>
                  <th className="text-right p-2 w-[75px]">{periodMode === 'ytd' ? 'YTD' : ''} DBs</th>
                  <th className="text-right p-2 w-[75px]">{periodMode === 'ytd' ? 'YTD' : ''} BCN</th>
                  <th className="text-right p-2 w-[80px] font-semibold">{periodMode === 'ytd' ? 'YTD' : ''} Actuals</th>
                  <th className="text-right p-2 border-l border-border w-[75px]">{periodMode === 'ytd' ? 'YTD' : ''} Comp</th>
                  <th className="text-right p-2 w-[75px]">{periodMode === 'ytd' ? 'YTD' : ''} Prog.</th>
                  <th className="text-right p-2 w-[75px]">{periodMode === 'ytd' ? 'YTD' : ''} DBs</th>
                  <th className="text-right p-2 w-[75px]">{periodMode === 'ytd' ? 'YTD' : ''} BCN</th>
                  <th className="text-right p-2 w-[80px] font-semibold">{periodMode === 'ytd' ? 'YTD' : ''} Budget</th>
                  <th className="text-right p-2 border-l border-border w-[75px]">{periodMode === 'ytd' ? 'YTD' : ''} Comp</th>
                  <th className="text-right p-2 w-[75px]">{periodMode === 'ytd' ? 'YTD' : ''} Prog.</th>
                  <th className="text-right p-2 w-[75px]">{periodMode === 'ytd' ? 'YTD' : ''} DBs</th>
                  <th className="text-right p-2 w-[75px]">{periodMode === 'ytd' ? 'YTD' : ''} BCN</th>
                  <th className="text-right p-2 w-[85px] font-semibold">{periodMode === 'ytd' ? 'YTD' : ''} Variance</th>
                  <th className="text-right p-2 w-[65px] font-semibold">{periodMode === 'ytd' ? 'YTD' : ''} % Var.</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(group => {
                  const groupPractices = summaryData.practices.filter(p => p.group === group);
                  if (groupPractices.length === 0) return null;

                  const groupTotals = {
                    actuals: { compensation: 0, programs: 0, databases: 0, bcn: 0, total: 0 },
                    budget: { compensation: 0, programs: 0, databases: 0, bcn: 0, total: 0 },
                    variance: { compensation: 0, programs: 0, databases: 0, bcn: 0, total: 0 },
                  };
                  groupPractices.forEach(p => {
                    groupTotals.actuals.compensation += p.actuals.compensation;
                    groupTotals.actuals.programs += p.actuals.programs;
                    groupTotals.actuals.databases += p.actuals.databases;
                    groupTotals.actuals.bcn += p.actuals.bcn;
                    groupTotals.actuals.total += p.actuals.total;
                    groupTotals.budget.compensation += p.budget.compensation;
                    groupTotals.budget.programs += p.budget.programs;
                    groupTotals.budget.databases += p.budget.databases;
                    groupTotals.budget.bcn += p.budget.bcn;
                    groupTotals.budget.total += p.budget.total;
                    groupTotals.variance.compensation += p.variance.compensation;
                    groupTotals.variance.programs += p.variance.programs;
                    groupTotals.variance.databases += p.variance.databases;
                    groupTotals.variance.bcn += p.variance.bcn;
                    groupTotals.variance.total += p.variance.total;
                  });

                  return (
                    <Fragment key={group}>
                      <tr className="bg-muted/50 border-t-2 border-border">
                        <td colSpan={17} className="p-2 pl-3 font-bold text-foreground sticky left-0 bg-muted/50 z-10" data-testid={`group-header-${group}`}>
                          {group}
                        </td>
                      </tr>
                      {groupPractices.map(p => (
                        <tr key={p.practice} className="border-b border-border/50 hover:bg-muted/20 transition-colors" data-testid={`row-practice-${p.practice}`}>
                          <td className="p-2 pl-5 text-foreground sticky left-0 bg-card z-10">{p.practice}</td>
                          <td className="text-right p-2 border-l border-border tabular-nums">{formatK(p.actuals.compensation)}</td>
                          <td className="text-right p-2 tabular-nums">{formatK(p.actuals.programs)}</td>
                          <td className="text-right p-2 tabular-nums">{formatK(p.actuals.databases)}</td>
                          <td className="text-right p-2 tabular-nums">{formatK(p.actuals.bcn)}</td>
                          <td className="text-right p-2 font-semibold tabular-nums">{formatK(p.actuals.total)}</td>
                          <td className="text-right p-2 border-l border-border tabular-nums">{formatK(p.budget.compensation)}</td>
                          <td className="text-right p-2 tabular-nums">{formatK(p.budget.programs)}</td>
                          <td className="text-right p-2 tabular-nums">{formatK(p.budget.databases)}</td>
                          <td className="text-right p-2 tabular-nums">{formatK(p.budget.bcn)}</td>
                          <td className="text-right p-2 font-semibold tabular-nums">{formatK(p.budget.total)}</td>
                          <td className={`text-right p-2 border-l border-border tabular-nums ${varianceClass(p.variance.compensation)}`}>{formatK(p.variance.compensation)}</td>
                          <td className={`text-right p-2 tabular-nums ${varianceClass(p.variance.programs)}`}>{formatK(p.variance.programs)}</td>
                          <td className={`text-right p-2 tabular-nums ${varianceClass(p.variance.databases)}`}>{formatK(p.variance.databases)}</td>
                          <td className={`text-right p-2 tabular-nums ${varianceClass(p.variance.bcn)}`}>{formatK(p.variance.bcn)}</td>
                          <td className={`text-right p-2 font-semibold tabular-nums ${varianceClass(p.variance.total)}`}>{formatK(p.variance.total)}</td>
                          <td className="text-right p-2 tabular-nums">
                            <span className="inline-flex items-center gap-1.5">
                              <span className={varianceClass(p.variance.total)}>
                                {p.variance.percentVariance !== 0 ? `${p.variance.percentVariance}%` : '-'}
                              </span>
                              <VarianceIndicator value={p.variance.total} />
                            </span>
                          </td>
                        </tr>
                      ))}
                      <tr className="border-b-2 border-border bg-muted/30 font-semibold text-xs">
                        <td className="p-1.5 pl-5 text-muted-foreground italic sticky left-0 bg-muted/30 z-10">{group} Subtotal</td>
                        <td className="text-right p-1.5 border-l border-border tabular-nums">{formatK(groupTotals.actuals.compensation)}</td>
                        <td className="text-right p-1.5 tabular-nums">{formatK(groupTotals.actuals.programs)}</td>
                        <td className="text-right p-1.5 tabular-nums">{formatK(groupTotals.actuals.databases)}</td>
                        <td className="text-right p-1.5 tabular-nums">{formatK(groupTotals.actuals.bcn)}</td>
                        <td className="text-right p-1.5 tabular-nums">{formatK(groupTotals.actuals.total)}</td>
                        <td className="text-right p-1.5 border-l border-border tabular-nums">{formatK(groupTotals.budget.compensation)}</td>
                        <td className="text-right p-1.5 tabular-nums">{formatK(groupTotals.budget.programs)}</td>
                        <td className="text-right p-1.5 tabular-nums">{formatK(groupTotals.budget.databases)}</td>
                        <td className="text-right p-1.5 tabular-nums">{formatK(groupTotals.budget.bcn)}</td>
                        <td className="text-right p-1.5 tabular-nums">{formatK(groupTotals.budget.total)}</td>
                        <td className={`text-right p-1.5 border-l border-border tabular-nums ${varianceClass(groupTotals.variance.compensation)}`}>{formatK(groupTotals.variance.compensation)}</td>
                        <td className={`text-right p-1.5 tabular-nums ${varianceClass(groupTotals.variance.programs)}`}>{formatK(groupTotals.variance.programs)}</td>
                        <td className={`text-right p-1.5 tabular-nums ${varianceClass(groupTotals.variance.databases)}`}>{formatK(groupTotals.variance.databases)}</td>
                        <td className={`text-right p-1.5 tabular-nums ${varianceClass(groupTotals.variance.bcn)}`}>{formatK(groupTotals.variance.bcn)}</td>
                        <td className={`text-right p-1.5 tabular-nums ${varianceClass(groupTotals.variance.total)}`}>{formatK(groupTotals.variance.total)}</td>
                        <td className="text-right p-1.5"></td>
                      </tr>
                    </Fragment>
                  );
                })}
                <tr className="bg-muted border-t-2 border-foreground/30 font-bold" data-testid="row-total">
                  <td className="p-2 pl-3 text-foreground sticky left-0 bg-muted z-10">Total Cost Center PPK</td>
                  <td className="text-right p-2 border-l border-border tabular-nums">{formatK(summaryData.totals.actuals.compensation)}</td>
                  <td className="text-right p-2 tabular-nums">{formatK(summaryData.totals.actuals.programs)}</td>
                  <td className="text-right p-2 tabular-nums">{formatK(summaryData.totals.actuals.databases)}</td>
                  <td className="text-right p-2 tabular-nums">{formatK(summaryData.totals.actuals.bcn)}</td>
                  <td className="text-right p-2 tabular-nums">{formatK(summaryData.totals.actuals.total)}</td>
                  <td className="text-right p-2 border-l border-border tabular-nums">{formatK(summaryData.totals.budget.compensation)}</td>
                  <td className="text-right p-2 tabular-nums">{formatK(summaryData.totals.budget.programs)}</td>
                  <td className="text-right p-2 tabular-nums">{formatK(summaryData.totals.budget.databases)}</td>
                  <td className="text-right p-2 tabular-nums">{formatK(summaryData.totals.budget.bcn)}</td>
                  <td className="text-right p-2 tabular-nums">{formatK(summaryData.totals.budget.total)}</td>
                  <td className={`text-right p-2 border-l border-border tabular-nums ${varianceClass(summaryData.totals.variance.compensation)}`}>{formatK(summaryData.totals.variance.compensation)}</td>
                  <td className={`text-right p-2 tabular-nums ${varianceClass(summaryData.totals.variance.programs)}`}>{formatK(summaryData.totals.variance.programs)}</td>
                  <td className={`text-right p-2 tabular-nums ${varianceClass(summaryData.totals.variance.databases)}`}>{formatK(summaryData.totals.variance.databases)}</td>
                  <td className={`text-right p-2 tabular-nums ${varianceClass(summaryData.totals.variance.bcn)}`}>{formatK(summaryData.totals.variance.bcn)}</td>
                  <td className={`text-right p-2 tabular-nums ${varianceClass(summaryData.totals.variance.total)}`}>{formatK(summaryData.totals.variance.total)}</td>
                  <td className="text-right p-2 tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={varianceClass(summaryData.totals.variance.total)}>
                        {summaryData.totals.variance.percentVariance}%
                      </span>
                      <VarianceIndicator value={summaryData.totals.variance.total} />
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
