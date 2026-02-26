import { Card } from "@/components/ui/card";
import type { SpendTypeBreakdown as SpendTypeBreakdownData } from "@shared/schema";

interface CompensationBreakdownProps {
  data: SpendTypeBreakdownData | undefined;
  onCategoryClick?: (categoryId: string) => void;
  selectedCategory?: string | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatVariance(amount: number, isOverBudget: boolean): string {
  const prefix = isOverBudget ? "+" : "-";
  return `${prefix}${formatCurrency(Math.round(Math.abs(amount)))} ${isOverBudget ? "over" : "under"}`;
}

export function CompensationBreakdown({ 
  data, 
  onCategoryClick,
  selectedCategory 
}: CompensationBreakdownProps) {
  if (!data) {
    return (
      <Card className="p-5 flex flex-col border-card-border" data-testid="card-compensation-breakdown">
        <h3 className="text-lg font-semibold text-foreground mb-4">Compensation</h3>
        <p className="text-sm text-muted-foreground">No compensation data available</p>
      </Card>
    );
  }

  const progressPercent = data.budget > 0 ? Math.min((data.actual / data.budget) * 100, 100) : 0;
  const isSelected = selectedCategory === data.categoryId;

  return (
    <Card className="p-5 flex flex-col border-card-border" data-testid="card-compensation-breakdown">
      <div className="flex flex-col gap-1 mb-4">
        <h3 className="text-lg font-semibold text-foreground">Compensation</h3>
        <p className="text-sm text-muted-foreground">Budget vs Actual</p>
      </div>
      
      <div 
        className="flex flex-col gap-3 rounded-md p-3 -m-1"
        data-testid={`item-compensation-${data.categoryId}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: data.color }}
            />
            <span className="text-base font-medium text-foreground">{data.categoryName}</span>
          </div>
          <span className="text-sm text-muted-foreground">{data.itemCount} items</span>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Actual</span>
            <span className="text-lg font-semibold text-foreground" data-testid="text-comp-actual">
              {formatCurrency(Math.round(data.actual))}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Budget</span>
            <span className="text-lg font-medium text-muted-foreground" data-testid="text-comp-budget">
              {formatCurrency(Math.round(data.budget))}
            </span>
          </div>
        </div>
        
        <div className="relative h-3 bg-muted rounded-full overflow-hidden">
          <div 
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
            style={{ 
              width: `${progressPercent}%`,
              backgroundColor: data.color 
            }}
          />
        </div>
        
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {data.percentUsed}% of budget used
          </span>
          <span className={`text-sm font-medium ${
            data.isOverBudget ? 'text-red-400' : 'text-emerald-400'
          }`} data-testid="text-comp-variance">
            {formatVariance(data.variance, data.isOverBudget)}
          </span>
        </div>
      </div>
    </Card>
  );
}
