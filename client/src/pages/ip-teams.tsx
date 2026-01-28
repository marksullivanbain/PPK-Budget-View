import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, User, UsersRound, TrendingUp, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { IPTeamData, IPTeamEntry, IPTeamSummary } from "@shared/schema";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

function formatCurrencyFull(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'Traditional':
      return <Users className="h-4 w-4 text-blue-400" />;
    case 'Interlock':
      return <UsersRound className="h-4 w-4 text-purple-400" />;
    case 'Rotations':
      return <User className="h-4 w-4 text-green-400" />;
    default:
      return <TrendingUp className="h-4 w-4 text-gray-400" />;
  }
}

function SummaryCard({ title, summary, icon }: { title: string; summary: IPTeamSummary; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatCurrencyFull(summary.ytdActual)}</div>
        <div className="text-xs text-muted-foreground mt-1">YTD Investment</div>
      </CardContent>
    </Card>
  );
}

interface ConsolidatedProject {
  caseCode: string;
  caseName: string;
  monthlyAmounts: number[];
}

function countUniqueProjects(entries: IPTeamEntry[]): number {
  const uniqueCases = new Set(entries.map(e => e.caseCode || 'unknown'));
  return uniqueCases.size;
}

interface IPTeamTableProps {
  entries: IPTeamEntry[];
  type: string;
  month: number;
  selectedCaseCode: string | null;
  onSelectProject: (caseCode: string) => void;
}

function IPTeamTable({ entries, type, month, selectedCaseCode, onSelectProject }: IPTeamTableProps) {
  if (entries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No {type.toLowerCase()} entries found
      </div>
    );
  }

  // Consolidate entries by case code
  const projectMap = new Map<string, ConsolidatedProject>();
  
  for (const entry of entries) {
    const key = entry.caseCode || 'unknown';
    const existing = projectMap.get(key);
    
    if (existing) {
      // Sum up monthly amounts
      for (let i = 0; i < 12; i++) {
        existing.monthlyAmounts[i] += entry.monthlyAmounts[i] || 0;
      }
    } else {
      projectMap.set(key, {
        caseCode: entry.caseCode || '-',
        caseName: entry.caseName || '-',
        monthlyAmounts: [...entry.monthlyAmounts],
      });
    }
  }

  const consolidatedProjects = Array.from(projectMap.values());

  // Calculate subtotals for each month
  const monthlyTotals = new Array(12).fill(0);
  for (const project of consolidatedProjects) {
    for (let i = 0; i < 12; i++) {
      monthlyTotals[i] += project.monthlyAmounts[i] || 0;
    }
  }
  const ytdTotal = monthlyTotals.slice(0, month).reduce((sum, v) => sum + v, 0);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Case Code</TableHead>
            <TableHead>Project Name</TableHead>
            {MONTH_NAMES.slice(0, month).map((m, i) => (
              <TableHead key={i} className="text-right">{m}</TableHead>
            ))}
            <TableHead className="text-right">YTD</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {consolidatedProjects.map((project) => {
            const ytd = project.monthlyAmounts.slice(0, month).reduce((sum, v) => sum + v, 0);
            const isSelected = selectedCaseCode === project.caseCode;
            return (
              <TableRow 
                key={project.caseCode}
                className={`cursor-pointer hover-elevate ${isSelected ? 'bg-primary/10' : ''}`}
                onClick={() => onSelectProject(project.caseCode)}
                data-testid={`row-project-${project.caseCode}`}
              >
                <TableCell className="font-medium">{project.caseCode}</TableCell>
                <TableCell className="text-muted-foreground">{project.caseName}</TableCell>
                {MONTH_NAMES.slice(0, month).map((_, i) => (
                  <TableCell key={i} className="text-right text-muted-foreground">
                    {project.monthlyAmounts[i] > 0 ? formatCurrency(project.monthlyAmounts[i]) : '-'}
                  </TableCell>
                ))}
                <TableCell className="text-right font-medium">{formatCurrency(ytd)}</TableCell>
              </TableRow>
            );
          })}
          <TableRow className="bg-muted/50 font-semibold border-t-2">
            <TableCell colSpan={2}>Subtotal</TableCell>
            {MONTH_NAMES.slice(0, month).map((_, i) => (
              <TableCell key={i} className="text-right">
                {monthlyTotals[i] > 0 ? formatCurrency(monthlyTotals[i]) : '-'}
              </TableCell>
            ))}
            <TableCell className="text-right">{formatCurrency(ytdTotal)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function PersonDetailTable({ entries, month }: { entries: IPTeamEntry[]; month: number }) {
  if (entries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        No person entries found for this project
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>%</TableHead>
            {MONTH_NAMES.slice(0, month).map((m, i) => (
              <TableHead key={i} className="text-right">{m}</TableHead>
            ))}
            <TableHead className="text-right">YTD</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const ytd = entry.monthlyAmounts.slice(0, month).reduce((sum, v) => sum + v, 0);
            return (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.name || '-'}</TableCell>
                <TableCell className="text-muted-foreground">{entry.level || '-'}</TableCell>
                <TableCell className="text-muted-foreground">{entry.percentage}%</TableCell>
                {MONTH_NAMES.slice(0, month).map((_, i) => (
                  <TableCell key={i} className="text-right text-muted-foreground">
                    {entry.monthlyAmounts[i] > 0 ? formatCurrency(entry.monthlyAmounts[i]) : '-'}
                  </TableCell>
                ))}
                <TableCell className="text-right font-medium">{formatCurrency(ytd)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export default function IPTeamsPage() {
  const { user } = useAuth();
  const [selectedPractice, setSelectedPractice] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("12");
  const [selectedCaseCode, setSelectedCaseCode] = useState<string | null>(null);
  
  const { data: userAccess } = useQuery<{ canSeeAllPractices: boolean }>({
    queryKey: ['/api/user-access'],
  });

  const queryParams = new URLSearchParams({ month: selectedMonth });
  if (selectedPractice && selectedPractice !== 'all') {
    queryParams.set('practice', selectedPractice);
  }
  
  const { data, isLoading, error } = useQuery<IPTeamData>({
    queryKey: [`/api/ip-teams/data?${queryParams.toString()}`],
  });

  // Set initial practice when data loads
  if (data?.practices && data.practices.length > 0 && !selectedPractice && userAccess !== undefined) {
    if (userAccess.canSeeAllPractices) {
      setSelectedPractice("all");
    } else {
      setSelectedPractice(data.practices[0]);
    }
  }

  // Get all entries for selected project
  const allEntries = data ? [...data.traditionalRows, ...data.interlockRows, ...data.rotationsRows] : [];
  const selectedProjectEntries = selectedCaseCode 
    ? allEntries.filter(e => e.caseCode === selectedCaseCode)
    : [];
  const selectedProjectName = selectedProjectEntries.length > 0 
    ? selectedProjectEntries[0].caseName 
    : '';

  if (error) {
    return (
      <div className="p-6 min-h-screen bg-background">
        <div className="text-destructive">Error loading IP Teams data</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto p-4 md:p-6 lg:p-8">
        <header className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              {user && (
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || 'User'} />
                  <AvatarFallback>
                    {(user.firstName?.[0] || user.email?.[0] || 'U').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <div>
                <h1 className="text-xl md:text-2xl font-bold">IP Teams Investment Tracking</h1>
                <p className="text-sm text-muted-foreground">Non-cash investment tracking by practice and type</p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild className="gap-1.5" data-testid="button-logout">
              <a href="/api/logout">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </a>
            </Button>
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild className="gap-1.5" data-testid="link-dashboard">
                <Link href="/">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <Button variant="default" size="sm" className="gap-1.5" data-testid="link-ip-teams-active">
                <Users className="h-4 w-4" />
                IP Teams
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-1.5" data-testid="link-trends">
                <Link href="/trends">
                  <TrendingUp className="h-4 w-4" />
                  Trends
                </Link>
              </Button>
            </div>
            
            <div className="flex gap-3">
              <Select value={selectedPractice} onValueChange={setSelectedPractice}>
                <SelectTrigger className="w-[200px]" data-testid="select-practice">
                  <SelectValue placeholder="Select Practice" />
                </SelectTrigger>
                <SelectContent>
                  {userAccess?.canSeeAllPractices && (
                    <SelectItem value="all">All Practices</SelectItem>
                  )}
                  {data?.practices.map((practice) => (
                    <SelectItem key={practice} value={practice}>
                      {practice}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[150px]" data-testid="select-month">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </header>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard 
              title="Traditional" 
              summary={data.traditionalSubtotal} 
              icon={<Users className="h-4 w-4 text-blue-400" />}
            />
            <SummaryCard 
              title="Interlock" 
              summary={data.interlockSubtotal} 
              icon={<UsersRound className="h-4 w-4 text-purple-400" />}
            />
            <SummaryCard 
              title="Rotations" 
              summary={data.rotationsSubtotal} 
              icon={<User className="h-4 w-4 text-green-400" />}
            />
            <SummaryCard 
              title="Total IP Investment" 
              summary={data.grandTotal} 
              icon={<TrendingUp className="h-4 w-4 text-amber-400" />}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Traditional ({countUniqueProjects(data.traditionalRows)} projects)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <IPTeamTable 
                entries={data.traditionalRows} 
                type="Traditional" 
                month={parseInt(selectedMonth)}
                selectedCaseCode={selectedCaseCode}
                onSelectProject={setSelectedCaseCode}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UsersRound className="h-5 w-5 text-purple-500" />
                Interlock ({countUniqueProjects(data.interlockRows)} projects)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <IPTeamTable 
                entries={data.interlockRows} 
                type="Interlock" 
                month={parseInt(selectedMonth)}
                selectedCaseCode={selectedCaseCode}
                onSelectProject={setSelectedCaseCode}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-green-500" />
                Rotations ({countUniqueProjects(data.rotationsRows)} projects)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <IPTeamTable 
                entries={data.rotationsRows} 
                type="Rotations" 
                month={parseInt(selectedMonth)}
                selectedCaseCode={selectedCaseCode}
                onSelectProject={setSelectedCaseCode}
              />
            </CardContent>
          </Card>

          {selectedCaseCode && selectedProjectEntries.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  By Person Detail: {selectedCaseCode} - {selectedProjectName}
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedCaseCode(null)}
                  data-testid="button-close-detail"
                >
                  Close
                </Button>
              </CardHeader>
              <CardContent>
                <PersonDetailTable entries={selectedProjectEntries} month={parseInt(selectedMonth)} />
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
      </div>
    </div>
  );
}
