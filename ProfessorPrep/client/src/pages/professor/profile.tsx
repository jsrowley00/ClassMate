import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, User, Calendar, GraduationCap, CreditCard, Check, Loader2 } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface StripeProduct {
  id: string;
  name: string;
  description: string;
  metadata?: { duration_months?: string };
  prices: Array<{
    id: string;
    unit_amount: number;
    currency: string;
  }>;
}

export default function ProfessorProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showStudentPlans, setShowStudentPlans] = useState(false);

  const { data: productsData } = useQuery({
    queryKey: ["/api/stripe/products"],
    queryFn: async () => {
      const response = await fetch("/api/stripe/products");
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  const products: StripeProduct[] = productsData?.products || [];
  
  const fourMonthProduct = products.find(p => 
    p.name?.toLowerCase().includes("4 month") || 
    p.metadata?.duration_months === "4"
  );
  const twelveMonthProduct = products.find(p => 
    p.name?.toLowerCase().includes("12 month") || 
    p.metadata?.duration_months === "12"
  );
  
  const fourMonthPrice = fourMonthProduct?.prices?.[0];
  const twelveMonthPrice = twelveMonthProduct?.prices?.[0];

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

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  if (!user) {
    return null;
  }

  const initials = user.firstName && user.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user.email?.[0]?.toUpperCase() || "P";

  const displayName = user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.email;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">My Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your ClassMate account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar and Basic Info */}
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={user.profileImageUrl || undefined} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-1">{displayName}</h2>
              <Badge variant="secondary" className="mb-2">Professor</Badge>
            </div>
          </div>

          {/* Detailed Information */}
          <div className="space-y-4 pt-6 border-t">
            {user.firstName && user.lastName && (
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                  <p className="text-base" data-testid="text-full-name">
                    {user.firstName} {user.lastName}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Email Address</p>
                <p className="text-base" data-testid="text-email">{user.email}</p>
              </div>
            </div>

            {user.createdAt && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Member Since</p>
                  <p className="text-base" data-testid="text-member-since">
                    {new Date(user.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className="h-5 w-5 flex items-center justify-center text-muted-foreground mt-0.5">
                <span className="text-sm font-bold">ID</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">User ID</p>
                <p className="text-base font-mono text-xs" data-testid="text-user-id">{user.id}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student Access Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Student Access
          </CardTitle>
          <CardDescription>
            Want to use ClassMate as a student too? Subscribe to access AI study tools for your own learning.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showStudentPlans ? (
            <Button onClick={() => setShowStudentPlans(true)}>
              <CreditCard className="h-4 w-4 mr-2" />
              Subscribe as a Student
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="border-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>4-Month Access</span>
                      <span className="text-primary">$10/mo</span>
                    </CardTitle>
                    <CardDescription>
                      {fourMonthPrice ? formatPrice(fourMonthPrice.unit_amount, fourMonthPrice.currency) : '$40'} billed every 4 months
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 mb-4 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        AI practice tests
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Smart flashcards
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Personal AI tutor
                      </li>
                    </ul>
                    <Button
                      className="w-full"
                      onClick={() => fourMonthPrice && createCheckoutMutation.mutate(fourMonthPrice.id)}
                      disabled={createCheckoutMutation.isPending || !fourMonthPrice}
                    >
                      {createCheckoutMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Get 4-Month Access"
                      )}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-2 border-primary relative">
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-2 py-0.5 rounded text-xs font-medium">
                    Best Value
                  </div>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>12-Month Access</span>
                      <span className="text-primary">$7.50/mo</span>
                    </CardTitle>
                    <CardDescription>
                      {twelveMonthPrice ? formatPrice(twelveMonthPrice.unit_amount, twelveMonthPrice.currency) : '$90'} billed once per year
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 mb-4 text-sm">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        AI practice tests
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Smart flashcards
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Personal AI tutor
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        <span className="text-primary font-medium">Save 25%</span>
                      </li>
                    </ul>
                    <Button
                      className="w-full"
                      onClick={() => twelveMonthPrice && createCheckoutMutation.mutate(twelveMonthPrice.id)}
                      disabled={createCheckoutMutation.isPending || !twelveMonthPrice}
                    >
                      {createCheckoutMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Get 12-Month Access"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </div>
              <Button variant="ghost" onClick={() => setShowStudentPlans(false)}>
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
