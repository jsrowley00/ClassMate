import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Users, DollarSign, BookOpen, Bot, Search, ArrowUpDown } from "lucide-react";
import { Link } from "wouter";

interface PlatformMetrics {
  totalUsers: number;
  activeSubscribers: number;
  professors: number;
  students: number;
  totalCourses: number;
  totalPracticeTests: number;
  totalChatSessions: number;
  totalFlashcardSets: number;
  totalAiCostCents: number;
}

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  subscriptionStatus: string | null;
  subscriptionExpiresAt: string | null;
  createdAt: string;
}

interface AIUsageByEndpoint {
  endpoint: string;
  callCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostCents: number;
}

interface AIUsageByUser {
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  callCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostCents: number;
}

interface AIUsageResponse {
  byUser: AIUsageByUser[];
  byEndpoint: AIUsageByEndpoint[];
  recentLogs: any[];
}

const ADMIN_EMAIL = "jsrowley00@gmail.com";

export default function AdminDashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You must be logged in to access this page.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/sign-in";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && user?.email !== ADMIN_EMAIL) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access the admin dashboard.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  }, [isAuthenticated, authLoading, user, toast]);

  const { data: metrics, isLoading: metricsLoading } = useQuery<PlatformMetrics>({
    queryKey: ["/api/admin/metrics"],
    enabled: isAuthenticated && user?.email === ADMIN_EMAIL,
  });

  const { data: users, isLoading: usersLoading } = useQuery<UserData[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAuthenticated && user?.email === ADMIN_EMAIL,
  });

  const { data: aiUsage, isLoading: aiUsageLoading } = useQuery<AIUsageResponse>({
    queryKey: ["/api/admin/ai-usage"],
    enabled: isAuthenticated && user?.email === ADMIN_EMAIL,
  });

  if (authLoading || !isAuthenticated || user?.email !== ADMIN_EMAIL) {
    return null;
  }

  const filteredUsers = users?.filter(u => {
    const searchLower = searchQuery.toLowerCase();
    return (
      u.email?.toLowerCase().includes(searchLower) ||
      u.firstName?.toLowerCase().includes(searchLower) ||
      u.lastName?.toLowerCase().includes(searchLower)
    );
  }) || [];

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    let aVal: any = a[sortField as keyof UserData];
    let bVal: any = b[sortField as keyof UserData];
    
    if (sortField === "createdAt" || sortField === "subscriptionExpiresAt") {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    }
    
    if (sortDirection === "asc") {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString();
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const totalAiCost = aiUsage?.byEndpoint?.reduce((sum, u) => sum + u.totalCostCents, 0) || 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Platform metrics, user management, and AI usage tracking
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metrics?.totalUsers || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics?.professors || 0} professors, {metrics?.students || 0} students
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscribers</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metrics?.activeSubscribers || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Paid students
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{metrics?.totalCourses || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {metrics?.totalFlashcardSets || 0} flashcard sets
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Usage Cost</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {aiUsageLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(totalAiCost)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total estimated cost
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="ai-usage">AI Usage</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>Manage and view all platform users</CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleSort("email")}
                        >
                          <div className="flex items-center gap-1">
                            Email
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleSort("role")}
                        >
                          <div className="flex items-center gap-1">
                            Role
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleSort("subscriptionStatus")}
                        >
                          <div className="flex items-center gap-1">
                            Subscription
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleSort("subscriptionExpiresAt")}
                        >
                          <div className="flex items-center gap-1">
                            Expires
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleSort("createdAt")}
                        >
                          <div className="flex items-center gap-1">
                            Joined
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>
                            {user.firstName || user.lastName 
                              ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {user.role ? (
                              <Badge variant={user.role === 'professor' ? 'default' : 'secondary'}>
                                {user.role}
                              </Badge>
                            ) : (
                              <Badge variant="outline">No role</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.subscriptionStatus ? (
                              <Badge 
                                variant={user.subscriptionStatus === 'active' ? 'default' : 'destructive'}
                              >
                                {user.subscriptionStatus}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{formatDate(user.subscriptionExpiresAt)}</TableCell>
                          <TableCell>{formatDate(user.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Usage by Endpoint</CardTitle>
              <CardDescription>Token usage and costs breakdown by feature</CardDescription>
            </CardHeader>
            <CardContent>
              {aiUsageLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : aiUsage?.byEndpoint && aiUsage.byEndpoint.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Endpoint</TableHead>
                        <TableHead className="text-right">Requests</TableHead>
                        <TableHead className="text-right">Input Tokens</TableHead>
                        <TableHead className="text-right">Output Tokens</TableHead>
                        <TableHead className="text-right">Est. Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aiUsage.byEndpoint.map((usage, idx) => (
                        <TableRow key={`${usage.endpoint}-${idx}`}>
                          <TableCell>
                            <Badge variant="outline">{usage.endpoint}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{usage.callCount}</TableCell>
                          <TableCell className="text-right">{usage.totalInputTokens.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{usage.totalOutputTokens.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(usage.totalCostCents)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No AI usage data yet. Usage will be tracked as users interact with AI features.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Practice Tests</CardTitle>
                <CardDescription>Total tests generated</CardDescription>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <Skeleton className="h-12 w-24" />
                ) : (
                  <div className="text-3xl font-bold">{metrics?.totalPracticeTests || 0}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Flashcard Sets</CardTitle>
                <CardDescription>Total sets created</CardDescription>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <Skeleton className="h-12 w-24" />
                ) : (
                  <div className="text-3xl font-bold">{metrics?.totalFlashcardSets || 0}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Chat Sessions</CardTitle>
                <CardDescription>Total AI tutor sessions</CardDescription>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <Skeleton className="h-12 w-24" />
                ) : (
                  <div className="text-3xl font-bold">{metrics?.totalChatSessions || 0}</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
