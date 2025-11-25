import { BookOpen, Home, Upload, LogOut, GraduationCap, Sparkles, ChevronDown, MessageSquarePlus, MessageSquare, Bot } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import type { Course } from "@shared/schema";

export function ProfessorSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const menuItems = [
    {
      title: "Dashboard",
      url: "/",
      icon: Home,
    },
    {
      title: "My Courses",
      url: "/professor/courses",
      icon: BookOpen,
    },
  ];

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.email?.[0]?.toUpperCase() || "P";

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">ClassMate</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Professor Portal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild data-active={location === item.url}>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t">
        <Link href="/professor/profile" className="block mb-3 hover-elevate rounded-md p-2 -mx-2" data-testid="link-profile">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email}
              </p>
              <p className="text-xs text-muted-foreground">Professor</p>
            </div>
          </div>
        </Link>
        <Button variant="outline" size="sm" asChild data-testid="button-logout">
          <a href="/api/logout" className="w-full">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </a>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export function StudentSidebar() {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();

  // Fetch enrolled courses for the Study Assistant submenu
  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["/api/student/enrolled-courses"],
    enabled: isAuthenticated,
  });

  // Fetch all global chat sessions
  const { data: globalSessions = [] } = useQuery<Array<{ id: string; title: string; updatedAt: Date }>>({
    queryKey: ["/api/global-tutor/sessions"],
    enabled: isAuthenticated,
  });

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.email?.[0]?.toUpperCase() || "S";

  // Check if we're on any global-tutor or course tutor page
  const isOnStudyAssistant = location.startsWith("/global-tutor") || (location.includes("/courses/") && location.endsWith("/tutor"));

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">ClassMate</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Student Portal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* My Courses */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-active={location === "/"}>
                  <Link href="/">
                    <BookOpen />
                    <span>My Courses</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Study Assistant with collapsible submenu */}
              <Collapsible defaultOpen={isOnStudyAssistant} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton data-active={isOnStudyAssistant}>
                      <Sparkles />
                      <span>Study Assistant</span>
                      <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {/* New Chat option */}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild>
                          <Link href="/global-tutor">
                            <MessageSquarePlus className="h-4 w-4" />
                            <span>New Chat</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>

                      {/* Existing global chat sessions */}
                      {globalSessions.map((session) => (
                        <SidebarMenuSubItem key={session.id}>
                          <SidebarMenuSubButton asChild data-active={location === `/global-tutor/${session.id}`}>
                            <Link href={`/global-tutor/${session.id}`}>
                              <MessageSquare className="h-4 w-4" />
                              <span className="truncate">{session.title || "Untitled Chat"}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}

                      {/* Separator if there are both global sessions and courses */}
                      {globalSessions.length > 0 && courses.length > 0 && (
                        <div className="my-2 border-t" />
                      )}

                      {/* Course-specific tutors */}
                      {courses.map((course) => (
                        <SidebarMenuSubItem key={course.id}>
                          <SidebarMenuSubButton asChild>
                            <Link href={`/student/courses/${course.id}/tutor`}>
                              <Bot className="h-4 w-4" />
                              <span className="truncate">{course.name}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t">
        <Link href="/student/profile" className="block mb-3 hover-elevate rounded-md p-2 -mx-2" data-testid="link-profile">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.email}
              </p>
              <p className="text-xs text-muted-foreground">Student</p>
            </div>
          </div>
        </Link>
        <Button variant="outline" size="sm" asChild data-testid="button-logout">
          <a href="/api/logout" className="w-full">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </a>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
