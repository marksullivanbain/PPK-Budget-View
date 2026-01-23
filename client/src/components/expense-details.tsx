import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Search, ArrowDown, ArrowUp } from "lucide-react";
import type { ExpenseDetail } from "@shared/schema";

interface ExpenseDetailsProps {
  costCenterId: string;
  filterType: 'category' | 'program';
  filterValue: string;
  filterLabel: string;
  filterColor?: string;
  onClearFilter: () => void;
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
}: ExpenseDetailsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  const { data: expenses, isLoading } = useQuery<ExpenseDetail[]>({
    queryKey: ['/api/cost-centers', costCenterId, 'expense-details', { filterType, filterValue }],
    queryFn: async () => {
      const response = await fetch(
        `/api/cost-centers/${costCenterId}/expense-details?filterType=${filterType}&filterValue=${encodeURIComponent(filterValue)}`
      );
      if (!response.ok) throw new Error('Failed to fetch expense details');
      return response.json();
    },
    enabled: !!costCenterId && !!filterValue,
  });

  const filteredExpenses = (expenses?.filter(exp => {
    const matchesSearch = searchTerm === "" || 
      exp.lineDescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.vendorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.caseName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPeriod = periodFilter === "all" || 
      exp.period?.toLowerCase().includes(periodFilter.toLowerCase());
    
    return matchesSearch && matchesPeriod;
  }) ?? []).sort((a, b) => {
    return sortDirection === 'desc' 
      ? Math.abs(b.amount) - Math.abs(a.amount)
      : Math.abs(a.amount) - Math.abs(b.amount);
  });

  const toggleSort = () => {
    setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const uniquePeriods = Array.from(new Set(expenses?.map(e => e.period).filter(Boolean) ?? []));

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

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <span className="text-sm text-muted-foreground self-center">
          Showing {filteredExpenses.length} of {expenses?.length ?? 0} records
        </span>
        <div className="flex-1" />
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
          <div className="grid grid-cols-[1fr_100px_180px_120px_100px_100px] gap-4 py-2 border-b border-border text-sm font-medium text-muted-foreground">
            <span>Line Description</span>
            <span>Spend Type</span>
            <span>Summary Account</span>
            <span>Case Name</span>
            <span>Period</span>
            <button 
              onClick={toggleSort}
              className="flex items-center justify-end gap-1 cursor-pointer hover:text-foreground transition-colors"
              data-testid="button-sort-amount"
            >
              <span>Amount (USD)</span>
              {sortDirection === 'desc' ? (
                <ArrowDown className="w-3.5 h-3.5" />
              ) : (
                <ArrowUp className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <ScrollArea className="max-h-[400px]">
            <div className="flex flex-col">
              {filteredExpenses.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No expenses found matching the current filters
                </div>
              ) : (
                filteredExpenses.map((expense) => (
                  <div 
                    key={expense.id}
                    className="grid grid-cols-[1fr_100px_180px_120px_100px_100px] gap-4 py-3 border-b border-border text-sm hover-elevate rounded-md"
                    data-testid={`row-expense-${expense.id}`}
                  >
                    <span className="text-foreground font-medium truncate" title={expense.lineDescription}>
                      {expense.lineDescription || '-'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-muted-foreground truncate" title={expense.spendType}>
                        {expense.spendType || '-'}
                      </span>
                    </div>
                    <span className="text-muted-foreground truncate" title={expense.summaryAccount}>
                      {expense.summaryAccount || '-'}
                    </span>
                    <span className="text-muted-foreground truncate" title={expense.caseName}>
                      {expense.caseName || '-'}
                    </span>
                    <span className="text-muted-foreground">
                      {expense.period || '-'}
                    </span>
                    <span className={`text-right font-medium ${expense.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {expense.amount < 0 ? '-' : ''}{formatCurrency(expense.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </Card>
  );
}
