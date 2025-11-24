import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, BookOpen } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function RoleSelection() {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<"professor" | "student" | null>(null);

  const setRoleMutation = useMutation({
    mutationFn: async (role: "professor" | "student") => {
      return await apiRequest("POST", "/api/auth/set-role", { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.location.reload();
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to set role",
        variant: "destructive",
      });
    },
  });

  const handleRoleSelect = (role: "professor" | "student") => {
    setSelectedRole(role);
    setRoleMutation.mutate(role);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <GraduationCap className="h-12 w-12 text-primary" />
            <span className="text-4xl font-bold">ClassMate</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome! Choose Your Role</h1>
          <p className="text-muted-foreground">
            Select how you'll be using ClassMate
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card
            className={`cursor-pointer transition-all hover-elevate ${
              selectedRole === "professor" ? "border-primary ring-2 ring-primary" : ""
            }`}
            onClick={() => handleRoleSelect("professor")}
          >
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">I'm a Professor</CardTitle>
              <CardDescription className="text-base">
                Create courses and upload study materials for students
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Create and manage multiple courses</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Upload PDFs, Word docs, and images</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Provide AI-powered study resources</span>
                </li>
              </ul>
              <Button
                className="w-full mt-6"
                disabled={setRoleMutation.isPending}
                data-testid="button-select-professor"
              >
                {setRoleMutation.isPending && selectedRole === "professor"
                  ? "Setting up..."
                  : "Continue as Professor"}
              </Button>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover-elevate ${
              selectedRole === "student" ? "border-primary ring-2 ring-primary" : ""
            }`}
            onClick={() => handleRoleSelect("student")}
          >
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">I'm a Student</CardTitle>
              <CardDescription className="text-base">
                Enroll in courses and ace your tests with AI help
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Access course study materials</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Take AI-generated practice tests</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Chat with AI tutor for help</span>
                </li>
              </ul>
              <Button
                className="w-full mt-6"
                disabled={setRoleMutation.isPending}
                data-testid="button-select-student"
              >
                {setRoleMutation.isPending && selectedRole === "student"
                  ? "Setting up..."
                  : "Continue as Student"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
