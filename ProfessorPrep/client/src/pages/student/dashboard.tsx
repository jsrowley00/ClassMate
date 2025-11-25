import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowRight, FileText, Brain, Layers, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import type { Course } from "@shared/schema";

export default function StudentDashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: enrolledCourses, isLoading: enrolledLoading } = useQuery<Course[]>({
    queryKey: ["/api/student/enrolled-courses"],
    enabled: isAuthenticated,
  });

  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Courses</h1>
        <p className="text-muted-foreground">
          Access your courses and start studying
        </p>
      </div>
        {enrolledLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full mb-2" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : enrolledCourses && enrolledCourses.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {enrolledCourses.map((course) => (
              <Card key={course.id} className="hover-elevate">
                <CardHeader>
                  <CardTitle className="text-lg">{course.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {course.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="default"
                    asChild
                    className="w-full"
                    data-testid={`button-view-course-${course.id}`}
                  >
                    <Link href={`/student/courses/${course.id}`}>
                      <BookOpen className="h-4 w-4 mr-2" />
                      View Course
                      <ArrowRight className="h-4 w-4 ml-auto" />
                    </Link>
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      data-testid={`button-materials-${course.id}`}
                    >
                      <Link href={`/student/courses/${course.id}/materials`}>
                        <FileText className="h-4 w-4 mr-1" />
                        Materials
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      data-testid={`button-practice-${course.id}`}
                    >
                      <Link href={`/student/courses/${course.id}/practice`}>
                        <Brain className="h-4 w-4 mr-1" />
                        Practice
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      data-testid={`button-flashcards-${course.id}`}
                    >
                      <Link href={`/student/courses/${course.id}/flashcards`}>
                        <Layers className="h-4 w-4 mr-1" />
                        Flashcards
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      data-testid={`button-tutor-${course.id}`}
                    >
                      <Link href={`/student/courses/${course.id}/tutor`}>
                        <MessageCircle className="h-4 w-4 mr-1" />
                        AI Tutor
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
              <p className="text-muted-foreground">
                Your professors will add you to courses when they're ready
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
