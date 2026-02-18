import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Search, ArrowDown, ArrowUp, Filter, Check } from "lucide-react";
import type { ExpenseDetail } from "@shared/schema";

interface ExpenseDetailsProps {
  costCenterId: string;
  filterType: 'category' | 'program' | 'account' | 'caseCode';
  filterValue: string;
  filterLabel: string;
  filterColor?: string;
  onClearFilter: () => void;
  periodMode?: 'ytd' | 'month';
  month?: number;
  caseGroup?: string;
  year?: number;
}

function formatCurrency(amount: number): string {
  const absAmount = Math.abs(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(absAmount);
}

export function ExpenseDetails({
  costCenterId,
  filterType,
  filterValue,
  filterLabel,
  filterColor = "#6B7280",
  onClearFilter,
  periodMode,
  month,
  caseGroup,
  year,
}: ExpenseDetailsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [selectedCaseCodes, setSelectedCaseCodes] = useState<Set<string>>(new Set());
  const [caseCodeSearch, setCaseCodeSearch] = useState("");

  const { data: expenses, isLoading } = useQuery<ExpenseDetail[]>({
    queryKey: ['/api/cost-centers', costCenterId, 'expense-details', { filterType, filterValue, periodMode, month, caseGroup, year }],
    queryFn: async () => {
      let url = `/api/cost-centers/${costCenterId}/expense-details?filterType=${filterType}&filterValue=${encodeURIComponent(filterValue)}`;
      if (periodMode) url += `&periodMode=${periodMode}`;
      if (month) url += `&month=${month}`;
      if (caseGroup) url += `&caseGroup=${encodeURIComponent(caseGroup)}`;
      if (year) url += `&year=${year}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch expense details');
      return response.json();
    },
    enabled: !!costCenterId && !!filterValue,
  });

  const uniqueCaseCodes = useMemo(() => {
    if (!expenses) return [];
    const codeMap = new Map<string, string>();
    for (const exp of expenses) {
      if (exp.caseCode) {
        const existing = codeMap.get(exp.caseCode);
        if (!existing && exp.caseName) {
          codeMap.set(exp.caseCode, exp.caseName);
        } else if (!existing) {
          codeMap.set(exp.caseCode, "");
        }
      }
    }
    return Array.from(codeMap.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [expenses]);

  const filteredCaseCodeOptions = useMemo(() => {
    if (!caseCodeSearch) return uniqueCaseCodes;
    const search = caseCodeSearch.toLowerCase();
    return uniqueCaseCodes.filter(
      cc => cc.code.toLowerCase().includes(search) || cc.name.toLowerCase().includes(search)
    );
  }, [uniqueCaseCodes, caseCodeSearch]);

  const filteredExpenses = (expenses?.filter(exp => {
    const matchesSearch = searchTerm === "" || 
      exp.lineDescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.vendorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.documentDescription?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPeriod = periodFilter === "all" || 
      exp.period?.toLowerCase().includes(periodFilter.toLowerCase());

    const matchesCaseCode = selectedCaseCodes.size === 0 || 
      (exp.caseCode && selectedCaseCodes.has(exp.caseCode));
    
    return matchesSearch && matchesPeriod && matchesCaseCode;
  }) ?? []).sort((a, b) => {
    return sortDirection === 'desc' 
      ? Math.abs(b.amount) - Math.abs(a.amount)
      : Math.abs(a.amount) - Math.abs(b.amount);
  });

  const toggleSort = () => {
    setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const toggleCaseCode = (code: string) => {
    setSelectedCaseCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const clearCaseCodeFilter = () => {
    setSelectedCaseCodes(new Set());
    setCaseCodeSearch("");
  };

  const selectAllVisible = () => {
    setSelectedCaseCodes(prev => {
      const next = new Set(prev);
      for (const cc of filteredCaseCodeOptions) {
        next.add(cc.code);
      }
      return next;
    });
  };

  const deselectAllVisible = () => {
    setSelectedCaseCodes(prev => {
      const next = new Set(prev);
      for (const cc of filteredCaseCodeOptions) {
        next.delete(cc.code);
      }
      return next;
    });
  };

  const uniquePeriods = Array.from(new Set(expenses?.map(e => e.period).filter(Boolean) ?? []));

  const allVisibleSelected = filteredCaseCodeOptions.length > 0 && 
    filteredCaseCodeOptions.every(cc => selectedCaseCodes.has(cc.code));

  return (
    <Card className="p-5 flex flex-col border-card-border" data-testid="card-expense-details">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-foreground">Expense Details</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtered by:</span>
            <div className="flex items-center gap-1.5 bg-accent/50 px-2 py-0.5 rounded-md">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: filterColor }}
              />
              <span className="text-sm text-foreground">{filterLabel}</span>
            </div>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onClearFilter}
          data-testid="button-clear-filter"
        >
          <X className="w-4 h-4 mr-1" />
          Clear Filter
        </Button>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <span className="text-sm text-muted-foreground self-center">
            Showing {filteredExpenses.length} of {expenses?.length ?? 0} records
          </span>
          <div className="flex-1" />
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Search:</span>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Vendor, description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-48"
                  data-testid="input-expense-search"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Period:</span>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-32" data-testid="select-period-filter">
                  <SelectValue placeholder="All Periods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Periods</SelectItem>
                  {uniquePeriods.map(period => (
                    <SelectItem key={period} value={period || 'unknown'}>{period}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Case Code:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-1.5"
                    data-testid="button-case-code-filter"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    {selectedCaseCodes.size === 0 
                      ? "All Codes" 
                      : `${selectedCaseCodes.size} selected`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="end">
                  <div className="p-3 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search case codes..."
                        value={caseCodeSearch}
                        onChange={(e) => setCaseCodeSearch(e.target.value)}
                        className="pl-8"
                        data-testid="input-case-code-search"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={allVisibleSelected ? deselectAllVisible : selectAllVisible}
                        data-testid="button-toggle-all-case-codes"
                      >
                        {allVisibleSelected ? "Deselect All" : "Select All"}
                      </Button>
                      {selectedCaseCodes.size > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={clearCaseCodeFilter}
                          data-testid="button-clear-case-codes"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-1">
                    {filteredCaseCodeOptions.length === 0 ? (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        No case codes found
                      </div>
                    ) : (
                      filteredCaseCodeOptions.map(cc => (
                        <label
                          key={cc.code}
                          className="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer transition-colors"
                          data-testid={`checkbox-case-code-${cc.code}`}
                        >
                          <Checkbox
                            checked={selectedCaseCodes.has(cc.code)}
                            onCheckedChange={() => toggleCaseCode(cc.code)}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium text-foreground">{cc.code}</span>
                            {cc.name && (
                              <span className="text-xs text-muted-foreground truncate">{cc.name}</span>
                            )}
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {selectedCaseCodes.size > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" data-testid="selected-case-codes">
            <span className="text-xs text-muted-foreground mr-1">Case codes:</span>
            {Array.from(selectedCaseCodes).sort().map(code => (
              <Badge
                key={code}
                variant="secondary"
                className="gap-1 cursor-pointer"
                onClick={() => toggleCaseCode(code)}
                data-testid={`badge-case-code-${code}`}
              >
                {code}
                <X className="w-3 h-3" />
              </Badge>
            ))}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={clearCaseCodeFilter}
              data-testid="button-clear-all-case-codes"
            >
              Clear all
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-border">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_90px_120px_120px_60px_80px_60px] gap-3 py-2 border-b border-border text-sm font-medium text-muted-foreground">
            <span>Line Description</span>
            <span>Case Code</span>
            <span>Case Name</span>
            <span>Vendor Name</span>
            <span>Period</span>
            <button 
              onClick={toggleSort}
              className="flex items-center justify-end gap-1 cursor-pointer transition-colors"
              data-testid="button-sort-amount"
            >
              <span>Amount</span>
              {sortDirection === 'desc' ? (
                <ArrowDown className="w-3.5 h-3.5" />
              ) : (
                <ArrowUp className="w-3.5 h-3.5" />
              )}
            </button>
            <span>Invoice Link</span>
          </div>

          <div className="max-h-[500px] overflow-y-auto">
            <div className="flex flex-col">
              {filteredExpenses.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No expenses found matching the current filters
                </div>
              ) : (
                filteredExpenses.map((expense) => (
                  <div 
                    key={expense.id}
                    className="grid grid-cols-[1fr_90px_120px_120px_60px_80px_60px] gap-3 py-3 border-b border-border text-sm hover-elevate rounded-md"
                    data-testid={`row-expense-${expense.id}`}
                  >
                    <span className="text-foreground font-medium truncate" title={expense.lineDescription}>
                      {expense.lineDescription || '-'}
                    </span>
                    <span className="text-muted-foreground truncate" title={expense.caseCode}>
                      {expense.caseCode || '-'}
                    </span>
                    <span className="text-muted-foreground truncate" title={expense.caseName}>
                      {expense.caseName || '-'}
                    </span>
                    <span className="text-muted-foreground truncate" title={expense.vendorName}>
                      {expense.vendorName || '-'}
                    </span>
                    <span className="text-muted-foreground">
                      {expense.period || '-'}
                    </span>
                    <span className={`text-right font-medium ${expense.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {expense.amount < 0 ? '-' : ''}{formatCurrency(expense.amount)}
                    </span>
                    <span className="text-muted-foreground truncate">
                      {expense.sapInvoiceDocUrl ? (
                        <a 
                          href={expense.sapInvoiceDocUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View
                        </a>
                      ) : '-'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
