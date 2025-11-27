import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { GraduationCap, BookOpen } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const DEMO_ACCOUNT_IDS = ["49754447"];
const ADMIN_EMAILS = ["jsrowley00@gmail.com"];

interface RoleSwitcherProps {
  currentRole: "professor" | "student";
  userId?: string;
  email?: string | null;
  hasProfessorAccess?: boolean | null;
  subscriptionStatus?: string | null;
}

export function RoleSwitcher({ 
  currentRole, 
  userId, 
  email,
  hasProfessorAccess,
  subscriptionStatus 
}: RoleSwitcherProps) {
  const { toast } = useToast();
  const newRole = currentRole === "professor" ? "student" : "professor";

  const switchRoleMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/set-role", { role: newRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Role Switched",
        description: `Switched to ${newRole === "professor" ? "Professor" : "Student"} view`,
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to switch role",
        variant: "destructive",
      });
    },
  });

  // Determine if user can switch roles
  const isDemoAccount = userId && DEMO_ACCOUNT_IDS.includes(userId);
  const isAdminEmail = email && ADMIN_EMAILS.includes(email);
  const hasActiveSubscription = subscriptionStatus === 'active';
  
  // Professor can switch to student if they have an active subscription
  const professorCanSwitchToStudent = currentRole === "professor" && hasActiveSubscription;
  // Student can switch to professor if they have professor access
  const studentCanSwitchToProfessor = currentRole === "student" && hasProfessorAccess;
  
  const canSwitch = isDemoAccount || isAdminEmail || professorCanSwitchToStudent || studentCanSwitchToProfessor;

  if (!canSwitch) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => switchRoleMutation.mutate()}
      disabled={switchRoleMutation.isPending}
      data-testid="button-switch-role"
      className="gap-2"
    >
      {newRole === "professor" ? (
        <>
          <BookOpen className="h-4 w-4" />
          <span>Switch to Professor</span>
        </>
      ) : (
        <>
          <GraduationCap className="h-4 w-4" />
          <span>Switch to Student</span>
        </>
      )}
    </Button>
  );
}
