import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight } from "lucide-react";
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
  const [bonusExpanded, setBonusExpanded] = useState(false);
  const total = data.reduce((sum, item) => sum + item.amount, 0);
  
  const bonusItems = data.filter(item => item.account.toLowerCase().includes('bonus'));
  const nonBonusItems = data.filter(item => !item.account.toLowerCase().includes('bonus'));
  
  const bonusTotal = bonusItems.reduce((sum, item) => sum + item.amount, 0);
  const bonusItemCount = bonusItems.reduce((sum, item) => sum + item.itemCount, 0);
  const bonusColor = "#F97316";

  const renderItem = (item: AccountSpendItem, indent: boolean = false) => {
    const percent = total > 0 ? (item.amount / total) * 100 : 0;
    
    return (
      <div 
        key={item.account}
        className={`flex flex-col gap-1.5 ${indent ? 'ml-4' : ''}`}
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
  };

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
            <>
              {nonBonusItems.map((item) => renderItem(item))}
              
              {bonusItems.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div 
                    className="flex flex-col gap-1.5 cursor-pointer hover-elevate rounded-md p-1 -m-1"
                    onClick={() => setBonusExpanded(!bonusExpanded)}
                    data-testid="item-comp-account-bonus"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {bonusExpanded ? (
                          <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        )}
                        <div 
                          className="w-2.5 h-2.5 rounded-full" 
                          style={{ backgroundColor: bonusColor }}
                        />
                        <span className="text-sm font-medium text-foreground">Bonus</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{bonusItemCount} items</span>
                    </div>
                    
                    <div className="flex items-center justify-between gap-2">
                      <div className="relative flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
                          style={{ 
                            width: `${total > 0 ? (bonusTotal / total) * 100 : 0}%`,
                            backgroundColor: bonusColor 
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium text-foreground min-w-[80px] text-right">
                        {formatCurrency(bonusTotal)}
                      </span>
                    </div>
                  </div>
                  
                  {bonusExpanded && (
                    <div className="flex flex-col gap-2 border-l-2 border-muted ml-1.5 pl-2">
                      {bonusItems.map((item) => renderItem(item, false))}
                    </div>
                  )}
                </div>
              )}
            </>
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
