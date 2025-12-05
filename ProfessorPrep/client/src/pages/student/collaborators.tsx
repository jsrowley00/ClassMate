import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Users, UserPlus, Mail, Trash2, Send, Clock, Check, X, MessageSquare, ShieldAlert } from "lucide-react";
import type { Course } from "@shared/schema";

type Collaborator = {
  id: string;
  studyRoomId: string;
  invitedEmail: string;
  userId: string | null;
  status: string;
  invitedAt: string;
  acceptedAt: string | null;
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
};

type Owner = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

type CollaboratorsResponse = {
  owner: Owner | null;
  collaborators: Collaborator[];
  pendingInvitations: Collaborator[];
};

type Message = {
  id: string;
  studyRoomId: string;
  senderId: string;
  message: string;
  createdAt: string;
  sender?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
};

export default function Collaborators() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const [inviteEmail, setInviteEmail] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const { data: course, isLoading: courseLoading } = useQuery<Course>({
    queryKey: ["/api/courses", id],
    enabled: !!id,
  });

  const isOwner = course?.ownerId === user?.id;
  const isSelfStudyRoom = course?.courseType === "self-study";

  const { data: collaboratorsData, isLoading: collaboratorsLoading } = useQuery<CollaboratorsResponse>({
    queryKey: ["/api/study-rooms", id, "collaborators"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/study-rooms/${id}/collaborators`);
      return response;
    },
    enabled: !!id && isSelfStudyRoom,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/study-rooms", id, "messages"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/study-rooms/${id}/messages`);
      return response;
    },
    enabled: !!id && isSelfStudyRoom,
  });

  const inviteMutation = useMutation({
    mutationFn: async (email: string) => {
      return await apiRequest("POST", `/api/study-rooms/${id}/collaborators`, { email });
    },
    onSuccess: () => {
      toast({
        title: "Invitation Sent",
        description: `An invitation has been sent to ${inviteEmail}`,
      });
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/study-rooms", id, "collaborators"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    },
  });

  const removeCollaboratorMutation = useMutation({
    mutationFn: async (collaboratorId: string) => {
      return await apiRequest("DELETE", `/api/study-rooms/${id}/collaborators/${collaboratorId}`);
    },
    onSuccess: () => {
      toast({
        title: "Collaborator Removed",
        description: "The collaborator has been removed from this study room",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/study-rooms", id, "collaborators"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove collaborator",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return await apiRequest("POST", `/api/study-rooms/${id}/messages`, { message });
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/study-rooms", id, "messages"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail.trim()) {
      inviteMutation.mutate(inviteEmail.trim());
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      sendMessageMutation.mutate(newMessage.trim());
    }
  };

  const getInitials = (firstName?: string | null, lastName?: string | null, email?: string | null) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return "??";
  };

  const getDisplayName = (collaborator: Collaborator) => {
    if (collaborator.user) {
      const { firstName, lastName, email } = collaborator.user;
      if (firstName && lastName) return `${firstName} ${lastName}`;
      if (firstName) return firstName;
      return email;
    }
    return collaborator.invitedEmail;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "accepted":
        return <Badge variant="default" className="bg-green-600"><Check className="h-3 w-3 mr-1" />Accepted</Badge>;
      case "declined":
        return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Declined</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (courseLoading) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isSelfStudyRoom) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-3 bg-muted rounded-full">
                <ShieldAlert className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Not Available</h2>
                <p className="text-muted-foreground mt-1">
                  Collaboration features are only available for self-study rooms.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roomOwner = collaboratorsData?.owner;
  const acceptedCollaborators = collaboratorsData?.collaborators || [];
  const pendingCollaborators = collaboratorsData?.pendingInvitations || [];

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          Collaborators
        </h1>
        <p className="text-muted-foreground mt-1">
          Invite others to collaborate on this study room
        </p>
      </div>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Collaborator
            </CardTitle>
            <CardDescription>
              Send an invitation email to add someone to your study room
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex gap-2">
              <Input
                type="email"
                placeholder="Enter email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={!inviteEmail.trim() || inviteMutation.isPending}>
                <Mail className="h-4 w-4 mr-2" />
                {inviteMutation.isPending ? "Sending..." : "Send Invite"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Members</CardTitle>
          <CardDescription>
            {acceptedCollaborators.length + 1} member{acceptedCollaborators.length !== 0 ? "s" : ""} in this study room
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {roomOwner && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {getInitials(roomOwner.firstName, roomOwner.lastName, roomOwner.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {roomOwner.firstName && roomOwner.lastName
                        ? `${roomOwner.firstName} ${roomOwner.lastName}`
                        : roomOwner.email}
                      {roomOwner.id === user?.id && " (You)"}
                    </p>
                    <p className="text-sm text-muted-foreground">{roomOwner.email}</p>
                  </div>
                </div>
                <Badge variant="secondary">Owner</Badge>
              </div>
            )}

            {collaboratorsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <>
                {acceptedCollaborators.map((collaborator) => (
                  <div key={collaborator.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {getInitials(
                            collaborator.user?.firstName,
                            collaborator.user?.lastName,
                            collaborator.invitedEmail
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{getDisplayName(collaborator)}</p>
                        <p className="text-sm text-muted-foreground">{collaborator.invitedEmail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(collaborator.status)}
                      {isOwner && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Collaborator</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove {getDisplayName(collaborator)} from this study room? They will no longer have access.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeCollaboratorMutation.mutate(collaborator.id)}>
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {pendingCollaborators.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Invitations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingCollaborators.map((collaborator) => (
                <div key={collaborator.id} className="flex items-center justify-between p-3 rounded-lg border border-dashed">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-muted">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{collaborator.invitedEmail}</p>
                      <p className="text-sm text-muted-foreground">
                        Invited {formatDate(collaborator.invitedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(collaborator.status)}
                    {isOwner && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to cancel the invitation for {collaborator.invitedEmail}?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeCollaboratorMutation.mutate(collaborator.id)}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Study Room Chat
          </CardTitle>
          <CardDescription>
            Discuss and coordinate with your study group
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-64 border rounded-lg p-4">
            {messagesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-3/4" />
                <Skeleton className="h-16 w-3/4 ml-auto" />
                <Skeleton className="h-16 w-3/4" />
              </div>
            ) : messages && messages.length > 0 ? (
              <div className="space-y-4">
                {messages.map((message) => {
                  const isOwnMessage = message.senderId === user?.id;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          isOwnMessage
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {!isOwnMessage && (
                          <p className="text-xs font-medium mb-1">
                            {message.sender?.firstName && message.sender?.lastName
                              ? `${message.sender.firstName} ${message.sender.lastName}`
                              : message.sender?.email}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                        <p className={`text-xs mt-1 ${isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {formatDate(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-muted-foreground text-sm">
                  No messages yet. Start the conversation!
                </p>
              </div>
            )}
          </ScrollArea>

          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Textarea
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 min-h-[60px] max-h-[120px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
            />
            <Button type="submit" disabled={!newMessage.trim() || sendMessageMutation.isPending}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
