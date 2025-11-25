import { useQuery } from "@tanstack/react-query";
import { useAuth as useClerkAuth, useUser as useClerkUser } from "@clerk/clerk-react";
import type { User } from "@shared/schema";

export function useAuth() {
  const { isSignedIn, isLoaded, getToken } = useClerkAuth();
  const { user: clerkUser } = useClerkUser();

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: isSignedIn === true,
    queryFn: async () => {
      const token = await getToken();
      const response = await fetch("/api/auth/user", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch user");
      }
      return response.json();
    },
  });

  const isLoading = !isLoaded || (isSignedIn && userLoading);

  return {
    user,
    clerkUser,
    isLoading,
    isAuthenticated: isSignedIn === true,
    isProfessor: user?.role === "professor",
    isStudent: user?.role === "student",
    getToken,
  };
}
