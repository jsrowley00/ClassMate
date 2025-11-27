import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, BookOpen, CreditCard, Check, Loader2, Upload, Users, BarChart3, FolderTree, Sparkles, ArrowRight } from "lucide-react";
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
  const [showProfessorFeatures, setShowProfessorFeatures] = useState(false);

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["/api/stripe/products"],
    queryFn: async () => {
      const response = await fetch("/api/stripe/products");
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  const products: StripeProduct[] = productsData?.products || [];
  
  // Find both 4-month and 12-month products
  const fourMonthProduct = products.find(p => 
    p.name?.toLowerCase().includes("4 month") || 
    (p as any).metadata?.duration_months === "4"
  );
  const twelveMonthProduct = products.find(p => 
    p.name?.toLowerCase().includes("12 month") || 
    (p as any).metadata?.duration_months === "12"
  );
  
  // Fallback to generic student access product
  const fallbackProduct = products.find(p => 
    p.name?.toLowerCase().includes("student") || 
    (p as any).metadata?.type === "student_access"
  );
  
  const fourMonthPrice = fourMonthProduct?.prices?.[0] || fallbackProduct?.prices?.[0];
  const twelveMonthPrice = twelveMonthProduct?.prices?.[0];

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
          window.location.href = "/sign-in";
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
    setShowProfessorFeatures(true);
  };

  const handleProfessorContinue = () => {
    setRoleMutation.mutate("professor");
  };

  const handleStudentSelect = () => {
    setSelectedRole("student");
    setShowPayment(true);
  };

  const handleStartPayment = (priceId: string) => {
    if (priceId) {
      createCheckoutMutation.mutate(priceId);
    }
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  if (showProfessorFeatures) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <BookOpen className="h-10 w-10 text-primary" />
              <span className="text-3xl font-bold">ClassMate</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Welcome, Professor!</h1>
            <p className="text-muted-foreground">
              Effortlessly turn your course materials into AI-powered study tools for your students.
            </p>
          </div>

          <Card className="mb-8">
            <CardHeader className="text-center pb-2">
              <div className="inline-flex items-center justify-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-4 py-2 rounded-full mx-auto mb-4">
                <Check className="h-5 w-5" />
                <span className="font-semibold">Always Free for Professors</span>
              </div>
              <CardTitle className="text-xl">Everything You Need to Empower Your Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6 mt-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FolderTree className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Organize Course Materials</h3>
                    <p className="text-sm text-muted-foreground">
                      Create courses with flexible modules and sub-modules. Structure your content exactly how you teach it.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Upload Any Material</h3>
                    <p className="text-sm text-muted-foreground">
                      PDFs, Word docs, PowerPoints, images - upload your existing materials and let AI do the rest.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">AI-Generated Learning Objectives</h3>
                    <p className="text-sm text-muted-foreground">
                      Automatically generate SMART learning objectives from your materials to guide student learning.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Easy Student Enrollment</h3>
                    <p className="text-sm text-muted-foreground">
                      Share a simple course code and students can join instantly. No complicated setup required.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Student Progress Analytics</h3>
                    <p className="text-sm text-muted-foreground">
                      See which concepts students are struggling with and where they're excelling.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <GraduationCap className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">AI Study Tools for Students</h3>
                    <p className="text-sm text-muted-foreground">
                      Your students get AI practice tests, flashcards, and a personal tutor - all based on your materials.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center space-y-4">
            <Button
              size="lg"
              className="px-8"
              onClick={handleProfessorContinue}
              disabled={setRoleMutation.isPending}
            >
              {setRoleMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up your account...
                </>
              ) : (
                <>
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
            <div>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowProfessorFeatures(false);
                  setSelectedRole(null);
                }}
              >
                Back to role selection
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showPayment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <GraduationCap className="h-10 w-10 text-primary" />
              <span className="text-3xl font-bold">ClassMate</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Get Student Access</h1>
            <p className="text-muted-foreground">
              Choose the plan that works best for you
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>4-Month Access</span>
                  <span className="text-primary text-2xl font-bold">
                    $10/mo
                  </span>
                </CardTitle>
                <CardDescription>
                  Billed as {fourMonthPrice ? formatPrice(fourMonthPrice.unit_amount, fourMonthPrice.currency) : '$40'} every 4 months
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-3 mb-6 flex-1">
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
                    <span>Progress tracking & analytics</span>
                  </li>
                </ul>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => fourMonthPrice && handleStartPayment(fourMonthPrice.id)}
                  disabled={createCheckoutMutation.isPending || !fourMonthPrice}
                >
                  {createCheckoutMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Get 4-Month Access
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-primary ring-2 ring-primary relative flex flex-col">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm font-medium">
                Best Value
              </div>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>12-Month Access</span>
                  <span className="text-primary text-2xl font-bold">
                    $7.50/mo
                  </span>
                </CardTitle>
                <CardDescription>
                  Billed as {twelveMonthPrice ? formatPrice(twelveMonthPrice.unit_amount, twelveMonthPrice.currency) : '$90'} once per year
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-3 mb-6 flex-1">
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
                    <span>Progress tracking & analytics</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary font-medium" />
                    <span className="text-primary font-medium">Save 25% vs monthly</span>
                  </li>
                </ul>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => twelveMonthPrice && handleStartPayment(twelveMonthPrice.id)}
                  disabled={createCheckoutMutation.isPending || !twelveMonthPrice}
                >
                  {createCheckoutMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redirecting...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Get 12-Month Access
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <Button
              variant="ghost"
              onClick={() => {
                setShowPayment(false);
                setSelectedRole(null);
              }}
            >
              Back to role selection
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              Secure payment powered by Stripe
            </p>
          </div>
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
            className={`cursor-pointer transition-all hover-elevate flex flex-col ${
              selectedRole === "professor" ? "border-primary ring-2 ring-primary" : ""
            }`}
            onClick={handleProfessorSelect}
          >
            <CardHeader className="text-center flex-1">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">I'm a Professor</CardTitle>
              <CardDescription className="text-base">
                Create and manage courses for your students
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
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
            className={`cursor-pointer transition-all hover-elevate flex flex-col ${
              selectedRole === "student" ? "border-primary ring-2 ring-primary" : ""
            }`}
            onClick={handleStudentSelect}
          >
            <CardHeader className="text-center flex-1">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">I'm a Student</CardTitle>
              <CardDescription className="text-base">
                Enroll in courses or build your own study rooms to access AI study tools
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
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
