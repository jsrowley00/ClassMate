import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { GraduationCap, BookOpen } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const DEMO_ACCOUNT_IDS = ["49754447"];

interface RoleSwitcherProps {
  currentRole: "professor" | "student";
  userId?: string;
}

export function RoleSwitcher({ currentRole, userId }: RoleSwitcherProps) {
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

  if (!userId || !DEMO_ACCOUNT_IDS.includes(userId)) {
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
