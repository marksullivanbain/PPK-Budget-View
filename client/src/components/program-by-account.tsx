import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import type { AccountSpendItem } from "@shared/schema";

interface ProgramByAccountProps {
  data: AccountSpendItem[];
  selectedCaseGroup?: string | null;
  onClearFilter?: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ProgramByAccount({ data, selectedCaseGroup, onClearFilter }: ProgramByAccountProps) {
  const total = data.reduce((sum, item) => sum + item.amount, 0);

  return (
    <Card className="p-5 flex flex-col border-card-border h-full" data-testid="card-program-by-account">
      <div className="flex flex-col gap-1 mb-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-foreground">Program Spend by Account</h3>
          {selectedCaseGroup && (
            <Badge 
              variant="secondary" 
              className="cursor-pointer gap-1"
              onClick={onClearFilter}
              data-testid="badge-case-group-filter"
            >
              {selectedCaseGroup}
              <X className="w-3 h-3" />
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {selectedCaseGroup 
            ? `Filtered by ${selectedCaseGroup} case group`
            : "Breakdown by summary account"
          }
        </p>
      </div>
      
      <ScrollArea className="flex-1 -mx-1 px-1">
        <div className="flex flex-col gap-3 pr-2">
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {selectedCaseGroup 
                ? `No ${selectedCaseGroup} data above threshold`
                : "No program data above threshold"
              }
            </p>
          ) : (
            data.map((item) => {
              const percent = total > 0 ? (item.amount / total) * 100 : 0;
              
              return (
                <div 
                  key={item.account}
                  className="flex flex-col gap-1.5"
                  data-testid={`item-prog-account-${item.account.replace(/\s+/g, '-').toLowerCase()}`}
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
          <span className="text-sm font-medium text-foreground">
            {selectedCaseGroup ? `Total ${selectedCaseGroup}` : "Total Program Spend"}
          </span>
          <span className="text-sm font-medium text-foreground" data-testid="text-prog-account-total">
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </Card>
  );
}
