import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CostCenter } from "@shared/schema";

interface CostCenterSelectorProps {
  costCenters: CostCenter[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function CostCenterSelector({ costCenters, selectedId, onSelect }: CostCenterSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground whitespace-nowrap">Cost Center:</span>
      <Select value={selectedId} onValueChange={onSelect}>
        <SelectTrigger className="w-[180px]" data-testid="select-cost-center">
          <SelectValue placeholder="Select cost center" />
        </SelectTrigger>
        <SelectContent>
          {costCenters.map((center) => (
            <SelectItem key={center.id} value={center.id} data-testid={`option-cost-center-${center.id}`}>
              {center.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
