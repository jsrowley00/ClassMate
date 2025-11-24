import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, Bot, User, CheckCircle2 } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Course, ChatMessage } from "@shared/schema";

export default function AITutor() {
  const { id } = useParams<{ id: string }>();
  const [location] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [message, setMessage] = useState("");
  const [hasInitialized, setHasInitialized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: course, isLoading: courseLoading } = useQuery<Course>({
    queryKey: ["/api/courses", id],
    enabled: isAuthenticated && !!id,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/courses", id, "chat"],
    enabled: isAuthenticated && !!id,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest("POST", `/api/courses/${id}/chat`, { message: content });
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/courses", id, "chat"] });
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
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (message.trim()) {
      sendMessageMutation.mutate(message.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-scroll to bottom when messages change or when first loaded
  useLayoutEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "auto", block: "end" });
    }
  }, [messages, sendMessageMutation.isPending]);

  useEffect(() => {
    if (!hasInitialized && messages !== undefined && isAuthenticated) {
      const urlParams = new URLSearchParams(location.split('?')[1]);
      const testId = urlParams.get('testId');
      
      if (testId) {
        sendMessageMutation.mutate("I just finished a practice test and would like help understanding the topics I struggled with.");
        setHasInitialized(true);
      } else {
        setHasInitialized(true);
      }
    }
  }, [messages, hasInitialized, isAuthenticated, location]);

  if (authLoading || !isAuthenticated) {
    return null;
  }

  if (courseLoading) {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48 mb-8" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <p>Course not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-6" data-testid="button-back">
        <Link href="/">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Courses
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{course.name}</h1>
        <p className="text-muted-foreground">AI Tutor - Ask questions about your course materials</p>
      </div>

      <Card className="flex flex-col h-[600px]">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              AI Tutor Chat
            </div>
            <Badge variant="secondary" className="gap-1.5" data-testid="badge-practice-aware">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Practice Test Aware
            </Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            The tutor has access to your recent practice test results and can help with questions you missed
          </p>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0">
          <div className="flex-1 overflow-y-auto p-6" ref={scrollRef}>
            {messagesLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-3/4" />
                ))}
              </div>
            ) : messages && messages.length > 0 ? (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <Avatar className="h-8 w-8 mt-1">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[80%] rounded-md p-4 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-xs opacity-70 mt-2">
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : ""}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <Avatar className="h-8 w-8 mt-1">
                        <AvatarFallback>
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                {sendMessageMutation.isPending && (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-md p-4">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <Bot className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
                  <p className="text-muted-foreground max-w-md">
                    Ask me anything about your course materials. I'll help you understand concepts and prepare for your tests.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-4">
            <div className="flex gap-2">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question about your course..."
                className="min-h-[60px] resize-none"
                disabled={sendMessageMutation.isPending}
                data-testid="textarea-message"
              />
              <Button
                onClick={handleSend}
                disabled={!message.trim() || sendMessageMutation.isPending}
                size="icon"
                className="h-[60px] w-[60px]"
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
