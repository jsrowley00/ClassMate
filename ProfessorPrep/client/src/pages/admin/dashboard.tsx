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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, DollarSign, BookOpen, Bot, Search, ArrowUpDown, MessageSquare, FileText, GraduationCap, X } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";

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

interface UserDetailData {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string | null;
    hasProfessorAccess: boolean | null;
    subscriptionStatus: string | null;
    subscriptionExpiresAt: string | null;
    stripeCustomerId: string | null;
    createdAt: string;
  };
  aiUsage: {
    byEndpoint: {
      endpoint: string;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalCostCents: number;
      callCount: number;
    }[];
    totals: {
      totalInputTokens: number;
      totalOutputTokens: number;
      totalCostCents: number;
      callCount: number;
    };
  };
  flashcardSets: {
    id: string;
    title: string;
    courseId: string;
    courseName: string | null;
    createdAt: string;
  }[];
  practiceTests: {
    id: string;
    courseId: string;
    courseName: string | null;
    score: number | null;
    questions: any[];
    completed: boolean;
    createdAt: string;
  }[];
  chatSessions: {
    id: string;
    title: string | null;
    sessionType: string;
    courseId: string | null;
    courseName: string | null;
    createdAt: string;
  }[];
  enrolledCourses: {
    courseId: string;
    courseName: string;
    courseType: string;
    enrolledAt: string;
  }[];
  ownedCourses: {
    id: string;
    name: string;
    courseType: string;
    createdAt: string;
  }[];
}

const ADMIN_EMAIL = "jsrowley00@gmail.com";

export default function AdminDashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetailData, setUserDetailData] = useState<UserDetailData | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);

  const fetchUserDetails = async (userId: string) => {
    setUserDetailLoading(true);
    try {
      const response = await apiRequest("GET", `/api/admin/users/${userId}`);
      const data = await response.json();
      setUserDetailData(data);
    } catch (error) {
      console.error("Error fetching user details:", error);
      toast({
        title: "Error",
        description: "Failed to load user details",
        variant: "destructive",
      });
    } finally {
      setUserDetailLoading(false);
    }
  };

  const handleUserClick = (userId: string) => {
    setSelectedUserId(userId);
    fetchUserDetails(userId);
  };

  const closeUserDetail = () => {
    setSelectedUserId(null);
    setUserDetailData(null);
  };

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
                      {sortedUsers.map((userData) => (
                        <TableRow key={userData.id}>
                          <TableCell>
                            <button
                              onClick={() => handleUserClick(userData.id)}
                              className="font-medium text-primary hover:underline cursor-pointer text-left"
                            >
                              {userData.email}
                            </button>
                          </TableCell>
                          <TableCell>
                            {userData.firstName || userData.lastName 
                              ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {userData.role ? (
                              <Badge variant={userData.role === 'professor' ? 'default' : 'secondary'}>
                                {userData.role}
                              </Badge>
                            ) : (
                              <Badge variant="outline">No role</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {userData.subscriptionStatus ? (
                              <Badge 
                                variant={userData.subscriptionStatus === 'active' ? 'default' : 'destructive'}
                              >
                                {userData.subscriptionStatus}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{formatDate(userData.subscriptionExpiresAt)}</TableCell>
                          <TableCell>{formatDate(userData.createdAt)}</TableCell>
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

      <Dialog open={selectedUserId !== null} onOpenChange={(open) => !open && closeUserDetail()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {userDetailData?.user ? (
                <>
                  {userDetailData.user.firstName || userDetailData.user.lastName
                    ? `${userDetailData.user.firstName || ''} ${userDetailData.user.lastName || ''}`.trim()
                    : userDetailData.user.email}
                </>
              ) : (
                "User Details"
              )}
            </DialogTitle>
            <DialogDescription>
              {userDetailData?.user?.email}
            </DialogDescription>
          </DialogHeader>

          {userDetailLoading ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : userDetailData ? (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6 pb-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        AI Calls
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{userDetailData.aiUsage.totals.callCount}</div>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(userDetailData.aiUsage.totals.totalCostCents)} est. cost
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Flashcard Sets
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{userDetailData.flashcardSets.length}</div>
                      <p className="text-xs text-muted-foreground">sets created</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <GraduationCap className="h-4 w-4" />
                        Practice Tests
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{userDetailData.practiceTests.length}</div>
                      <p className="text-xs text-muted-foreground">tests taken</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Chat Sessions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{userDetailData.chatSessions.length}</div>
                      <p className="text-xs text-muted-foreground">AI tutor chats</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">User Info</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Role</p>
                        <p className="font-medium">
                          {userDetailData.user.role ? (
                            <Badge variant={userDetailData.user.role === 'professor' ? 'default' : 'secondary'}>
                              {userDetailData.user.role}
                            </Badge>
                          ) : (
                            <Badge variant="outline">No role</Badge>
                          )}
                          {userDetailData.user.hasProfessorAccess && (
                            <Badge variant="outline" className="ml-2">Professor Access</Badge>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Subscription</p>
                        <p className="font-medium">
                          {userDetailData.user.subscriptionStatus ? (
                            <Badge variant={userDetailData.user.subscriptionStatus === 'active' ? 'default' : 'destructive'}>
                              {userDetailData.user.subscriptionStatus}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">None</span>
                          )}
                          {userDetailData.user.subscriptionExpiresAt && (
                            <span className="text-sm text-muted-foreground ml-2">
                              (expires {formatDate(userDetailData.user.subscriptionExpiresAt)})
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Joined</p>
                        <p className="font-medium">{formatDate(userDetailData.user.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Stripe Customer</p>
                        <p className="font-medium text-xs font-mono">
                          {userDetailData.user.stripeCustomerId || '-'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {userDetailData.aiUsage.byEndpoint.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">AI Usage by Feature</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Feature</TableHead>
                            <TableHead className="text-right">Calls</TableHead>
                            <TableHead className="text-right">Input Tokens</TableHead>
                            <TableHead className="text-right">Output Tokens</TableHead>
                            <TableHead className="text-right">Est. Cost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userDetailData.aiUsage.byEndpoint.map((usage, idx) => (
                            <TableRow key={idx}>
                              <TableCell>
                                <Badge variant="outline">{usage.endpoint}</Badge>
                              </TableCell>
                              <TableCell className="text-right">{usage.callCount}</TableCell>
                              <TableCell className="text-right">{usage.totalInputTokens.toLocaleString()}</TableCell>
                              <TableCell className="text-right">{usage.totalOutputTokens.toLocaleString()}</TableCell>
                              <TableCell className="text-right">{formatCurrency(usage.totalCostCents)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Enrolled Courses ({userDetailData.enrolledCourses.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {userDetailData.enrolledCourses.length > 0 ? (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {userDetailData.enrolledCourses.map((course, idx) => (
                            <div key={idx} className="flex items-center justify-between border-b pb-2 last:border-0">
                              <div>
                                <p className="font-medium text-sm">{course.courseName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {course.courseType === 'self-study' ? 'Self-study' : 'Professor'} course
                                </p>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(course.enrolledAt)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No enrolled courses</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Owned Courses ({userDetailData.ownedCourses.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {userDetailData.ownedCourses.length > 0 ? (
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {userDetailData.ownedCourses.map((course, idx) => (
                            <div key={idx} className="flex items-center justify-between border-b pb-2 last:border-0">
                              <div>
                                <p className="font-medium text-sm">{course.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {course.courseType === 'self-study' ? 'Self-study' : 'Professor'} course
                                </p>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(course.createdAt)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No owned courses</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {userDetailData.flashcardSets.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Recent Flashcard Sets</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {userDetailData.flashcardSets.slice(0, 10).map((set, idx) => (
                          <div key={idx} className="flex items-center justify-between border-b pb-2 last:border-0">
                            <div>
                              <p className="font-medium text-sm">{set.title}</p>
                              <p className="text-xs text-muted-foreground">{set.courseName || 'Unknown course'}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(set.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {userDetailData.practiceTests.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Recent Practice Tests</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {userDetailData.practiceTests.slice(0, 10).map((test, idx) => (
                          <div key={idx} className="flex items-center justify-between border-b pb-2 last:border-0">
                            <div>
                              <p className="font-medium text-sm">{test.courseName || 'Unknown course'}</p>
                              <p className="text-xs text-muted-foreground">
                                {Array.isArray(test.questions) ? test.questions.length : 0} questions
                              </p>
                            </div>
                            <div className="text-right">
                              {test.completed && test.score !== null ? (
                                <Badge variant={test.score >= 70 ? 'default' : 'destructive'}>
                                  {test.score}%
                                </Badge>
                              ) : (
                                <Badge variant="outline">In progress</Badge>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDate(test.createdAt)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
