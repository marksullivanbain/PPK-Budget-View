import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { CostCenterSelector } from "@/components/cost-center-selector";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, LayoutDashboard, TrendingUp, Users, Wallet, Plane, Search, ArrowDown, ArrowUp, X, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { CostCenter, TravelCaseCodeSummary, TravelExpenseDetail } from "@shared/schema";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

export default function TravelDetail() {
  const { user } = useAuth();
  const [selectedCostCenterId, setSelectedCostCenterId] = useState("all");
  const [periodMode, setPeriodMode] = useState<'ytd' | 'month'>('ytd');
  const [selectedMonth, setSelectedMonth] = useState<number>(12);
  const [selectedCaseCode, setSelectedCaseCode] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expenseSearchTerm, setExpenseSearchTerm] = useState("");
  const [expenseSortDirection, setExpenseSortDirection] = useState<'desc' | 'asc'>('desc');

  const { data: costCenters, isLoading: costCentersLoading } = useQuery<CostCenter[]>({
    queryKey: ['/api/cost-centers'],
  });

  const { data: userAccess } = useQuery<{ canSeeAllPractices: boolean }>({
    queryKey: ['/api/user-access'],
  });

  const { data: travelSummary, isLoading: summaryLoading } = useQuery<TravelCaseCodeSummary[]>({
    queryKey: ['/api/travel', selectedCostCenterId, 'summary', { periodMode, month: selectedMonth }],
    queryFn: async () => {
      const res = await fetch(`/api/travel/${selectedCostCenterId}/summary?periodMode=${periodMode}&month=${selectedMonth}`);
      if (!res.ok) throw new Error('Failed to fetch travel summary');
      return res.json();
    },
  });

  const { data: travelExpenses, isLoading: expensesLoading } = useQuery<TravelExpenseDetail[]>({
    queryKey: ['/api/travel', selectedCostCenterId, 'expenses', { caseCode: selectedCaseCode, periodMode, month: selectedMonth }],
    queryFn: async () => {
      const res = await fetch(`/api/travel/${selectedCostCenterId}/expenses?caseCode=${encodeURIComponent(selectedCaseCode!)}&periodMode=${periodMode}&month=${selectedMonth}`);
      if (!res.ok) throw new Error('Failed to fetch travel expenses');
      return res.json();
    },
    enabled: !!selectedCaseCode,
  });

  const totalTravelSpend = useMemo(() => {
    if (!travelSummary) return 0;
    return travelSummary.reduce((sum, item) => sum + item.totalAmount, 0);
  }, [travelSummary]);

  const filteredSummary = useMemo(() => {
    if (!travelSummary) return [];
    if (!searchTerm) return travelSummary;
    const search = searchTerm.toLowerCase();
    return travelSummary.filter(
      item => item.caseCode.toLowerCase().includes(search) || item.caseName.toLowerCase().includes(search)
    );
  }, [travelSummary, searchTerm]);

  const filteredExpenses = useMemo(() => {
    if (!travelExpenses) return [];
    let filtered = travelExpenses;
    if (expenseSearchTerm) {
      const search = expenseSearchTerm.toLowerCase();
      filtered = filtered.filter(
        exp => exp.lineDescription.toLowerCase().includes(search) ||
          exp.teeEmployeeName.toLowerCase().includes(search) ||
          exp.accountName.toLowerCase().includes(search) ||
          exp.summaryAccount.toLowerCase().includes(search)
      );
    }
    return [...filtered].sort((a, b) => {
      return expenseSortDirection === 'desc'
        ? Math.abs(b.amount) - Math.abs(a.amount)
        : Math.abs(a.amount) - Math.abs(b.amount);
    });
  }, [travelExpenses, expenseSearchTerm, expenseSortDirection]);

  const selectedCaseCodeInfo = useMemo(() => {
    if (!selectedCaseCode || !travelSummary) return null;
    return travelSummary.find(s => s.caseCode === selectedCaseCode);
  }, [selectedCaseCode, travelSummary]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Please log in to access the dashboard.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex items-center justify-between px-6 py-3 gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold whitespace-nowrap">Travel Detail</h1>
            <nav className="flex items-center gap-1">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2" data-testid="link-dashboard">
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
              </Link>
              <Link href="/trends">
                <Button variant="ghost" size="sm" className="gap-2" data-testid="link-trends">
                  <TrendingUp className="w-4 h-4" />
                  <span className="hidden sm:inline">Trends</span>
                </Button>
              </Link>
              <Link href="/ip-teams">
                <Button variant="ghost" size="sm" className="gap-2" data-testid="link-ip-teams">
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">IP Teams</span>
                </Button>
              </Link>
              <Link href="/budget-tracking">
                <Button variant="ghost" size="sm" className="gap-2" data-testid="link-budget-tracking">
                  <Wallet className="w-4 h-4" />
                  <span className="hidden sm:inline">Budget Tracking</span>
                </Button>
              </Link>
              <Button variant="default" size="sm" className="gap-2" data-testid="link-travel-detail-active">
                <Plane className="w-4 h-4" />
                <span className="hidden sm:inline">Travel Detail</span>
              </Button>
            </nav>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Select value={periodMode} onValueChange={(value) => setPeriodMode(value as 'ytd' | 'month')}>
                <SelectTrigger className="w-[100px]" data-testid="select-period-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ytd">YTD</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                <SelectTrigger className="w-[140px]" data-testid="select-month">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, index) => (
                    <SelectItem key={index + 1} value={(index + 1).toString()}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <CostCenterSelector
              costCenters={costCenters || []}
              selectedId={selectedCostCenterId}
              onSelect={(id) => { setSelectedCostCenterId(id); setSelectedCaseCode(null); }}
              showAllPractices={userAccess?.canSeeAllPractices ?? false}
            />

            <div className="flex items-center gap-2 pl-2 border-l">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.profileImageUrl || undefined} />
                <AvatarFallback>
                  {user.firstName?.[0] || user.email?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm hidden lg:inline">{user.firstName || user.email}</span>
              <form action="/api/auth/logout" method="POST">
                <Button variant="ghost" size="icon" type="submit" data-testid="button-logout">
                  <LogOut className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6 flex flex-col gap-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground" data-testid="text-travel-title">
              Travel Spend by Case Code
            </h2>
            <p className="text-sm text-muted-foreground">
              {periodMode === 'ytd' ? `YTD through ${MONTH_NAMES[selectedMonth - 1]}` : MONTH_NAMES[selectedMonth - 1]} — Total: {formatCurrency(totalTravelSpend)}
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search case codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-56"
              data-testid="input-travel-search"
            />
          </div>
        </div>

        {costCentersLoading || summaryLoading ? (
          <Card className="p-5">
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-4 py-3 border-b border-border">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-5 border-card-border" data-testid="card-travel-summary">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Case Code</th>
                    <th className="text-left py-3 px-3 font-medium text-muted-foreground">Case Name</th>
                    <th className="text-right py-3 px-3 font-medium text-muted-foreground">Items</th>
                    <th className="text-right py-3 px-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-right py-3 px-3 font-medium text-muted-foreground">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummary.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No travel expenses found
                      </td>
                    </tr>
                  ) : (
                    filteredSummary.map((item) => {
                      const pct = totalTravelSpend > 0 ? (item.totalAmount / totalTravelSpend) * 100 : 0;
                      const isSelected = selectedCaseCode === item.caseCode;
                      return (
                        <tr
                          key={item.caseCode}
                          className={`border-b border-border cursor-pointer transition-colors ${
                            isSelected ? 'bg-accent/50' : 'hover-elevate'
                          }`}
                          onClick={() => {
                            setSelectedCaseCode(isSelected ? null : item.caseCode);
                            setExpenseSearchTerm("");
                          }}
                          data-testid={`row-travel-case-${item.caseCode.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          <td className="py-3 px-3 font-medium text-foreground">{item.caseCode}</td>
                          <td className="py-3 px-3 text-muted-foreground">{item.caseName || '-'}</td>
                          <td className="py-3 px-3 text-right text-muted-foreground">{item.itemCount.toLocaleString()}</td>
                          <td className="py-3 px-3 text-right font-medium text-foreground">{formatCurrency(item.totalAmount)}</td>
                          <td className="py-3 px-3 text-right text-muted-foreground">{pct.toFixed(1)}%</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {filteredSummary.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border">
                      <td className="py-3 px-3 font-semibold text-foreground" colSpan={2}>Total</td>
                      <td className="py-3 px-3 text-right font-medium text-muted-foreground">
                        {filteredSummary.reduce((sum, item) => sum + item.itemCount, 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-foreground">
                        {formatCurrency(filteredSummary.reduce((sum, item) => sum + item.totalAmount, 0))}
                      </td>
                      <td className="py-3 px-3 text-right text-muted-foreground">100%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        )}

        {selectedCaseCode && (
          <Card className="p-5 flex flex-col border-card-border" data-testid="card-travel-expenses">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold text-foreground">Expense Details</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Case Code:</span>
                  <Badge variant="secondary" data-testid="badge-selected-case-code">
                    {selectedCaseCode}
                    {selectedCaseCodeInfo?.caseName && ` - ${selectedCaseCodeInfo.caseName}`}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    ({selectedCaseCodeInfo?.itemCount ?? 0} items, {formatCurrency(selectedCaseCodeInfo?.totalAmount ?? 0)})
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCaseCode(null)}
                data-testid="button-clear-case-code"
              >
                <X className="w-4 h-4 mr-1" />
                Close
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-4">
              <span className="text-sm text-muted-foreground">
                Showing {filteredExpenses.length} of {travelExpenses?.length ?? 0} records
              </span>
              <div className="flex-1" />
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search expenses..."
                  value={expenseSearchTerm}
                  onChange={(e) => setExpenseSearchTerm(e.target.value)}
                  className="pl-8 w-56"
                  data-testid="input-expense-search"
                />
              </div>
            </div>

            {expensesLoading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center gap-4 py-3 border-b border-border">
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Summary Account</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Account Name</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Case Code</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Period</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Line Description</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">T&E Employee</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">T&E Attachment</th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">
                        <button
                          onClick={() => setExpenseSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
                          className="flex items-center justify-end gap-1 cursor-pointer transition-colors ml-auto"
                          data-testid="button-sort-amount"
                        >
                          <span>Amount</span>
                          {expenseSortDirection === 'desc' ? (
                            <ArrowDown className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowUp className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-muted-foreground">
                          No expenses found matching the current filters
                        </td>
                      </tr>
                    ) : (
                      filteredExpenses.map((expense) => (
                        <tr
                          key={expense.id}
                          className="border-b border-border hover-elevate"
                          data-testid={`row-travel-expense-${expense.id}`}
                        >
                          <td className="py-2.5 px-2 text-muted-foreground whitespace-nowrap">{expense.summaryAccount || '-'}</td>
                          <td className="py-2.5 px-2 text-foreground max-w-[200px] truncate" title={expense.accountName}>{expense.accountName || '-'}</td>
                          <td className="py-2.5 px-2 text-muted-foreground whitespace-nowrap">{expense.caseCode || '-'}</td>
                          <td className="py-2.5 px-2 text-muted-foreground whitespace-nowrap">{expense.period || '-'}</td>
                          <td className="py-2.5 px-2 text-foreground max-w-[250px] truncate" title={expense.lineDescription}>{expense.lineDescription || '-'}</td>
                          <td className="py-2.5 px-2 text-muted-foreground max-w-[150px] truncate" title={expense.teeEmployeeName}>{expense.teeEmployeeName || '-'}</td>
                          <td className="py-2.5 px-2 text-muted-foreground">
                            {expense.teeAttachment ? (
                              <a
                                href={expense.teeAttachment}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 inline-flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                View
                              </a>
                            ) : '-'}
                          </td>
                          <td className={`py-2.5 px-2 text-right font-medium whitespace-nowrap ${expense.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {expense.amount < 0 ? '-' : ''}{formatCurrency(Math.abs(expense.amount))}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
