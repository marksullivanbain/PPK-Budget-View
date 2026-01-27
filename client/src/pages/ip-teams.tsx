import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, TrendingUp, ArrowLeftRight, RotateCcw, LayoutDashboard, LogOut } from "lucide-react";
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
      return <ArrowLeftRight className="h-4 w-4 text-purple-400" />;
    case 'Rotations':
      return <RotateCcw className="h-4 w-4 text-green-400" />;
    default:
      return <TrendingUp className="h-4 w-4 text-gray-400" />;
  }
}

function SummaryCard({ title, summary, icon }: { title: string; summary: IPTeamSummary; icon: React.ReactNode }) {
  const variance = summary.estimatedBudget - summary.ytdActual;
  const percentUsed = summary.estimatedBudget > 0 ? (summary.ytdActual / summary.estimatedBudget) * 100 : 0;
  
  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
        <CardTitle className="text-sm font-medium text-slate-400">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-white">{formatCurrencyFull(summary.ytdActual)}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-slate-400">Budget: {formatCurrencyFull(summary.estimatedBudget)}</span>
          <span className={`text-xs ${variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ({variance >= 0 ? '+' : ''}{formatCurrency(variance)})
          </span>
        </div>
        <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className={`h-full ${percentUsed > 100 ? 'bg-red-500' : 'bg-blue-500'}`}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
        <div className="text-xs text-slate-500 mt-1">{percentUsed.toFixed(0)}% of budget used</div>
      </CardContent>
    </Card>
  );
}

function IPTeamTable({ entries, type, month }: { entries: IPTeamEntry[]; type: string; month: number }) {
  if (entries.length === 0) {
    return (
      <div className="text-sm text-slate-500 py-4 text-center">
        No {type.toLowerCase()} entries found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-slate-700">
            <TableHead className="text-slate-400">Name</TableHead>
            <TableHead className="text-slate-400">Practice</TableHead>
            <TableHead className="text-slate-400">Level</TableHead>
            <TableHead className="text-slate-400">%</TableHead>
            {MONTH_NAMES.slice(0, month).map((m, i) => (
              <TableHead key={i} className="text-slate-400 text-right">{m}</TableHead>
            ))}
            <TableHead className="text-slate-400 text-right">YTD</TableHead>
            <TableHead className="text-slate-400 text-right">Budget</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const ytd = entry.monthlyAmounts.slice(0, month).reduce((sum, v) => sum + v, 0);
            return (
              <TableRow key={entry.id} className="border-slate-700 hover:bg-slate-800">
                <TableCell className="text-white font-medium">{entry.name || entry.caseName || '-'}</TableCell>
                <TableCell className="text-slate-300">{entry.costCenter}</TableCell>
                <TableCell className="text-slate-300">{entry.level || '-'}</TableCell>
                <TableCell className="text-slate-300">{entry.percentage}%</TableCell>
                {MONTH_NAMES.slice(0, month).map((_, i) => (
                  <TableCell key={i} className="text-right text-slate-300">
                    {entry.monthlyAmounts[i] > 0 ? formatCurrency(entry.monthlyAmounts[i]) : '-'}
                  </TableCell>
                ))}
                <TableCell className="text-right font-medium text-white">{formatCurrency(ytd)}</TableCell>
                <TableCell className="text-right text-slate-300">{formatCurrency(entry.cy25)}</TableCell>
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
  const [selectedPractice, setSelectedPractice] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("12");
  
  const { data, isLoading, error } = useQuery<IPTeamData>({
    queryKey: ["/api/ip-teams/data", selectedPractice, selectedMonth],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedPractice !== 'all') {
        params.set('practice', selectedPractice);
      }
      params.set('month', selectedMonth);
      const res = await fetch(`/api/ip-teams/data?${params}`);
      if (!res.ok) throw new Error("Failed to fetch IP teams data");
      return res.json();
    },
  });

  if (error) {
    return (
      <div className="p-6 bg-slate-950 min-h-screen">
        <div className="text-red-400">Error loading IP Teams data</div>
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
              <Button variant="outline" size="sm" asChild className="gap-1.5" data-testid="link-trends">
                <Link href="/trends">
                  <TrendingUp className="h-4 w-4" />
                  Trends
                </Link>
              </Button>
              <Button variant="default" size="sm" className="gap-1.5" data-testid="link-ip-teams-active">
                <Users className="h-4 w-4" />
                IP Teams
              </Button>
            </div>
            
            <div className="flex gap-3">
              <Select value={selectedPractice} onValueChange={setSelectedPractice}>
                <SelectTrigger className="w-[200px]" data-testid="select-practice">
                  <SelectValue placeholder="Select Practice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Practices</SelectItem>
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
              <Skeleton key={i} className="h-32 bg-slate-800" />
            ))}
          </div>
          <Skeleton className="h-96 bg-slate-800" />
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
              icon={<ArrowLeftRight className="h-4 w-4 text-purple-400" />}
            />
            <SummaryCard 
              title="Rotations" 
              summary={data.rotationsSubtotal} 
              icon={<RotateCcw className="h-4 w-4 text-green-400" />}
            />
            <SummaryCard 
              title="Total IP Investment" 
              summary={data.grandTotal} 
              icon={<TrendingUp className="h-4 w-4 text-amber-400" />}
            />
          </div>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-400" />
                Traditional ({data.traditionalRows.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <IPTeamTable entries={data.traditionalRows} type="Traditional" month={parseInt(selectedMonth)} />
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-purple-400" />
                Interlock ({data.interlockRows.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <IPTeamTable entries={data.interlockRows} type="Interlock" month={parseInt(selectedMonth)} />
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-green-400" />
                Rotations ({data.rotationsRows.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <IPTeamTable entries={data.rotationsRows} type="Rotations" month={parseInt(selectedMonth)} />
            </CardContent>
          </Card>
        </div>
      ) : null}
      </div>
    </div>
  );
}
