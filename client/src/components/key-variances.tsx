import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { useDemoMode } from "@/hooks/use-demo-mode";
import type { KeyVarianceItem } from "@shared/schema";

interface KeyVariancesProps {
  periodMode: 'ytd' | 'month';
  month: number;
  year?: number;
}

function formatCurrency(amount: number): string {
  const absAmount = Math.abs(amount);
  if (absAmount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (absAmount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function VarianceRow({ item }: { item: KeyVarianceItem }) {
  const { maskPracticeName } = useDemoMode();
  const isOverBudget = item.variance < 0;
  
  return (
    <div 
      className="flex items-center justify-between gap-4 py-3 px-4"
      data-testid={`variance-row-${item.practice}-${item.caseGroup}`}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate text-foreground" data-testid="variance-practice">
          {maskPracticeName(item.practice)}
        </div>
        <div className="text-xs text-muted-foreground truncate" data-testid="variance-casegroup">
          {item.caseGroup}
        </div>
      </div>
      
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Actual</div>
          <div className="text-sm font-medium">{formatCurrency(item.actual)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Budget</div>
          <div className="text-sm font-medium">{formatCurrency(item.budget)}</div>
        </div>
        <div className={`flex items-center gap-1 min-w-[100px] justify-end ${
          isOverBudget ? 'text-red-400' : 'text-emerald-400'
        }`}>
          {isOverBudget ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          <span className="text-sm font-semibold" data-testid="variance-amount">
            {isOverBudget ? '+' : '-'}{formatCurrency(Math.abs(item.variance))}
          </span>
        </div>
      </div>
    </div>
  );
}

function VarianceRowSkeleton() {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-border/50">
      <div className="flex-1">
        <Skeleton className="h-4 w-32 mb-1" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

export function KeyVariances({ periodMode, month, year }: KeyVariancesProps) {
  const { maskPracticeName } = useDemoMode();
  const { data: variances, isLoading, error } = useQuery<KeyVarianceItem[]>({
    queryKey: ['/api/key-variances', periodMode, month, year],
    queryFn: async () => {
      const url = `/api/key-variances?periodMode=${periodMode}&month=${month}&limit=20${year ? `&year=${year}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (response.status === 403) {
        throw new Error('ACCESS_DENIED');
      }
      if (!response.ok) throw new Error('Failed to fetch key variances');
      return response.json();
    },
  });
  
  const isAccessDenied = error?.message === 'ACCESS_DENIED';

  const overBudgetItems = variances?.filter(v => v.isOverBudget) || [];
  const underBudgetItems = variances?.filter(v => !v.isOverBudget) || [];

  return (
    <Card className="p-5 border-card-border" data-testid="key-variances-section">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-amber-400" />
        <h2 className="text-lg font-semibold text-foreground">Key Variances</h2>
        <span className="text-sm text-muted-foreground ml-2">
          Top variances across all practices
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <VarianceRowSkeleton key={i} />
          ))}
        </div>
      ) : isAccessDenied ? (
        <div className="text-center py-8 text-muted-foreground">
          Key variance analysis requires access to all practices
        </div>
      ) : error ? (
        <div className="text-center py-8 text-muted-foreground">
          Failed to load variance data
        </div>
      ) : variances && variances.length > 0 ? (
        <div className="space-y-4">
          {overBudgetItems.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Over Budget ({overBudgetItems.length})
              </h3>
              <div className="bg-red-950/20 rounded-lg">
                {overBudgetItems.map((item, index) => (
                  <VarianceRow key={`over-${index}`} item={item} />
                ))}
              </div>
            </div>
          )}
          
          {underBudgetItems.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-emerald-400 mb-2 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Under Budget ({underBudgetItems.length})
              </h3>
              <div className="bg-emerald-950/20 rounded-lg">
                {underBudgetItems.map((item, index) => (
                  <VarianceRow key={`under-${index}`} item={item} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          No variance data available for this period
        </div>
      )}
    </Card>
  );
}
