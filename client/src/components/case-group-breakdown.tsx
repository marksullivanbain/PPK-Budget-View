import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SpendTypeBreakdown as SpendTypeBreakdownData } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Filter } from "lucide-react";
import type { MouseEvent } from "react";

interface CaseGroupBreakdownProps {
  data: SpendTypeBreakdownData[];
  onCategoryClick?: (categoryId: string) => void;
  onCaseGroupSelect?: (categoryName: string | null) => void;
  selectedCategory?: string | null;
  selectedCaseGroup?: string | null;
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

export function CaseGroupBreakdown({ 
  data, 
  onCategoryClick,
  onCaseGroupSelect,
  selectedCategory,
  selectedCaseGroup
}: CaseGroupBreakdownProps) {
  const programItems = data.filter(d => d.categoryName !== "Compensation");
  
  const programActual = programItems.reduce((sum, d) => sum + d.actual, 0);
  const programBudget = programItems.reduce((sum, d) => sum + d.budget, 0);
  const programVariance = programBudget - programActual;
  const programIsOver = programVariance < 0;

  return (
    <Card className="p-5 flex flex-col border-card-border h-full" data-testid="card-case-group-breakdown">
      <div className="flex flex-col gap-1 mb-4">
        <h3 className="text-lg font-semibold text-foreground">Program Spend by Case Group</h3>
        <p className="text-sm text-muted-foreground">Budget vs Actual - Click to see details, use filter icon to filter dashboard</p>
      </div>
      
      <ScrollArea className="flex-1 -mx-1 px-1">
        <div className="flex flex-col gap-5 pr-2">
          {programItems.map((item) => {
            const progressPercent = item.budget > 0 ? Math.min((item.actual / item.budget) * 100, 100) : 0;
            const isSelected = selectedCategory === item.categoryId;
            const isCaseGroupSelected = selectedCaseGroup === item.categoryName;
            
            // Single click: Only opens expense details (no dashboard filter)
            const handleDrillDown = () => {
              if (isSelected) {
                onCategoryClick?.("");
              } else {
                onCategoryClick?.(item.categoryId);
              }
            };
            
            // Filter icon click: Filters the entire dashboard
            const handleFilter = (e: MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation(); // Prevent drill-down from also triggering
              if (onCaseGroupSelect) {
                onCaseGroupSelect(isCaseGroupSelected ? null : item.categoryName);
              }
            };
            
            return (
              <div 
                key={item.categoryId}
                className={`flex flex-col gap-2 cursor-pointer rounded-md p-2 -m-2 transition-colors ${
                  isSelected ? 'bg-accent/50' : 'hover-elevate'
                } ${isCaseGroupSelected ? 'ring-1 ring-primary/50' : ''}`}
                onClick={handleDrillDown}
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{item.itemCount} items</span>
                    <Button
                      type="button"
                      size="icon"
                      variant={isCaseGroupSelected ? "default" : "ghost"}
                      onClick={handleFilter}
                      className="h-6 w-6"
                      title={isCaseGroupSelected ? "Remove filter" : "Filter dashboard by this category"}
                      data-testid={`button-filter-${item.categoryId}`}
                    >
                      <Filter className="w-3.5 h-3.5" />
                    </Button>
                  </div>
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
      
      <div className="border-t border-border mt-4 pt-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Total Program Spend</span>
            <span className="text-sm font-medium text-foreground" data-testid="text-program-total">
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
      </div>
    </Card>
  );
}
