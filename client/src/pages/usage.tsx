import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, LayoutDashboard, ShieldCheck, Users, Activity, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDemoMode } from "@/hooks/use-demo-mode";

const BLUR_CLASS = "blur-sm select-none";

interface UserStat {
  email: string;
  name: string;
  loginCount: number;
  firstLogin: string;
  lastLogin: string;
}

interface RecentLogin {
  email: string;
  firstName: string;
  lastName: string;
  loginAt: string;
}

interface UsageData {
  totalLogins: number;
  uniqueUsers: number;
  users: UserStat[];
  recentLogins: RecentLogin[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2);
}

export default function Usage() {
  const { user } = useAuth();
  const { isDemoMode } = useDemoMode();

  const { data, isLoading, isError } = useQuery<UsageData>({
    queryKey: ['/api/usage'],
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-400" />
            Usage Tracking
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild className="gap-1.5" data-testid="link-dashboard">
            <Link href="/">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-1.5" data-testid="link-admin-summary">
            <Link href="/admin-summary">
              <ShieldCheck className="h-4 w-4" />
              Admin Summary
            </Link>
          </Button>
          <div className="flex items-center gap-2 pl-3 border-l border-border">
            <Avatar className="h-7 w-7">
              <AvatarImage src={user?.profileImageUrl || ''} />
              <AvatarFallback className="text-xs">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <span className={`text-sm text-muted-foreground ${isDemoMode ? BLUR_CLASS : ''}`}>
              {user?.firstName} {user?.lastName}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild data-testid="button-logout">
              <a href="/api/logout"><LogOut className="h-4 w-4" /></a>
            </Button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {isLoading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
            <Skeleton className="h-64" />
          </div>
        )}

        {isError && (
          <Card className="p-8 text-center">
            <p className="text-red-400">Failed to load usage data. This page is only available to admins.</p>
          </Card>
        )}

        {data && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/10 p-2.5 rounded-lg">
                    <Users className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Unique Users</p>
                    <p className="text-2xl font-bold" data-testid="text-unique-users">{data.uniqueUsers}</p>
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="bg-green-500/10 p-2.5 rounded-lg">
                    <Activity className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Logins</p>
                    <p className="text-2xl font-bold" data-testid="text-total-logins">{data.totalLogins}</p>
                  </div>
                </div>
              </Card>
            </div>

            <Card className="overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Users ({data.users.length})
                </h2>
              </div>
              <div className="divide-y divide-border">
                {data.users.map((u) => (
                  <div key={u.email} className="px-5 py-3 flex items-center justify-between" data-testid={`row-user-${u.email}`}>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className={`text-sm font-medium ${isDemoMode ? BLUR_CLASS : ''}`}>{u.name}</p>
                        <p className={`text-xs text-muted-foreground ${isDemoMode ? BLUR_CLASS : ''}`}>{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-sm font-medium">{u.loginCount}</p>
                        <p className="text-xs text-muted-foreground">logins</p>
                      </div>
                      <div className="min-w-[100px]">
                        <p className="text-sm font-medium">{timeAgo(u.lastLogin)}</p>
                        <p className="text-xs text-muted-foreground">last active</p>
                      </div>
                    </div>
                  </div>
                ))}
                {data.users.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No login data recorded yet.
                  </div>
                )}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Recent Activity
                </h2>
              </div>
              <div className="divide-y divide-border">
                {data.recentLogins.map((login, i) => (
                  <div key={i} className="px-5 py-2.5 flex items-center justify-between" data-testid={`row-recent-login-${i}`}>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                      <span className={`text-sm ${isDemoMode ? BLUR_CLASS : ''}`}>
                        {[login.firstName, login.lastName].filter(Boolean).join(' ') || login.email}
                      </span>
                      <span className="text-xs text-muted-foreground">signed in</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDateTime(login.loginAt)}</span>
                  </div>
                ))}
                {data.recentLogins.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No recent activity.
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
