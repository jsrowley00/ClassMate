import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ProfessorSidebar, StudentSidebar } from "@/components/app-sidebar";
import { RoleSwitcher } from "@/components/role-switcher";
import { useAuth } from "@/hooks/useAuth";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import RoleSelection from "@/pages/role-selection";

import ProfessorDashboard from "@/pages/professor/dashboard";
import ProfessorCourses from "@/pages/professor/courses";
import CreateCourse from "@/pages/professor/create-course";
import CourseDetail from "@/pages/professor/course-detail";
import ProfessorProfile from "@/pages/professor/profile";

import StudentDashboard from "@/pages/student/dashboard";
import EnrollCourse from "@/pages/student/enroll";
import CourseOverview from "@/pages/student/course-overview";
import CourseMaterials from "@/pages/student/materials";
import PracticeTest from "@/pages/student/practice";
import AITutor from "@/pages/student/tutor";
import GlobalTutor from "@/pages/student/global-tutor";
import Flashcards from "@/pages/student/flashcards";
import FlashcardStudy from "@/pages/student/flashcard-study";
import StudentProfile from "@/pages/student/profile";
import BuildStudyRoom from "@/pages/student/build-study-room";
import { CourseLayout } from "@/components/course-layout";

function Router() {
  const { isAuthenticated, isLoading, isProfessor, isStudent, user } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  if (!user?.role) {
    return <RoleSelection />;
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  if (isProfessor) {
    return (
      <SidebarProvider style={sidebarStyle}>
        <div className="flex h-screen w-full overflow-hidden">
          <ProfessorSidebar />
          <div className="flex flex-col flex-1">
            <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="flex items-center gap-3">
                <RoleSwitcher currentRole="professor" />
                <ThemeToggle />
              </div>
            </header>
            <main className="flex-1 overflow-auto">
              <Switch>
                <Route path="/" component={ProfessorDashboard} />
                <Route path="/professor/courses" component={ProfessorCourses} />
                <Route path="/professor/courses/new" component={CreateCourse} />
                <Route path="/professor/courses/:id" component={CourseDetail} />
                <Route path="/professor/profile" component={ProfessorProfile} />
                <Route component={NotFound} />
              </Switch>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  if (isStudent) {
    return (
      <SidebarProvider style={sidebarStyle}>
        <div className="flex h-screen w-full overflow-hidden">
          <StudentSidebar />
          <div className="flex flex-col flex-1">
            <header className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="flex items-center gap-3">
                <RoleSwitcher currentRole="student" />
                <ThemeToggle />
              </div>
            </header>
            <main className="flex-1 overflow-auto">
              <Switch>
                <Route path="/" component={StudentDashboard} />
                <Route path="/student/profile" component={StudentProfile} />
                <Route path="/global-tutor/:sessionId?" component={GlobalTutor} />
                
                {/* Standalone course pages (no tabs) */}
                <Route path="/student/courses/:id/enroll" component={EnrollCourse} />
                <Route path="/student/courses/:id/flashcards/:setId" component={FlashcardStudy} />
                
                {/* Course pages with left tabs navigation */}
                <Route path="/student/courses/:id">
                  {() => (
                    <CourseLayout>
                      <CourseOverview />
                    </CourseLayout>
                  )}
                </Route>
                <Route path="/student/courses/:id/materials">
                  {() => (
                    <CourseLayout>
                      <CourseMaterials />
                    </CourseLayout>
                  )}
                </Route>
                <Route path="/student/courses/:id/practice">
                  {() => (
                    <CourseLayout>
                      <PracticeTest />
                    </CourseLayout>
                  )}
                </Route>
                <Route path="/student/courses/:id/flashcards">
                  {() => (
                    <CourseLayout>
                      <Flashcards />
                    </CourseLayout>
                  )}
                </Route>
                <Route path="/student/courses/:id/tutor">
                  {() => (
                    <CourseLayout>
                      <AITutor />
                    </CourseLayout>
                  )}
                </Route>
                <Route path="/student/courses/:id/build">
                  {() => (
                    <CourseLayout>
                      <BuildStudyRoom />
                    </CourseLayout>
                  )}
                </Route>
                
                <Route component={NotFound} />
              </Switch>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return <NotFound />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
