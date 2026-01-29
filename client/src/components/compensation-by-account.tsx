import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AccountSpendItem } from "@shared/schema";

interface CompensationByAccountProps {
  data: AccountSpendItem[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CompensationByAccount({ data }: CompensationByAccountProps) {
  const total = data.reduce((sum, item) => sum + item.amount, 0);

  return (
    <Card className="p-5 flex flex-col border-card-border h-full" data-testid="card-compensation-by-account">
      <div className="flex flex-col gap-1 mb-4">
        <h3 className="text-lg font-semibold text-foreground">Compensation by Summary Account</h3>
        <p className="text-sm text-muted-foreground">Breakdown by account type</p>
      </div>
      
      <ScrollArea className="flex-1 -mx-1 px-1">
        <div className="flex flex-col gap-3 pr-2">
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No compensation data</p>
          ) : (
            data.map((item) => {
              const percent = total > 0 ? (item.amount / total) * 100 : 0;
              
              return (
                <div 
                  key={item.account}
                  className="flex flex-col gap-1.5"
                  data-testid={`item-comp-account-${item.account.replace(/\s+/g, '-').toLowerCase()}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-2.5 h-2.5 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm font-medium text-foreground">{item.account}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{item.itemCount} items</span>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
                        style={{ 
                          width: `${percent}%`,
                          backgroundColor: item.color 
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-foreground min-w-[80px] text-right">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
      
      <div className="border-t border-border mt-4 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Total Compensation</span>
          <span className="text-sm font-medium text-foreground" data-testid="text-comp-account-total">
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </Card>
  );
}
