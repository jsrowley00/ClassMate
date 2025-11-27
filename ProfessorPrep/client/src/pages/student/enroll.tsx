import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Course } from "@shared/schema";

export default function EnrollCourse() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/sign-in";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: course, isLoading: courseLoading } = useQuery<Course>({
    queryKey: ["/api/courses", id],
    enabled: isAuthenticated && !!id,
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/courses/${id}/enroll`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "You have successfully enrolled in this course",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/student/enrolled-courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses/available"] });
      setLocation("/");
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/sign-in";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to enroll in course",
        variant: "destructive",
      });
    },
  });

  if (authLoading || !isAuthenticated) {
    return null;
  }

  if (courseLoading) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48 mb-8" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <p>Course not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-6" data-testid="button-back">
        <Link href="/">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Courses
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <CardTitle className="text-2xl">{course.name}</CardTitle>
          </div>
          <CardDescription className="text-base">
            {course.description || "No description available"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">What you'll get:</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Access to all course study materials uploaded by your professor</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>
                  AI-powered practice tests with multiple question types to test your knowledge
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>
                  Personalized AI tutor to answer your questions based on course materials
                </span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Track your progress and performance over time</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => enrollMutation.mutate()}
              disabled={enrollMutation.isPending}
              data-testid="button-confirm-enroll"
            >
              {enrollMutation.isPending ? "Enrolling..." : "Enroll in Course"}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Cancel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
