import { useQuery } from "@tanstack/react-query";
import { useAuth as useClerkAuth, useUser as useClerkUser } from "@clerk/clerk-react";
import type { User } from "@shared/schema";

export function useAuth() {
  const { isSignedIn, isLoaded, getToken } = useClerkAuth();
  const { user: clerkUser } = useClerkUser();

  const { data: user, isLoading: userLoading, isFetched } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: 3,
    retryDelay: 1000,
    enabled: isSignedIn === true,
    staleTime: 30000,
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

  // Loading if Clerk not loaded, or if signed in and query hasn't completed yet
  const isLoading = !isLoaded || (isSignedIn && !isFetched);

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
