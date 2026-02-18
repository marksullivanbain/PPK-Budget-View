import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable
} from "@dnd-kit/core";
import { 
  SortableContext, 
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CostCenterSelector } from "@/components/cost-center-selector";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, LayoutDashboard, TrendingUp, Users, Plus, Trash2, GripVertical, Edit2, Check, X, Wallet, Plane, Download, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CostCenter, DynamicBudgetData, CaseCodeWithExpense, BudgetGroupWithCodes } from "@shared/schema";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];

interface DraggableCaseCodeProps {
  caseCode: CaseCodeWithExpense;
  isDragging?: boolean;
}

function DraggableCaseCode({ caseCode, isDragging }: DraggableCaseCodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: caseCode.caseCode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center justify-between p-2 bg-muted/50 rounded-md cursor-grab hover-elevate ${isDragging ? 'opacity-50' : ''}`}
      data-testid={`case-code-${caseCode.caseCode}`}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{caseCode.caseCode}</span>
          {caseCode.caseName && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{caseCode.caseName}</span>
          )}
        </div>
      </div>
      <span className={`text-sm font-medium ${caseCode.ytdActual < 0 ? 'text-red-500' : ''}`}>
        {formatCurrency(caseCode.ytdActual)}
      </span>
    </div>
  );
}

interface DroppableContainerProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

function DroppableContainer({ id, children, className }: DroppableContainerProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  
  return (
    <div 
      ref={setNodeRef}
      className={`${className} ${isOver ? 'ring-2 ring-primary/50 bg-primary/5' : ''}`}
    >
      {children}
    </div>
  );
}

interface BudgetGroupCardProps {
  group: BudgetGroupWithCodes;
  month: number;
  year: number;
  practiceId: string;
  onUpdate: (id: string, updates: { name?: string; allocatedBudget?: number }) => void;
  onDelete: (id: string) => void;
}

function BudgetGroupCard({ group, month, year, practiceId, onUpdate, onDelete }: BudgetGroupCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [editBudget, setEditBudget] = useState(group.allocatedBudget.toString());

  const handleSave = () => {
    onUpdate(group.id, {
      name: editName,
      allocatedBudget: parseFloat(editBudget) || 0
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(group.name);
    setEditBudget(group.allocatedBudget.toString());
    setIsEditing(false);
  };

  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const variance = group.ytdBudget - group.ytdActual;
  const isOverBudget = variance < 0;

  const handleDownload = async () => {
    if (group.caseCodes.length === 0) {
      toast({ title: "No case codes", description: "Add case codes to this group before downloading.", variant: "destructive" });
      return;
    }
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/budget-tracking/${practiceId}/export/${group.id}?month=${month}&year=${year}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch ? filenameMatch[1] : `${group.name}_expenses.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Download started", description: `Exported ${group.caseCodes.length} case codes to CSV.` });
    } catch {
      toast({ title: "Export failed", description: "Could not download the expense data. Please try again.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card className="p-4 border-card-border" data-testid={`budget-group-${group.id}`}>
      <div className="flex items-start justify-between gap-1 mb-3">
        {isEditing ? (
          <div className="flex-1 flex items-center gap-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-8 text-sm"
              placeholder="Group name"
              data-testid="input-group-name"
            />
            <Button size="icon" variant="ghost" onClick={handleSave} data-testid="button-save-group">
              <Check className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={handleCancel} data-testid="button-cancel-edit">
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{group.name}</h3>
            <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)} data-testid="button-edit-group">
              <Edit2 className="w-4 h-4" />
            </Button>
          </div>
        )}
        <div className="flex items-center gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDownload}
            disabled={group.caseCodes.length === 0 || isDownloading}
            data-testid={`button-download-group-${group.id}`}
            title="Download expense data for this group"
          >
            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(group.id)} data-testid="button-delete-group">
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>

      {isEditing && (
        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block">Full Year Budget Allocation</label>
          <div className="flex items-center gap-2">
            <span className="text-sm">$</span>
            <Input
              type="number"
              value={editBudget}
              onChange={(e) => setEditBudget(e.target.value)}
              className="h-8 text-sm"
              placeholder="0"
              data-testid="input-group-budget"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 mb-3 text-sm">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Full Year Budget</span>
          <span className="font-medium">{formatCurrency(group.fullYearBudget)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">YTD Budget ({month}/12)</span>
          <span className="font-medium">{formatCurrency(group.ytdBudget)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">YTD Actual</span>
          <span className="font-medium">{formatCurrency(group.ytdActual)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">Variance</span>
          <span className={`font-medium ${isOverBudget ? 'text-red-500' : 'text-green-500'}`}>
            {formatCurrency(variance)}
          </span>
        </div>
      </div>

      <DroppableContainer 
        id={`group-${group.id}`}
        className="flex flex-col gap-1 min-h-[60px] p-2 bg-background/50 rounded-md border border-dashed border-border"
      >
        <SortableContext items={group.caseCodes.map(cc => cc.caseCode)} strategy={verticalListSortingStrategy}>
          {group.caseCodes.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              Drag case codes here
            </div>
          ) : (
            group.caseCodes.map((caseCode) => (
              <DraggableCaseCode key={caseCode.caseCode} caseCode={caseCode} />
            ))
          )}
        </SortableContext>
      </DroppableContainer>
    </Card>
  );
}

export default function BudgetTracking() {
  const { user } = useAuth();
  const [selectedCostCenterId, setSelectedCostCenterId] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(1);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const { data: latestMonthData } = useQuery<{ year: number; latestMonth: number }>({
    queryKey: ['/api/latest-month', selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/latest-month?year=${selectedYear}`);
      return res.json();
    },
  });

  useEffect(() => {
    if (latestMonthData) {
      setSelectedMonth(latestMonthData.latestMonth);
    }
  }, [latestMonthData]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: costCenters, isLoading: costCentersLoading } = useQuery<CostCenter[]>({
    queryKey: ["/api/cost-centers"],
  });

  useEffect(() => {
    if (costCenters && costCenters.length > 0 && !selectedCostCenterId) {
      setSelectedCostCenterId(costCenters[0].id);
    }
  }, [costCenters, selectedCostCenterId]);

  const { data: budgetData, isLoading: budgetDataLoading, refetch } = useQuery<DynamicBudgetData>({
    queryKey: ["/api/budget-tracking", selectedCostCenterId, selectedMonth, selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/budget-tracking/${selectedCostCenterId}?month=${selectedMonth}&year=${selectedYear}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch budget data');
      return res.json();
    },
    enabled: !!selectedCostCenterId && selectedCostCenterId !== 'all',
  });

  const createGroupMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/budget-tracking/${selectedCostCenterId}/groups`, {
        name: 'New Group',
        allocatedBudget: 0,
        displayOrder: (budgetData?.groups.length || 0) + 1
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-tracking", selectedCostCenterId, selectedMonth, selectedYear] });
    }
  });

  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { name?: string; allocatedBudget?: number } }) => {
      return apiRequest('PUT', `/api/budget-tracking/groups/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-tracking", selectedCostCenterId, selectedMonth, selectedYear] });
    }
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/budget-tracking/groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-tracking", selectedCostCenterId, selectedMonth, selectedYear] });
    }
  });

  const assignCaseCodeMutation = useMutation({
    mutationFn: async ({ caseCode, groupId }: { caseCode: string; groupId: string | null }) => {
      return apiRequest('POST', `/api/budget-tracking/${selectedCostCenterId}/assign`, {
        caseCode,
        groupId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budget-tracking", selectedCostCenterId, selectedMonth, selectedYear] });
    }
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const caseCode = active.id as string;
    const overId = over.id as string;
    
    // Check if dropping on the unassigned container
    if (overId === 'unassigned') {
      assignCaseCodeMutation.mutate({ caseCode, groupId: null });
      return;
    }
    
    // Check if dropping on a group container (format: "group-{id}")
    if (overId.startsWith('group-')) {
      const groupId = overId.replace('group-', '');
      assignCaseCodeMutation.mutate({ caseCode, groupId });
      return;
    }
    
    // Dropping on another case code - find which group it belongs to
    const targetGroup = budgetData?.groups.find(g => 
      g.caseCodes.some(cc => cc.caseCode === overId)
    );
    if (targetGroup) {
      assignCaseCodeMutation.mutate({ caseCode, groupId: targetGroup.id });
      return;
    }
    
    // Case code dropped on another unassigned case code
    const isUnassigned = budgetData?.unassignedCaseCodes.some(cc => cc.caseCode === overId);
    if (isUnassigned) {
      assignCaseCodeMutation.mutate({ caseCode, groupId: null });
    }
  };

  const activeCaseCode = activeDragId 
    ? [...(budgetData?.unassignedCaseCodes || []), ...(budgetData?.groups.flatMap(g => g.caseCodes) || [])]
        .find(cc => cc.caseCode === activeDragId)
    : null;

  const allocationStatus = budgetData 
    ? {
        total: budgetData.totalProgramBudget,
        allocated: budgetData.totalAllocated,
        remaining: budgetData.unallocatedBudget,
        isFullyAllocated: Math.abs(budgetData.unallocatedBudget) < 1,
        isOverAllocated: budgetData.unallocatedBudget < -1
      }
    : null;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Please log in to access the dashboard.</p>
      </div>
    );
  }

  const isAllPractices = selectedCostCenterId === 'all';

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex items-center justify-between px-6 py-3 gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold whitespace-nowrap">Dynamic Budget Tracking</h1>
            <nav className="flex items-center gap-1">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2" data-testid="link-dashboard">
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
              </Link>
              <Link href="/trends">
                <Button variant="ghost" size="sm" className="gap-2" data-testid="link-trends">
                  <TrendingUp className="w-4 h-4" />
                  <span className="hidden sm:inline">Trends</span>
                </Button>
              </Link>
              <Link href="/ip-teams">
                <Button variant="ghost" size="sm" className="gap-2" data-testid="link-ip-teams">
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">IP Teams</span>
                </Button>
              </Link>
              <Button variant="default" size="sm" className="gap-2" data-testid="link-budget-tracking">
                <Wallet className="w-4 h-4" />
                <span className="hidden sm:inline">Budget Tracking</span>
              </Button>
              <Link href="/travel-detail">
                <Button variant="ghost" size="sm" className="gap-2" data-testid="link-travel-detail">
                  <Plane className="w-4 h-4" />
                  <span className="hidden sm:inline">Travel Detail</span>
                </Button>
              </Link>
            </nav>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <Select 
              value={selectedYear.toString()} 
              onValueChange={(value) => setSelectedYear(parseInt(value))}
            >
              <SelectTrigger className="w-[100px]" data-testid="select-year">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
              <SelectTrigger className="w-[140px]" data-testid="select-month">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, index) => (
                  <SelectItem key={index + 1} value={(index + 1).toString()}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <CostCenterSelector
              costCenters={costCenters || []}
              selectedId={selectedCostCenterId}
              onSelect={setSelectedCostCenterId}
              showAllPractices={false}
            />

            <div className="flex items-center gap-2 pl-2 border-l">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.profileImageUrl || undefined} />
                <AvatarFallback>
                  {user.firstName?.[0] || user.email?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm hidden lg:inline">{user.firstName || user.email}</span>
              <form action="/api/auth/logout" method="POST">
                <Button variant="ghost" size="icon" type="submit" data-testid="button-logout">
                  <LogOut className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        {isAllPractices ? (
          <Card className="p-6">
            <p className="text-muted-foreground text-center">
              Please select a specific practice to manage budget groups. Dynamic budget tracking is not available for "All Practices" view.
            </p>
          </Card>
        ) : budgetDataLoading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          </div>
        ) : budgetData ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="mb-6">
              <Card className="p-4 border-card-border">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">{budgetData.practiceName}</h2>
                    <p className="text-sm text-muted-foreground">
                      Non-compensation program budget allocation
                    </p>
                  </div>
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Core Program Budget</span>
                      <span className="text-lg font-semibold">{formatCurrency(budgetData.coreProgramBudget || 0)}</span>
                    </div>
                    {budgetData.marketingBudget > 0 && (
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Marketing Budget</span>
                        <span className="text-lg font-semibold">{formatCurrency(budgetData.marketingBudget)}</span>
                      </div>
                    )}
                    <div className="flex flex-col border-l pl-6 border-border">
                      <span className="text-xs text-muted-foreground">Total Program Budget</span>
                      <span className="text-lg font-semibold">{formatCurrency(allocationStatus?.total || 0)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Allocated</span>
                      <span className="text-lg font-semibold">{formatCurrency(allocationStatus?.allocated || 0)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Remaining</span>
                      <span className={`text-lg font-semibold ${allocationStatus?.isOverAllocated ? 'text-red-500' : allocationStatus?.isFullyAllocated ? 'text-green-500' : 'text-yellow-500'}`}>
                        {formatCurrency(allocationStatus?.remaining || 0)}
                      </span>
                    </div>
                  </div>
                </div>
                {allocationStatus && !allocationStatus.isFullyAllocated && (
                  <div className={`mt-3 p-2 rounded text-sm ${allocationStatus.isOverAllocated ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                    {allocationStatus.isOverAllocated 
                      ? `Warning: You have over-allocated by ${formatCurrency(Math.abs(allocationStatus.remaining))}`
                      : `${formatCurrency(allocationStatus.remaining)} remaining to allocate across groups`
                    }
                  </div>
                )}
              </Card>
            </div>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Budget Groups</h3>
              <Button onClick={() => createGroupMutation.mutate()} disabled={createGroupMutation.isPending} data-testid="button-add-group">
                <Plus className="w-4 h-4 mr-2" />
                Add Group
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
              {budgetData.groups.map((group) => (
                <BudgetGroupCard
                  key={group.id}
                  group={group}
                  month={selectedMonth}
                  year={selectedYear}
                  practiceId={selectedCostCenterId}
                  onUpdate={(id, updates) => updateGroupMutation.mutate({ id, updates })}
                  onDelete={(id) => deleteGroupMutation.mutate(id)}
                />
              ))}
            </div>

            <Card className="p-4 border-card-border" data-testid="unassigned-case-codes">
              <h3 className="font-semibold mb-3">Unassigned Case Codes</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Drag case codes to groups above to assign them. These are all non-compensation expenses.
              </p>
              <DroppableContainer 
                id="unassigned"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 min-h-[100px] p-2 bg-background/50 rounded-md border border-dashed border-border"
              >
                <SortableContext items={budgetData.unassignedCaseCodes.map(cc => cc.caseCode)} strategy={verticalListSortingStrategy}>
                  {budgetData.unassignedCaseCodes.length === 0 ? (
                    <div className="col-span-full text-sm text-muted-foreground text-center py-4">
                      All case codes have been assigned to groups
                    </div>
                  ) : (
                    budgetData.unassignedCaseCodes.map((caseCode) => (
                      <DraggableCaseCode key={caseCode.caseCode} caseCode={caseCode} />
                    ))
                  )}
                </SortableContext>
              </DroppableContainer>
            </Card>

            <DragOverlay>
              {activeCaseCode ? (
                <div className="p-2 bg-card rounded-md shadow-lg border">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{activeCaseCode.caseCode}</span>
                    <span className="text-sm">{formatCurrency(activeCaseCode.ytdActual)}</span>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <Card className="p-6">
            <p className="text-muted-foreground text-center">No data available</p>
          </Card>
        )}
      </main>
    </div>
  );
}
