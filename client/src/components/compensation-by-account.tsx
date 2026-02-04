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

type DisplayItem = 
  | { type: 'regular'; item: AccountSpendItem }
  | { type: 'bonus'; items: AccountSpendItem[]; total: number; itemCount: number };

export function CompensationByAccount({ data }: CompensationByAccountProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [bonusExpanded, setBonusExpanded] = useState(false);
  const total = data.reduce((sum, item) => sum + item.amount, 0);
  
  const bonusItems = data
    .filter(item => item.account.toLowerCase().includes('bonus'))
    .sort((a, b) => b.amount - a.amount);
  const nonBonusItems = data
    .filter(item => !item.account.toLowerCase().includes('bonus'));
  
  const bonusTotal = bonusItems.reduce((sum, item) => sum + item.amount, 0);
  const bonusItemCount = bonusItems.reduce((sum, item) => sum + item.itemCount, 0);
  const bonusColor = "#F97316";

  // Create a combined list with Bonus as a single sortable entry
  const displayItems: DisplayItem[] = [
    ...nonBonusItems.map(item => ({ type: 'regular' as const, item })),
    ...(bonusItems.length > 0 ? [{ 
      type: 'bonus' as const, 
      items: bonusItems, 
      total: bonusTotal, 
      itemCount: bonusItemCount 
    }] : [])
  ].sort((a, b) => {
    const amountA = a.type === 'bonus' ? a.total : a.item.amount;
    const amountB = b.type === 'bonus' ? b.total : b.item.amount;
    return amountB - amountA;
  });

  const renderRegularItem = (item: AccountSpendItem) => {
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
  };

  const renderBonusGroup = (items: AccountSpendItem[], groupTotal: number, groupItemCount: number) => {
    return (
      <div key="bonus-group" className="flex flex-col gap-2">
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
            <span className="text-xs text-muted-foreground">{groupItemCount} items</span>
          </div>
          
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
                style={{ 
                  width: `${total > 0 ? (groupTotal / total) * 100 : 0}%`,
                  backgroundColor: bonusColor 
                }}
              />
            </div>
            <span className="text-sm font-medium text-foreground min-w-[80px] text-right">
              {formatCurrency(groupTotal)}
            </span>
          </div>
        </div>
        
        {bonusExpanded && (
          <div className="flex flex-col gap-2 border-l-2 border-muted ml-1.5 pl-2">
            {items.map((item) => {
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
            })}
          </div>
        )}
      </div>
    );
  };

  // Build stacked bar segments for collapsed view (sorted by amount descending)
  const stackedBarData = displayItems.map((displayItem) => {
    if (displayItem.type === 'bonus') {
      return {
        label: 'Bonus',
        amount: displayItem.total,
        color: bonusColor,
        percent: total > 0 ? (displayItem.total / total) * 100 : 0
      };
    }
    return {
      label: displayItem.item.account,
      amount: displayItem.item.amount,
      color: displayItem.item.color,
      percent: total > 0 ? (displayItem.item.amount / total) * 100 : 0
    };
  });

  return (
    <Card className="p-5 flex flex-col border-card-border" data-testid="card-compensation-by-account">
      <div 
        className="flex items-center justify-between cursor-pointer hover-elevate rounded-md -m-1 p-1"
        onClick={() => setIsExpanded(!isExpanded)}
        data-testid="button-toggle-compensation"
      >
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-foreground">Compensation by Account</h3>
          <p className="text-sm text-muted-foreground">Breakdown by account type</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground" data-testid="text-comp-account-total">
            {formatCurrency(total)}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </div>
      
      {!isExpanded && data.length > 0 && (
        <div className="mt-4">
          <div className="flex h-6 rounded-md overflow-hidden" data-testid="stacked-bar-compensation">
            {stackedBarData.map((segment, index) => (
              <div
                key={segment.label}
                className="relative group"
                style={{ 
                  width: `${segment.percent}%`,
                  backgroundColor: segment.color,
                  minWidth: segment.percent > 0 ? '2px' : '0'
                }}
                title={`${segment.label}: ${Math.round(segment.percent)}%`}
              >
                {segment.percent >= 8 && (
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
                    {Math.round(segment.percent)}%
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {stackedBarData.map((segment) => (
              <div key={segment.label} className="flex items-center gap-1.5">
                <div 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-xs text-muted-foreground">{segment.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {isExpanded && (
        <>
          <div className="mt-4">
            <ScrollArea className="max-h-[280px] -mx-1 px-1">
              <div className="flex flex-col gap-3 pr-2">
                {data.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No compensation data</p>
                ) : (
                  displayItems.map((displayItem) => {
                    if (displayItem.type === 'bonus') {
                      return renderBonusGroup(displayItem.items, displayItem.total, displayItem.itemCount);
                    }
                    return renderRegularItem(displayItem.item);
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </>
      )}
    </Card>
  );
}
