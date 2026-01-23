import { Card } from "@/components/ui/card";
import type { SpendTypeBreakdown as SpendTypeBreakdownData } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SpendTypeBreakdownProps {
  data: SpendTypeBreakdownData[];
  totalActual: number;
  totalBudget: number;
  variance: number;
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
  const prefix = isOverBudget ? "-" : "+";
  return `${prefix}${formatCurrency(Math.round(Math.abs(amount)))} ${isOverBudget ? "over" : "under"}`;
}

export function SpendTypeBreakdown({ 
  data, 
  totalActual, 
  totalBudget, 
  variance,
  onCategoryClick,
  selectedCategory 
}: SpendTypeBreakdownProps) {
  return (
    <Card className="p-5 flex flex-col border-card-border h-full" data-testid="card-spend-type-breakdown">
      <div className="flex flex-col gap-1 mb-4">
        <h3 className="text-lg font-semibold text-foreground">Spend Type Breakdown</h3>
        <p className="text-sm text-muted-foreground">Budget vs Actual - Click a category to filter</p>
      </div>
      
      <ScrollArea className="flex-1 -mx-1 px-1">
        <div className="flex flex-col gap-5 pr-2">
          {data.map((item) => {
            const progressPercent = Math.min((item.actual / item.budget) * 100, 100);
            const isSelected = selectedCategory === item.categoryId;
            
            return (
              <div 
                key={item.categoryId}
                className={`flex flex-col gap-2 cursor-pointer rounded-md p-2 -m-2 transition-colors ${
                  isSelected ? 'bg-accent/50' : 'hover-elevate'
                }`}
                onClick={() => onCategoryClick?.(item.categoryId)}
                data-testid={`item-category-${item.categoryId}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2.5 h-2.5 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium text-foreground">{item.categoryName}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{item.itemCount} items</span>
                </div>
                
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-muted-foreground">
                    Actual: <span className="text-foreground font-medium">{formatCurrency(item.actual)}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Budget: {formatCurrency(item.budget)}
                  </span>
                </div>
                
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
                    style={{ 
                      width: `${progressPercent}%`,
                      backgroundColor: item.color 
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {item.percentUsed}% used
                  </span>
                  <span className={`text-xs font-medium ${
                    item.isOverBudget ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {formatVariance(item.variance, item.isOverBudget)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      
      <div className="border-t border-border mt-4 pt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Actual</span>
          <span className="text-sm font-semibold text-foreground" data-testid="text-total-actual">
            {formatCurrency(totalActual)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Budget</span>
          <span className="text-sm font-semibold text-foreground" data-testid="text-total-budget">
            {formatCurrency(totalBudget)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Variance</span>
          <span className={`text-sm font-semibold ${variance >= 0 ? 'text-emerald-400' : 'text-red-400'}`} data-testid="text-variance">
            {formatVariance(Math.abs(variance), variance < 0)}
          </span>
        </div>
      </div>
    </Card>
  );
}
