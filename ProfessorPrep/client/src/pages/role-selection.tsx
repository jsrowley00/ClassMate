import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, BookOpen, CreditCard, Check, Loader2 } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";

interface StripeProduct {
  id: string;
  name: string;
  description: string;
  prices: Array<{
    id: string;
    unit_amount: number;
    currency: string;
    recurring: { interval: string } | null;
  }>;
}

export default function RoleSelection() {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<"professor" | "student" | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["/api/stripe/products"],
    queryFn: async () => {
      const response = await fetch("/api/stripe/products");
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  const products: StripeProduct[] = productsData?.products || [];
  const studentAccess = products.find(p => 
    p.name?.toLowerCase().includes("student") || 
    (p as any).metadata?.type === "student_access" ||
    (p as any).metadata?.type === "student_subscription"
  );
  const oneTimePrice = studentAccess?.prices?.find(p => 
    !p.recurring
  ) || studentAccess?.prices?.[0];

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

  const createCheckoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const data = await apiRequest("POST", "/api/stripe/create-checkout-session", { priceId });
      return data;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout",
        variant: "destructive",
      });
    },
  });

  const handleProfessorSelect = () => {
    setSelectedRole("professor");
    setRoleMutation.mutate("professor");
  };

  const handleStudentSelect = () => {
    setSelectedRole("student");
    setShowPayment(true);
  };

  const handleStartPayment = () => {
    if (oneTimePrice) {
      createCheckoutMutation.mutate(oneTimePrice.id);
    }
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  if (showPayment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <GraduationCap className="h-10 w-10 text-primary" />
              <span className="text-3xl font-bold">ClassMate</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Get Student Access</h1>
            <p className="text-muted-foreground">
              $10/month, billed in 4-month increments
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>4-Month Student Access</span>
                {oneTimePrice && (
                  <span className="text-primary text-2xl font-bold">
                    $10/mo
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Billed as {oneTimePrice ? formatPrice(oneTimePrice.unit_amount, oneTimePrice.currency) : '$40'} every 4 months
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 mb-6">
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>AI-generated practice tests</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Smart flashcard creation</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Personal AI tutor for every course</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Unlimited self-study rooms</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Access to all classes added during your period</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Progress tracking & mastery analytics</span>
                </li>
              </ul>

              <Button
                className="w-full"
                size="lg"
                onClick={handleStartPayment}
                disabled={createCheckoutMutation.isPending || !oneTimePrice}
              >
                {createCheckoutMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redirecting to checkout...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Get Access - $10/month
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                className="w-full mt-3"
                onClick={() => {
                  setShowPayment(false);
                  setSelectedRole(null);
                }}
              >
                Back to role selection
              </Button>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Secure payment powered by Stripe. Billed every 4 months.
          </p>
        </div>
      </div>
    );
  }

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
            onClick={handleProfessorSelect}
          >
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">I'm a Professor</CardTitle>
              <CardDescription className="text-base">
                Create and manage courses for your students
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
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
            onClick={handleStudentSelect}
          >
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">I'm a Student</CardTitle>
              <CardDescription className="text-base">
                Enroll in courses or build your own study rooms to access AI study tools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
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
