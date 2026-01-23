import { Card } from "@/components/ui/card";
import { DollarSign, Settings, TrendingUp, TrendingDown } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: "dollar" | "settings" | "chart" | "variance";
  trend?: "up" | "down";
  accentColor?: "default" | "green";
}

export function KpiCard({ title, value, subtitle, icon, trend, accentColor = "default" }: KpiCardProps) {
  const iconMap = {
    dollar: DollarSign,
    settings: Settings,
    chart: TrendingUp,
    variance: trend === "up" ? TrendingUp : TrendingDown,
  };
  
  const IconComponent = iconMap[icon];

  return (
    <Card className="p-5 flex flex-col gap-3 border-card-border" data-testid={`card-kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        <IconComponent className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <span 
          className={`text-3xl font-semibold tracking-tight ${
            accentColor === "green" ? "text-emerald-400" : "text-foreground"
          }`}
          data-testid={`text-kpi-value-${title.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {value}
        </span>
        <span className="text-sm text-muted-foreground">{subtitle}</span>
      </div>
    </Card>
  );
}
