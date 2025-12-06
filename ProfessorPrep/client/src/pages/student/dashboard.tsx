import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowRight, FileText, Brain, Layers, MessageCircle, Plus, Home, Mail, Check, X, Users } from "lucide-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { OnboardingTutorial } from "@/components/onboarding-tutorial";
import { apiRequest } from "@/lib/queryClient";
import type { Course, User } from "@shared/schema";

interface StudyRoomInvitation {
  id: string;
  courseId: string;
  course: Course;
  inviter: User | null;
  createdAt: string;
  type: 'email' | 'collaborator';
}

export default function StudentDashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);

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

  useEffect(() => {
    if (user && user.hasSeenStudentOnboarding === false) {
      setShowOnboarding(true);
    }
  }, [user]);

  useEffect(() => {
    const handleShowOnboarding = () => setShowOnboarding(true);
    window.addEventListener('show-onboarding', handleShowOnboarding);
    return () => window.removeEventListener('show-onboarding', handleShowOnboarding);
  }, []);

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    try {
      await apiRequest("POST", "/api/auth/complete-onboarding", { role: "student" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch (error) {
      console.error("Error completing onboarding:", error);
    }
  };

  const { data: enrolledCourses, isLoading: enrolledLoading } = useQuery<Course[]>({
    queryKey: ["/api/student/enrolled-courses"],
    enabled: isAuthenticated,
  });

  const { data: selfStudyRooms, isLoading: roomsLoading } = useQuery<Course[]>({
    queryKey: ["/api/student/self-study-rooms"],
    enabled: isAuthenticated,
  });

  const { data: pendingInvitations, isLoading: invitationsLoading } = useQuery<StudyRoomInvitation[]>({
    queryKey: ["/api/study-room-invitations"],
    enabled: isAuthenticated,
  });

  const respondToInvitationMutation = useMutation({
    mutationFn: async ({ invitationId, action }: { invitationId: string; action: 'accept' | 'decline' }) => {
      const res = await fetch(`/api/study-room-invitations/${invitationId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to respond to invitation");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/study-room-invitations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/student/self-study-rooms"] });
      toast({
        title: variables.action === 'accept' ? "Invitation accepted!" : "Invitation declined",
        description: variables.action === 'accept' 
          ? "You now have access to the study room." 
          : "The invitation has been declined.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createRoomMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const res = await fetch("/api/student/self-study-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create study room");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/student/self-study-rooms"] });
      setIsCreatingRoom(false);
      setNewRoomName("");
      setNewRoomDescription("");
      toast({
        title: "Study room created!",
        description: "Your new self-study room is ready.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (authLoading || !isAuthenticated) {
    return null;
  }

  const renderCourseCard = (course: Course) => (
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
  );

  return (
    <>
      <OnboardingTutorial
        role="student"
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={handleOnboardingComplete}
      />
      
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Courses</h1>
          <p className="text-muted-foreground">
            Courses your professors have added you to
          </p>
        </div>
      {enrolledLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
          {enrolledCourses.map((course) => renderCourseCard(course))}
        </div>
      ) : (
        <Card className="mb-12">
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
            <p className="text-muted-foreground">
              Your professors will add you to courses when they're ready
            </p>
          </CardContent>
        </Card>
      )}

      {/* Self-Study Rooms Section */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">My Self-Study Rooms</h2>
          <p className="text-muted-foreground">
            Create your own study spaces for classes you're taking
          </p>
        </div>
        <Dialog open={isCreatingRoom} onOpenChange={setIsCreatingRoom}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Study Room
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Self-Study Room</DialogTitle>
              <DialogDescription>
                Create a private study space where you can upload your own materials and access all study tools.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="room-name">Room Name *</Label>
                <Input
                  id="room-name"
                  placeholder="e.g., Biology 101, Spanish Class"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="room-description">Description (optional)</Label>
                <Textarea
                  id="room-description"
                  placeholder="Add notes about this study room..."
                  value={newRoomDescription}
                  onChange={(e) => setNewRoomDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreatingRoom(false);
                  setNewRoomName("");
                  setNewRoomDescription("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (newRoomName.trim()) {
                    createRoomMutation.mutate({
                      name: newRoomName,
                      description: newRoomDescription,
                    });
                  }
                }}
                disabled={!newRoomName.trim() || createRoomMutation.isPending}
              >
                {createRoomMutation.isPending ? "Creating..." : "Create Room"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Study Room Invitations */}
      {!invitationsLoading && pendingInvitations && pendingInvitations.length > 0 && (
        <div className="mb-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pendingInvitations.map((invitation) => {
              const inviterName = invitation.inviter?.firstName && invitation.inviter?.lastName
                ? `${invitation.inviter.firstName} ${invitation.inviter.lastName}`
                : invitation.inviter?.email || "Someone";
              
              return (
                <Card key={invitation.id} className="border-primary/50 bg-primary/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Mail className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-primary">Study Room Invitation</span>
                    </div>
                    <CardTitle className="text-lg">{invitation.course?.name || "Study Room"}</CardTitle>
                    <CardDescription>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Invited by {inviterName}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => respondToInvitationMutation.mutate({ 
                          invitationId: invitation.id, 
                          action: 'accept' 
                        })}
                        disabled={respondToInvitationMutation.isPending}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => respondToInvitationMutation.mutate({ 
                          invitationId: invitation.id, 
                          action: 'decline' 
                        })}
                        disabled={respondToInvitationMutation.isPending}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {roomsLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2].map((i) => (
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
      ) : selfStudyRooms && selfStudyRooms.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {selfStudyRooms.map((room) => renderCourseCard(room))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Home className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No study rooms yet</h3>
            <p className="text-muted-foreground mb-4">
              Create a self-study room to upload your own materials and access AI-powered study tools
            </p>
            <Button onClick={() => setIsCreatingRoom(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Study Room
            </Button>
          </CardContent>
        </Card>
      )}
      </div>
    </>
  );
}
