import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, Calendar, LayoutDashboard, TrendingUp, Users, Wallet, Plane, ShieldCheck, Download, X, Search, ArrowDown, ArrowUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDemoMode } from "@/hooks/use-demo-mode";
import type { AdminSummaryData, ExpenseDetail } from "@shared/schema";

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function formatK(value: number): string {
  if (value === 0) return "-";
  const k = Math.round(value / 1000);
  if (k === 0) return "-";
  return k.toLocaleString();
}

function formatVarianceK(value: number): string {
  if (value === 0) return "-";
  const k = Math.round(value / 1000);
  if (k === 0) return "-";
  const num = Math.abs(k).toLocaleString();
  if (k > 0) return `-${num}`;
  if (k < 0) return `+${num}`;
  return num;
}

function varianceBg(value: number): string {
  if (value === 0 || Math.round(value / 1000) === 0) return "bg-muted/40 text-muted-foreground";
  return value < 0 ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400";
}

function NumCell({ value, isBold, isVariance }: { value: number; isBold?: boolean; isVariance?: boolean }) {
  if (value === 0 && !isBold) {
    return <span className="text-muted-foreground/50">-</span>;
  }
  const formatted = isVariance ? formatVarianceK(value) : formatK(value);
  if (isVariance) {
    return (
      <span className={`inline-block px-2 py-0.5 rounded-md text-xs tabular-nums ${isBold ? 'font-semibold' : ''} ${varianceBg(value)}`}>
        {formatted}
      </span>
    );
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-xs tabular-nums bg-muted/40 ${isBold ? 'font-semibold' : ''}`}>
      {formatted}
    </span>
  );
}

function VarianceIndicator({ value }: { value: number }) {
  if (value === 0) return null;
  const isPositive = value > 0;
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
      data-testid={`indicator-${isPositive ? 'under' : 'over'}-budget`}
    />
  );
}

const SPEND_TYPE_LABELS: Record<string, string> = {
  compensation: 'Compensation',
  programs: 'Programs',
  databases: 'Databases',
  bcn: 'BCN',
  total: 'Total',
};

function formatCurrency(amount: number): string {
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(absAmount);
  return amount < 0 ? `-${formatted}` : formatted;
}

export default function AdminSummary() {
  const { user } = useAuth();
  const { maskPracticeName } = useDemoMode();
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [periodMode, setPeriodMode] = useState<'ytd' | 'month'>('ytd');
  const [selectedMonth, setSelectedMonth] = useState<number>(1);
  const [drillDown, setDrillDown] = useState<{ practice: string; spendType: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const detailsRef = useRef<HTMLDivElement>(null);

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

  const { data: expenseDetails, isLoading: detailsLoading } = useQuery<ExpenseDetail[]>({
    queryKey: ['/api/admin-summary/expense-details', drillDown?.practice, drillDown?.spendType, periodMode, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!drillDown) return [];
      const url = `/api/admin-summary/expense-details?practice=${encodeURIComponent(drillDown.practice)}&spendType=${drillDown.spendType}&periodMode=${periodMode}&month=${selectedMonth}&year=${selectedYear}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch expense details');
      return response.json();
    },
    enabled: !!drillDown,
  });

  const filteredDetails = useMemo(() => {
    if (!expenseDetails) return [];
    let items = [...expenseDetails];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(e =>
        (e.lineDescription || '').toLowerCase().includes(term) ||
        (e.vendorName || '').toLowerCase().includes(term) ||
        (e.caseCode || '').toLowerCase().includes(term) ||
        (e.caseName || '').toLowerCase().includes(term)
      );
    }
    items.sort((a, b) => sortDirection === 'desc'
      ? Math.abs(b.amount) - Math.abs(a.amount)
      : Math.abs(a.amount) - Math.abs(b.amount)
    );
    return items;
  }, [expenseDetails, searchTerm, sortDirection]);

  const handleDrillDown = (practice: string, spendType: string) => {
    if (drillDown?.practice === practice && drillDown?.spendType === spendType) {
      setDrillDown(null);
    } else {
      setDrillDown({ practice, spendType });
      setSearchTerm("");
      setSortDirection('desc');
      setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  };

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
      maskPracticeName(p.practice), p.group,
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
                      {groupPractices.map((p, idx) => (
                        <tr key={p.practice} className={`border-b border-border/30 hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? 'bg-card' : 'bg-muted/10'}`} data-testid={`row-practice-${p.practice}`}>
                          <td className={`p-2 pl-5 text-foreground sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-card' : 'bg-muted/10'}`}>{maskPracticeName(p.practice)}</td>
                          {(['compensation', 'programs', 'databases', 'bcn'] as const).map(st => (
                            <td key={`actual-${st}`} className={`text-right p-1.5 ${st === 'compensation' ? 'border-l border-border' : ''}`}>
                              {p.actuals[st] !== 0 ? (
                                <button
                                  onClick={() => handleDrillDown(p.practice, st)}
                                  className={`cursor-pointer transition-all ${drillDown?.practice === p.practice && drillDown?.spendType === st ? 'ring-2 ring-primary rounded-md' : 'hover:ring-1 hover:ring-muted-foreground/40 rounded-md'}`}
                                  data-testid={`button-drill-${p.practice}-${st}`}
                                >
                                  <NumCell value={p.actuals[st]} />
                                </button>
                              ) : (
                                <NumCell value={0} />
                              )}
                            </td>
                          ))}
                          <td className="text-right p-1.5"><NumCell value={p.actuals.total} isBold /></td>
                          <td className="text-right p-1.5 border-l border-border"><NumCell value={p.budget.compensation} /></td>
                          <td className="text-right p-1.5"><NumCell value={p.budget.programs} /></td>
                          <td className="text-right p-1.5"><NumCell value={p.budget.databases} /></td>
                          <td className="text-right p-1.5"><NumCell value={p.budget.bcn} /></td>
                          <td className="text-right p-1.5"><NumCell value={p.budget.total} isBold /></td>
                          <td className="text-right p-1.5 border-l border-border"><NumCell value={p.variance.compensation} isVariance /></td>
                          <td className="text-right p-1.5"><NumCell value={p.variance.programs} isVariance /></td>
                          <td className="text-right p-1.5"><NumCell value={p.variance.databases} isVariance /></td>
                          <td className="text-right p-1.5"><NumCell value={p.variance.bcn} isVariance /></td>
                          <td className="text-right p-1.5"><NumCell value={p.variance.total} isVariance isBold /></td>
                          <td className="text-right p-1.5">
                            <span className="inline-flex items-center gap-1.5">
                              <span className={`inline-block px-2 py-0.5 rounded-md text-xs tabular-nums ${varianceBg(p.variance.total)}`}>
                                {p.variance.percentVariance !== 0 ? `${p.variance.percentVariance > 0 ? '-' : '+'}${Math.abs(p.variance.percentVariance)}%` : '-'}
                              </span>
                              <VarianceIndicator value={p.variance.total} />
                            </span>
                          </td>
                        </tr>
                      ))}
                      <tr className="border-b-2 border-border bg-muted/40">
                        <td className="p-1.5 pl-5 text-muted-foreground italic text-xs font-semibold sticky left-0 bg-muted/40 z-10">{group} Subtotal</td>
                        <td className="text-right p-1.5 border-l border-border"><NumCell value={groupTotals.actuals.compensation} isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={groupTotals.actuals.programs} isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={groupTotals.actuals.databases} isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={groupTotals.actuals.bcn} isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={groupTotals.actuals.total} isBold /></td>
                        <td className="text-right p-1.5 border-l border-border"><NumCell value={groupTotals.budget.compensation} isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={groupTotals.budget.programs} isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={groupTotals.budget.databases} isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={groupTotals.budget.bcn} isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={groupTotals.budget.total} isBold /></td>
                        <td className="text-right p-1.5 border-l border-border"><NumCell value={groupTotals.variance.compensation} isVariance isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={groupTotals.variance.programs} isVariance isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={groupTotals.variance.databases} isVariance isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={groupTotals.variance.bcn} isVariance isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={groupTotals.variance.total} isVariance isBold /></td>
                        <td className="text-right p-1.5"></td>
                      </tr>
                    </Fragment>
                  );
                })}
                <tr className="bg-muted border-t-2 border-foreground/30 font-bold" data-testid="row-total">
                  <td className="p-2 pl-3 text-foreground sticky left-0 bg-muted z-10">Total Cost Center PPK</td>
                  <td className="text-right p-1.5 border-l border-border"><NumCell value={summaryData.totals.actuals.compensation} isBold /></td>
                  <td className="text-right p-1.5"><NumCell value={summaryData.totals.actuals.programs} isBold /></td>
                  <td className="text-right p-1.5"><NumCell value={summaryData.totals.actuals.databases} isBold /></td>
                  <td className="text-right p-1.5"><NumCell value={summaryData.totals.actuals.bcn} isBold /></td>
                  <td className="text-right p-1.5"><NumCell value={summaryData.totals.actuals.total} isBold /></td>
                  <td className="text-right p-1.5 border-l border-border"><NumCell value={summaryData.totals.budget.compensation} isBold /></td>
                  <td className="text-right p-1.5"><NumCell value={summaryData.totals.budget.programs} isBold /></td>
                  <td className="text-right p-1.5"><NumCell value={summaryData.totals.budget.databases} isBold /></td>
                  <td className="text-right p-1.5"><NumCell value={summaryData.totals.budget.bcn} isBold /></td>
                  <td className="text-right p-1.5"><NumCell value={summaryData.totals.budget.total} isBold /></td>
                  <td className="text-right p-1.5 border-l border-border"><NumCell value={summaryData.totals.variance.compensation} isVariance isBold /></td>
                  <td className="text-right p-1.5"><NumCell value={summaryData.totals.variance.programs} isVariance isBold /></td>
                  <td className="text-right p-1.5"><NumCell value={summaryData.totals.variance.databases} isVariance isBold /></td>
                  <td className="text-right p-1.5"><NumCell value={summaryData.totals.variance.bcn} isVariance isBold /></td>
                  <td className="text-right p-1.5"><NumCell value={summaryData.totals.variance.total} isVariance isBold /></td>
                  <td className="text-right p-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums ${varianceBg(summaryData.totals.variance.total)}`}>
                        {summaryData.totals.variance.percentVariance !== 0 ? `${summaryData.totals.variance.percentVariance > 0 ? '-' : '+'}${Math.abs(summaryData.totals.variance.percentVariance)}%` : '-'}
                      </span>
                      <VarianceIndicator value={summaryData.totals.variance.total} />
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        ) : null}

        {drillDown && (
          <div ref={detailsRef} className="mt-4">
            <Card className="border-card-border" data-testid="admin-expense-details">
              <div className="p-4 border-b border-border flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-foreground" data-testid="text-drill-down-title">
                    {maskPracticeName(drillDown.practice)} — {SPEND_TYPE_LABELS[drillDown.spendType]} Expenses
                  </h3>
                  {expenseDetails && (
                    <span className="text-xs text-muted-foreground">
                      {filteredDetails.length} item{filteredDetails.length !== 1 ? 's' : ''}
                      {searchTerm && ` (filtered from ${expenseDetails.length})`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search expenses..."
                      className="pl-8 h-8 w-[200px] text-sm"
                      data-testid="input-search-admin-expenses"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSortDirection(d => d === 'desc' ? 'asc' : 'desc')}
                    className="h-8 px-2"
                    data-testid="button-sort-admin-expenses"
                  >
                    {sortDirection === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDrillDown(null)}
                    className="h-8 px-2"
                    data-testid="button-close-admin-expenses"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {detailsLoading ? (
                  <div className="p-4 space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : filteredDetails.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    {searchTerm ? 'No matching expenses found.' : 'No expenses found.'}
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card z-10">
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left p-2 pl-4 w-[30%]">Description</th>
                        <th className="text-left p-2">Case Code</th>
                        <th className="text-left p-2">Case Name</th>
                        <th className="text-left p-2">Vendor</th>
                        <th className="text-left p-2">Period</th>
                        <th className="text-right p-2">Amount</th>
                        <th className="text-left p-2 pr-4">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDetails.map((exp, i) => (
                        <tr key={exp.id || i} className={`border-b border-border/30 ${i % 2 === 0 ? '' : 'bg-muted/10'}`} data-testid={`row-admin-expense-${i}`}>
                          <td className="p-2 pl-4 text-foreground truncate max-w-[300px]" title={exp.lineDescription}>
                            {exp.lineDescription || '-'}
                          </td>
                          <td className="p-2 text-muted-foreground font-mono text-xs">{exp.caseCode || '-'}</td>
                          <td className="p-2 text-muted-foreground truncate max-w-[200px]" title={exp.caseName}>{exp.caseName || '-'}</td>
                          <td className="p-2 text-muted-foreground truncate max-w-[200px]" title={exp.vendorName}>{exp.vendorName || '-'}</td>
                          <td className="p-2 text-muted-foreground whitespace-nowrap">{exp.period || '-'}</td>
                          <td className={`p-2 text-right tabular-nums font-medium whitespace-nowrap ${exp.amount >= 0 ? 'text-foreground' : 'text-red-400'}`}>
                            {formatCurrency(exp.amount)}
                          </td>
                          <td className="p-2 pr-4 text-muted-foreground">
                            {exp.sapInvoiceDocUrl ? (
                              <a
                                href={exp.sapInvoiceDocUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline"
                                data-testid={`link-invoice-${i}`}
                              >
                                View
                              </a>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
