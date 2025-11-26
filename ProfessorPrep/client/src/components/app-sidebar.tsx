import { BookOpen, Home, Upload, LogOut, GraduationCap, Sparkles, ChevronDown, MessageSquarePlus, MessageSquare, Bot, FolderOpen } from "lucide-react";
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
import { useClerk } from "@clerk/clerk-react";
import type { Course } from "@shared/schema";

export function ProfessorSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { signOut } = useClerk();

  const handleSignOut = () => {
    signOut({ redirectUrl: "/" });
  };

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
        <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut} data-testid="button-logout">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export function StudentSidebar() {
  const [location] = useLocation();
  const { user, isAuthenticated, isStudent } = useAuth();
  const { signOut } = useClerk();

  const handleSignOut = () => {
    signOut({ redirectUrl: "/" });
  };

  // Only fetch data if user is authenticated AND has student role
  const shouldFetch = isAuthenticated && isStudent;

  // Fetch enrolled courses (all courses student has access to)
  const { data: allCourses = [] } = useQuery<Course[]>({
    queryKey: ["/api/student/enrolled-courses"],
    enabled: shouldFetch,
  });

  // Fetch self-study rooms
  const { data: selfStudyRoomsData = [] } = useQuery<Course[]>({
    queryKey: ["/api/student/self-study-rooms"],
    enabled: shouldFetch,
  });

  // Filter to only professor-led courses (exclude self-study rooms)
  const enrolledCourses = allCourses.filter(c => c.courseType === "professor");
  
  // Use self-study rooms from the dedicated endpoint
  const selfStudyRooms = selfStudyRoomsData;

  // Fetch all global chat sessions
  const { data: globalSessions = [] } = useQuery<Array<{ id: string; title: string; updatedAt: Date }>>({
    queryKey: ["/api/global-tutor/sessions"],
    enabled: shouldFetch,
  });

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.email?.[0]?.toUpperCase() || "S";

  // Check if we're on various pages to control which sections are expanded
  const isOnGlobalTutor = location.startsWith("/global-tutor");
  const isOnClassTutor = location.includes("/courses/") && location.endsWith("/tutor") && 
    enrolledCourses.some(c => location.includes(c.id));
  const isOnStudyRoomTutor = location.includes("/courses/") && location.endsWith("/tutor") && 
    selfStudyRooms.some(r => location.includes(r.id));
  const isOnClassPage = enrolledCourses.some(c => location.includes(`/courses/${c.id}`));
  const isOnStudyRoomPage = selfStudyRooms.some(r => location.includes(`/courses/${r.id}`));

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
              {/* Dashboard */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-active={location === "/"}>
                  <Link href="/">
                    <Home />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* My Classes - Professor-led courses with AI tutors */}
              <Collapsible defaultOpen={isOnClassPage || isOnClassTutor || enrolledCourses.length > 0} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton data-active={isOnClassPage}>
                      <BookOpen />
                      <span>My Classes</span>
                      <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {enrolledCourses.length === 0 ? (
                        <SidebarMenuSubItem>
                          <span className="text-xs text-muted-foreground px-2 py-1">No classes yet</span>
                        </SidebarMenuSubItem>
                      ) : (
                        enrolledCourses.map((course) => (
                          <SidebarMenuSubItem key={course.id}>
                            <SidebarMenuSubButton asChild data-active={location.includes(`/courses/${course.id}`)}>
                              <Link href={`/student/courses/${course.id}`}>
                                <BookOpen className="h-4 w-4" />
                                <span className="truncate">{course.name}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))
                      )}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Study Rooms - Self-study rooms with AI tutors */}
              <Collapsible defaultOpen={isOnStudyRoomPage || isOnStudyRoomTutor || selfStudyRooms.length > 0} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton data-active={isOnStudyRoomPage}>
                      <FolderOpen />
                      <span>Study Rooms</span>
                      <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {selfStudyRooms.length === 0 ? (
                        <SidebarMenuSubItem>
                          <span className="text-xs text-muted-foreground px-2 py-1">No study rooms yet</span>
                        </SidebarMenuSubItem>
                      ) : (
                        selfStudyRooms.map((room) => (
                          <SidebarMenuSubItem key={room.id}>
                            <SidebarMenuSubButton asChild data-active={location.includes(`/courses/${room.id}`)}>
                              <Link href={`/student/courses/${room.id}`}>
                                <FolderOpen className="h-4 w-4" />
                                <span className="truncate">{room.name}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))
                      )}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Study Assistant - All AI tutors and global chats */}
              <Collapsible defaultOpen={isOnGlobalTutor || isOnClassTutor || isOnStudyRoomTutor} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton data-active={isOnGlobalTutor || isOnClassTutor || isOnStudyRoomTutor}>
                      <Sparkles />
                      <span>Study Assistant</span>
                      <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {/* Class AI Tutors - pinned under course name */}
                      {enrolledCourses.map((course) => (
                        <SidebarMenuSubItem key={`tutor-${course.id}`}>
                          <SidebarMenuSubButton asChild data-active={location === `/student/courses/${course.id}/tutor`}>
                            <Link href={`/student/courses/${course.id}/tutor`}>
                              <Bot className="h-4 w-4" />
                              <span className="truncate">{course.name}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}

                      {/* Separator between classes and study rooms */}
                      {enrolledCourses.length > 0 && selfStudyRooms.length > 0 && (
                        <div className="my-2 border-t" />
                      )}

                      {/* Study Room AI Tutors - pinned under room name */}
                      {selfStudyRooms.map((room) => (
                        <SidebarMenuSubItem key={`tutor-${room.id}`}>
                          <SidebarMenuSubButton asChild data-active={location === `/student/courses/${room.id}/tutor`}>
                            <Link href={`/student/courses/${room.id}/tutor`}>
                              <Bot className="h-4 w-4" />
                              <span className="truncate">{room.name}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}

                      {/* Separator before global chats */}
                      {(enrolledCourses.length > 0 || selfStudyRooms.length > 0) && (
                        <div className="my-2 border-t" />
                      )}

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
        <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut} data-testid="button-logout">
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
