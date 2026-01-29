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
        <h3 className="text-lg font-semibold text-foreground">Case Group Detail</h3>
        <p className="text-sm text-muted-foreground">Budget vs Actual - Click a case group to filter</p>
      </div>
      
      <ScrollArea className="flex-1 -mx-1 px-1">
        <div className="flex flex-col gap-5 pr-2">
          {data.map((item) => {
            const progressPercent = Math.min((item.actual / item.budget) * 100, 100);
            const isSelected = selectedCategory === item.categoryId;
            const isCompensation = item.categoryName === "Compensation";
            
            return (
              <div 
                key={item.categoryId}
                className={`flex flex-col gap-2 rounded-md p-2 -m-2 transition-colors ${
                  isCompensation 
                    ? '' 
                    : isSelected 
                      ? 'bg-accent/50 cursor-pointer' 
                      : 'hover-elevate cursor-pointer'
                }`}
                onClick={() => !isCompensation && onCategoryClick?.(item.categoryId)}
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
                    Actual: <span className="text-foreground font-medium">{formatCurrency(Math.round(item.actual))}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Budget: {formatCurrency(Math.round(item.budget))}
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
      
      <div className="border-t border-border mt-4 pt-4 flex flex-col gap-3">
        {(() => {
          const compItem = data.find(d => d.categoryName === "Compensation");
          const programItems = data.filter(d => d.categoryName !== "Compensation");
          const compActual = compItem?.actual ?? 0;
          const compBudget = compItem?.budget ?? 0;
          const compVariance = compBudget - compActual;
          const compIsOver = compVariance < 0;
          const programActual = programItems.reduce((sum, d) => sum + d.actual, 0);
          const programBudget = programItems.reduce((sum, d) => sum + d.budget, 0);
          const programVariance = programBudget - programActual;
          const programIsOver = programVariance < 0;
          
          return (
            <>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Compensation Subtotal</span>
                  <span className="text-sm font-medium text-foreground" data-testid="text-comp-subtotal">
                    {formatCurrency(Math.round(compActual))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Budget: {formatCurrency(Math.round(compBudget))}</span>
                  <span className={`text-xs font-medium ${compIsOver ? 'text-red-400' : 'text-emerald-400'}`}>
                    {formatVariance(Math.abs(compVariance), compIsOver)}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Program Subtotal</span>
                  <span className="text-sm font-medium text-foreground" data-testid="text-program-subtotal">
                    {formatCurrency(Math.round(programActual))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Budget: {formatCurrency(Math.round(programBudget))}</span>
                  <span className={`text-xs font-medium ${programIsOver ? 'text-red-400' : 'text-emerald-400'}`}>
                    {formatVariance(Math.abs(programVariance), programIsOver)}
                  </span>
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </Card>
  );
}
