import { Card } from "@/components/ui/card";
import type { ProgramSpendItem } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ProgramSpendBreakdownProps {
  data: ProgramSpendItem[];
  totalProgramSpend: number;
  onCategoryClick?: (category: string) => void;
  selectedCategory?: string | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ProgramSpendBreakdown({ 
  data, 
  totalProgramSpend,
  onCategoryClick,
  selectedCategory 
}: ProgramSpendBreakdownProps) {
  const maxAmount = Math.max(...data.map(d => d.amount));
  
  return (
    <Card className="p-5 flex flex-col border-card-border h-full" data-testid="card-program-spend-breakdown">
      <div className="flex flex-col gap-1 mb-4">
        <h3 className="text-lg font-semibold text-foreground">Program Spend Breakdown</h3>
        <p className="text-sm text-muted-foreground">Click a category to filter expense details (showing categories over $1k)</p>
      </div>
      
      <ScrollArea className="flex-1 -mx-1 px-1">
        <div className="flex flex-col gap-6 pr-2">
          {data.map((item) => {
            const barPercent = (item.amount / maxAmount) * 100;
            const isSelected = selectedCategory === item.category;
            
            return (
              <div 
                key={item.category}
                className={`flex flex-col gap-2 cursor-pointer rounded-md p-2 -m-2 transition-colors ${
                  isSelected ? 'bg-accent/50' : 'hover-elevate'
                }`}
                onClick={() => onCategoryClick?.(item.category)}
                data-testid={`item-program-${item.category.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm font-medium text-foreground">{item.category}</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden flex-1">
                    <div 
                      className="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
                      style={{ 
                        width: `${barPercent}%`,
                        backgroundColor: item.color 
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm shrink-0">
                    <span className="text-muted-foreground">{item.itemCount} items</span>
                    <span className="font-semibold text-foreground">{formatCurrency(item.amount)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      
      <div className="border-t border-border mt-4 pt-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Total Program Spend</span>
        <span className="text-xl font-bold text-foreground" data-testid="text-total-program-spend">
          {formatCurrency(totalProgramSpend)}
        </span>
      </div>
    </Card>
  );
}
