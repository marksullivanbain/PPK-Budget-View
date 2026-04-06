import { Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, LayoutDashboard, TrendingUp, Users, Wallet, Plane, ShieldCheck, Download, GitCompareArrows } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDemoMode } from "@/hooks/use-demo-mode";
import type { AdminPracticeSummary } from "@shared/schema";

interface PeriodData {
  practices: AdminPracticeSummary[];
  totals: {
    actuals: { compensation: number; programs: number; databases: number; bcn: number; total: number };
    budget: { compensation: number; programs: number; databases: number; bcn: number; total: number };
    variance: { compensation: number; programs: number; databases: number; bcn: number; total: number; percentVariance: number };
  };
  label: string;
}

interface ComparisonData {
  q4: PeriodData;
  janFeb: PeriodData;
}

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
    <span className={`inline-block w-2 h-2 rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`} />
  );
}

export default function AdminComparison() {
  const { user } = useAuth();
  const { maskPracticeName } = useDemoMode();

  const { data: userAccess } = useQuery<{ canSeeAllPractices: boolean }>({
    queryKey: ['/api/user-access'],
  });

  const { data, isLoading } = useQuery<ComparisonData>({
    queryKey: ['/api/admin-comparison'],
    queryFn: async () => {
      const response = await fetch('/api/admin-comparison', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch comparison data');
      return response.json();
    },
    enabled: userAccess?.canSeeAllPractices === true,
  });

  const getUserInitials = () => {
    if (!user) return '?';
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`;
  };

  const handleExportCSV = () => {
    if (!data) return;
    const headers = [
      'Practice', 'Group',
      'Q4 Actual Comp', 'Q4 Actual Prog', 'Q4 Actual DBs', 'Q4 Actual BCN', 'Q4 Actual Total',
      'Q4 Budget Comp', 'Q4 Budget Prog', 'Q4 Budget DBs', 'Q4 Budget BCN', 'Q4 Budget Total',
      'Q4 Var Total',
      'JF Actual Comp', 'JF Actual Prog', 'JF Actual DBs', 'JF Actual BCN', 'JF Actual Total',
      'JF Budget Comp', 'JF Budget Prog', 'JF Budget DBs', 'JF Budget BCN', 'JF Budget Total',
      'JF Var Total',
    ];
    const rows = data.q4.practices.map((q4p) => {
      const jfp = data.janFeb.practices.find(jp => jp.practice === q4p.practice);
      return [
        maskPracticeName(q4p.practice), q4p.group,
        q4p.actuals.compensation, q4p.actuals.programs, q4p.actuals.databases, q4p.actuals.bcn, q4p.actuals.total,
        q4p.budget.compensation, q4p.budget.programs, q4p.budget.databases, q4p.budget.bcn, q4p.budget.total,
        q4p.variance.total,
        jfp?.actuals.compensation || 0, jfp?.actuals.programs || 0, jfp?.actuals.databases || 0, jfp?.actuals.bcn || 0, jfp?.actuals.total || 0,
        jfp?.budget.compensation || 0, jfp?.budget.programs || 0, jfp?.budget.databases || 0, jfp?.budget.bcn || 0, jfp?.budget.total || 0,
        jfp?.variance.total || 0,
      ];
    });
    const q4t = data.q4.totals;
    const jft = data.janFeb.totals;
    rows.push([
      'TOTAL', '',
      q4t.actuals.compensation, q4t.actuals.programs, q4t.actuals.databases, q4t.actuals.bcn, q4t.actuals.total,
      q4t.budget.compensation, q4t.budget.programs, q4t.budget.databases, q4t.budget.bcn, q4t.budget.total,
      q4t.variance.total,
      jft.actuals.compensation, jft.actuals.programs, jft.actuals.databases, jft.actuals.bcn, jft.actuals.total,
      jft.budget.compensation, jft.budget.programs, jft.budget.databases, jft.budget.bcn, jft.budget.total,
      jft.variance.total,
    ] as any);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'admin_comparison_q4_vs_janfeb.csv';
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

  const renderPeriodColumns = (practice: AdminPracticeSummary) => (
    <>
      <td className="text-right p-1.5 border-l border-border"><NumCell value={practice.actuals.compensation} /></td>
      <td className="text-right p-1.5"><NumCell value={practice.actuals.programs} /></td>
      <td className="text-right p-1.5"><NumCell value={practice.actuals.databases} /></td>
      <td className="text-right p-1.5"><NumCell value={practice.actuals.bcn} /></td>
      <td className="text-right p-1.5"><NumCell value={practice.actuals.total} isBold /></td>
      <td className="text-right p-1.5 border-l border-border"><NumCell value={practice.budget.total} isBold /></td>
      <td className="text-right p-1.5"><NumCell value={practice.variance.total} isVariance isBold /></td>
      <td className="text-right p-1.5">
        <span className="inline-flex items-center gap-1">
          <span className={`inline-block px-1.5 py-0.5 rounded-md text-xs tabular-nums ${varianceBg(practice.variance.total)}`}>
            {practice.variance.percentVariance !== 0 ? `${practice.variance.percentVariance > 0 ? '-' : '+'}${Math.abs(practice.variance.percentVariance)}%` : '-'}
          </span>
          <VarianceIndicator value={practice.variance.total} />
        </span>
      </td>
    </>
  );

  const renderTotalColumns = (totals: PeriodData['totals']) => (
    <>
      <td className="text-right p-1.5 border-l border-border"><NumCell value={totals.actuals.compensation} isBold /></td>
      <td className="text-right p-1.5"><NumCell value={totals.actuals.programs} isBold /></td>
      <td className="text-right p-1.5"><NumCell value={totals.actuals.databases} isBold /></td>
      <td className="text-right p-1.5"><NumCell value={totals.actuals.bcn} isBold /></td>
      <td className="text-right p-1.5"><NumCell value={totals.actuals.total} isBold /></td>
      <td className="text-right p-1.5 border-l border-border"><NumCell value={totals.budget.total} isBold /></td>
      <td className="text-right p-1.5"><NumCell value={totals.variance.total} isVariance isBold /></td>
      <td className="text-right p-1.5">
        <span className="inline-flex items-center gap-1">
          <span className={`inline-block px-1.5 py-0.5 rounded-md text-xs font-semibold tabular-nums ${varianceBg(totals.variance.total)}`}>
            {totals.variance.percentVariance !== 0 ? `${totals.variance.percentVariance > 0 ? '-' : '+'}${Math.abs(totals.variance.percentVariance)}%` : '-'}
          </span>
          <VarianceIndicator value={totals.variance.total} />
        </span>
      </td>
    </>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-[1800px] mx-auto">
        <header className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground" data-testid="text-comparison-title">
                Period Comparison
              </h1>
              <p className="text-sm text-muted-foreground">
                Q4 2025 (Oct–Dec) vs Jan–Feb 2026 — All values in $000s
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
              <Button variant="outline" size="sm" asChild className="gap-1.5" data-testid="link-admin-summary">
                <Link href="/admin-summary">
                  <ShieldCheck className="h-4 w-4" />
                  Admin Summary
                </Link>
              </Button>
              <Button variant="default" size="sm" className="gap-1.5" data-testid="link-comparison-active">
                <GitCompareArrows className="h-4 w-4" />
                Period Comparison
              </Button>
            </nav>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCSV} disabled={!data} data-testid="button-export-csv">
              <Download className="h-4 w-4" />
              Export
            </Button>
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
        ) : data ? (
          <Card className="border-card-border overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-comparison">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 pl-3 font-semibold text-foreground sticky left-0 bg-card z-10 min-w-[200px]">
                    Practice
                  </th>
                  <th colSpan={8} className="text-center p-2 font-semibold text-foreground border-l border-border bg-blue-500/10">
                    Q4 2025 (Oct–Dec)
                  </th>
                  <th colSpan={8} className="text-center p-2 font-semibold text-foreground border-l border-border bg-emerald-500/10">
                    Jan–Feb 2026
                  </th>
                </tr>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left p-2 pl-3 sticky left-0 bg-card z-10"></th>
                  <th className="text-right p-1.5 border-l border-border w-[65px]">Comp</th>
                  <th className="text-right p-1.5 w-[65px]">Prog.</th>
                  <th className="text-right p-1.5 w-[65px]">DBs</th>
                  <th className="text-right p-1.5 w-[65px]">BCN</th>
                  <th className="text-right p-1.5 w-[70px] font-semibold">Actuals</th>
                  <th className="text-right p-1.5 border-l border-border w-[70px] font-semibold">Budget</th>
                  <th className="text-right p-1.5 w-[75px] font-semibold">Variance</th>
                  <th className="text-right p-1.5 w-[55px] font-semibold">%</th>
                  <th className="text-right p-1.5 border-l border-border w-[65px]">Comp</th>
                  <th className="text-right p-1.5 w-[65px]">Prog.</th>
                  <th className="text-right p-1.5 w-[65px]">DBs</th>
                  <th className="text-right p-1.5 w-[65px]">BCN</th>
                  <th className="text-right p-1.5 w-[70px] font-semibold">Actuals</th>
                  <th className="text-right p-1.5 border-l border-border w-[70px] font-semibold">Budget</th>
                  <th className="text-right p-1.5 w-[75px] font-semibold">Variance</th>
                  <th className="text-right p-1.5 w-[55px] font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(group => {
                  const q4Practices = data.q4.practices.filter(p => p.group === group);
                  if (q4Practices.length === 0) return null;

                  const q4GroupTotals = { actuals: { compensation: 0, programs: 0, databases: 0, bcn: 0, total: 0 }, budget: { total: 0 }, variance: { total: 0 } };
                  const jfGroupTotals = { actuals: { compensation: 0, programs: 0, databases: 0, bcn: 0, total: 0 }, budget: { total: 0 }, variance: { total: 0 } };

                  q4Practices.forEach(p => {
                    q4GroupTotals.actuals.compensation += p.actuals.compensation;
                    q4GroupTotals.actuals.programs += p.actuals.programs;
                    q4GroupTotals.actuals.databases += p.actuals.databases;
                    q4GroupTotals.actuals.bcn += p.actuals.bcn;
                    q4GroupTotals.actuals.total += p.actuals.total;
                    q4GroupTotals.budget.total += p.budget.total;
                    q4GroupTotals.variance.total += p.variance.total;
                    const jfp = data.janFeb.practices.find(jp => jp.practice === p.practice);
                    if (jfp) {
                      jfGroupTotals.actuals.compensation += jfp.actuals.compensation;
                      jfGroupTotals.actuals.programs += jfp.actuals.programs;
                      jfGroupTotals.actuals.databases += jfp.actuals.databases;
                      jfGroupTotals.actuals.bcn += jfp.actuals.bcn;
                      jfGroupTotals.actuals.total += jfp.actuals.total;
                      jfGroupTotals.budget.total += jfp.budget.total;
                      jfGroupTotals.variance.total += jfp.variance.total;
                    }
                  });

                  return (
                    <Fragment key={group}>
                      <tr className="bg-muted/50 border-t-2 border-border">
                        <td colSpan={17} className="p-2 pl-3 font-bold text-foreground sticky left-0 bg-muted/50 z-10" data-testid={`group-header-${group}`}>
                          {group}
                        </td>
                      </tr>
                      {q4Practices.map((q4p, idx) => {
                        const jfp = data.janFeb.practices.find(jp => jp.practice === q4p.practice);
                        const emptyPractice: AdminPracticeSummary = {
                          practice: q4p.practice, group: q4p.group,
                          actuals: { compensation: 0, programs: 0, databases: 0, bcn: 0, total: 0 },
                          budget: { compensation: 0, programs: 0, databases: 0, bcn: 0, total: 0 },
                          variance: { compensation: 0, programs: 0, databases: 0, bcn: 0, total: 0, percentVariance: 0 },
                        };
                        return (
                          <tr key={q4p.practice} className={`border-b border-border/30 hover:bg-muted/30 transition-colors ${idx % 2 === 0 ? 'bg-card' : 'bg-muted/10'}`}>
                            <td className={`p-2 pl-5 text-foreground sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-card' : 'bg-muted/10'}`}>
                              {maskPracticeName(q4p.practice)}
                            </td>
                            {renderPeriodColumns(q4p)}
                            {renderPeriodColumns(jfp || emptyPractice)}
                          </tr>
                        );
                      })}
                      <tr className="border-b-2 border-border bg-muted/40">
                        <td className="p-1.5 pl-5 text-muted-foreground italic text-xs font-semibold sticky left-0 bg-muted/40 z-10">{group} Subtotal</td>
                        <td className="text-right p-1.5 border-l border-border"><NumCell value={q4GroupTotals.actuals.compensation} isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={q4GroupTotals.actuals.programs} isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={q4GroupTotals.actuals.databases} isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={q4GroupTotals.actuals.bcn} isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={q4GroupTotals.actuals.total} isBold /></td>
                        <td className="text-right p-1.5 border-l border-border"><NumCell value={q4GroupTotals.budget.total} isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={q4GroupTotals.variance.total} isVariance isBold /></td>
                        <td className="text-right p-1.5"></td>
                        <td className="text-right p-1.5 border-l border-border"><NumCell value={jfGroupTotals.actuals.compensation} isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={jfGroupTotals.actuals.programs} isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={jfGroupTotals.actuals.databases} isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={jfGroupTotals.actuals.bcn} isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={jfGroupTotals.actuals.total} isBold /></td>
                        <td className="text-right p-1.5 border-l border-border"><NumCell value={jfGroupTotals.budget.total} isBold /></td>
                        <td className="text-right p-1.5"><NumCell value={jfGroupTotals.variance.total} isVariance isBold /></td>
                        <td className="text-right p-1.5"></td>
                      </tr>
                    </Fragment>
                  );
                })}
                {(() => {
                  const commOpsQ4 = data.q4.practices.find(p => p.practice === 'Commercial Operations');
                  const commOpsJF = data.janFeb.practices.find(p => p.practice === 'Commercial Operations');
                  const memoQ4 = {
                    actuals: {
                      compensation: data.q4.totals.actuals.compensation - (commOpsQ4?.actuals.compensation || 0),
                      programs: data.q4.totals.actuals.programs - (commOpsQ4?.actuals.programs || 0),
                      databases: data.q4.totals.actuals.databases - (commOpsQ4?.actuals.databases || 0),
                      bcn: data.q4.totals.actuals.bcn - (commOpsQ4?.actuals.bcn || 0),
                      total: data.q4.totals.actuals.total - (commOpsQ4?.actuals.total || 0),
                    },
                    budget: { total: data.q4.totals.budget.total - (commOpsQ4?.budget.total || 0) },
                    variance: { total: data.q4.totals.variance.total - (commOpsQ4?.variance.total || 0) },
                  };
                  const memoJF = {
                    actuals: {
                      compensation: data.janFeb.totals.actuals.compensation - (commOpsJF?.actuals.compensation || 0),
                      programs: data.janFeb.totals.actuals.programs - (commOpsJF?.actuals.programs || 0),
                      databases: data.janFeb.totals.actuals.databases - (commOpsJF?.actuals.databases || 0),
                      bcn: data.janFeb.totals.actuals.bcn - (commOpsJF?.actuals.bcn || 0),
                      total: data.janFeb.totals.actuals.total - (commOpsJF?.actuals.total || 0),
                    },
                    budget: { total: data.janFeb.totals.budget.total - (commOpsJF?.budget.total || 0) },
                    variance: { total: data.janFeb.totals.variance.total - (commOpsJF?.variance.total || 0) },
                  };
                  const memoQ4VarPct = memoQ4.budget.total !== 0 ? Math.round((memoQ4.variance.total / memoQ4.budget.total) * 100) : 0;
                  const memoJFVarPct = memoJF.budget.total !== 0 ? Math.round((memoJF.variance.total / memoJF.budget.total) * 100) : 0;
                  return (
                    <tr className="bg-muted/60 border-t border-border/50 text-muted-foreground italic" data-testid="row-memo">
                      <td className="p-1.5 pl-3 sticky left-0 bg-muted/60 z-10 text-xs">Memo: excl. Comm. Ops</td>
                      <td className="text-right p-1.5 border-l border-border"><NumCell value={memoQ4.actuals.compensation} isBold /></td>
                      <td className="text-right p-1.5"><NumCell value={memoQ4.actuals.programs} isBold /></td>
                      <td className="text-right p-1.5"><NumCell value={memoQ4.actuals.databases} isBold /></td>
                      <td className="text-right p-1.5"><NumCell value={memoQ4.actuals.bcn} isBold /></td>
                      <td className="text-right p-1.5"><NumCell value={memoQ4.actuals.total} isBold /></td>
                      <td className="text-right p-1.5 border-l border-border"><NumCell value={memoQ4.budget.total} isBold /></td>
                      <td className="text-right p-1.5"><NumCell value={memoQ4.variance.total} isVariance isBold /></td>
                      <td className="text-right p-1.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded-md text-xs tabular-nums ${varianceBg(memoQ4.variance.total)}`}>
                          {memoQ4VarPct !== 0 ? `${memoQ4VarPct > 0 ? '-' : '+'}${Math.abs(memoQ4VarPct)}%` : '-'}
                        </span>
                      </td>
                      <td className="text-right p-1.5 border-l border-border"><NumCell value={memoJF.actuals.compensation} isBold /></td>
                      <td className="text-right p-1.5"><NumCell value={memoJF.actuals.programs} isBold /></td>
                      <td className="text-right p-1.5"><NumCell value={memoJF.actuals.databases} isBold /></td>
                      <td className="text-right p-1.5"><NumCell value={memoJF.actuals.bcn} isBold /></td>
                      <td className="text-right p-1.5"><NumCell value={memoJF.actuals.total} isBold /></td>
                      <td className="text-right p-1.5 border-l border-border"><NumCell value={memoJF.budget.total} isBold /></td>
                      <td className="text-right p-1.5"><NumCell value={memoJF.variance.total} isVariance isBold /></td>
                      <td className="text-right p-1.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded-md text-xs tabular-nums ${varianceBg(memoJF.variance.total)}`}>
                          {memoJFVarPct !== 0 ? `${memoJFVarPct > 0 ? '-' : '+'}${Math.abs(memoJFVarPct)}%` : '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })()}
                <tr className="bg-muted border-t-2 border-foreground/30 font-bold" data-testid="row-total">
                  <td className="p-2 pl-3 text-foreground sticky left-0 bg-muted z-10">Total Cost Center PPK</td>
                  {renderTotalColumns(data.q4.totals)}
                  {renderTotalColumns(data.janFeb.totals)}
                </tr>
              </tbody>
            </table>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
