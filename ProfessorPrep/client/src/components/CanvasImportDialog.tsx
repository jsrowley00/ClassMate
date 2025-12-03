import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { FileText, Folder, Image, Video, File, Download, Link2, Unlink, ChevronRight, ChevronDown, Loader2, Users, UserPlus } from "lucide-react";

interface CanvasFile {
  id: number;
  display_name: string;
  filename: string;
  size: number;
  content_type: string;
}

interface CanvasCourse {
  id: number;
  name: string;
  course_code: string;
}

interface CanvasModule {
  id: number;
  name: string;
  items: Array<{
    id: number;
    title: string;
    type: string;
    content_id?: number;
  }>;
}

interface CanvasStudent {
  id: number;
  name: string;
  email: string;
  enrollmentState: string;
}

interface CanvasImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  classmateCourseId: string;
  classmateModuleId?: string | null;
  onImportComplete: () => void;
}

export function CanvasImportDialog({
  isOpen,
  onClose,
  classmateCourseId,
  classmateModuleId,
  onImportComplete,
}: CanvasImportDialogProps) {
  const { toast } = useToast();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  
  const [canvasUrl, setCanvasUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<CanvasCourse | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<number>>(new Set());
  const [selectedStudentEmails, setSelectedStudentEmails] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<"status" | "connect" | "courses" | "files">("status");
  const [activeTab, setActiveTab] = useState<"files" | "students">("files");

  const { data: canvasStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<{
    isConfigured: boolean;
    isConnected: boolean;
    canvasUrl: string | null;
  }>({
    queryKey: ["/api/canvas/status"],
    enabled: isOpen,
  });

  const { data: canvasCourses, isLoading: coursesLoading } = useQuery<CanvasCourse[]>({
    queryKey: ["/api/canvas/courses"],
    enabled: isOpen && canvasStatus?.isConnected === true && step === "courses",
  });

  const { data: courseData, isLoading: filesLoading } = useQuery<{
    files: CanvasFile[];
    modules: CanvasModule[];
  }>({
    queryKey: ["/api/canvas/courses", selectedCourse?.id, "files"],
    enabled: isOpen && selectedCourse !== null && step === "files",
  });

  const { data: studentsData, isLoading: studentsLoading } = useQuery<CanvasStudent[]>({
    queryKey: ["/api/canvas/courses", selectedCourse?.id, "students"],
    enabled: isOpen && selectedCourse !== null && step === "files" && activeTab === "students",
  });

  useEffect(() => {
    if (isOpen && canvasStatus) {
      if (!canvasStatus.isConfigured) {
        setStep("status");
      } else if (!canvasStatus.isConnected) {
        setStep("connect");
      } else {
        setStep("courses");
      }
    }
  }, [isOpen, canvasStatus]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedCourse(null);
      setSelectedFileIds(new Set());
      setSelectedStudentEmails(new Set());
      setExpandedModules(new Set());
      setStep("status");
      setActiveTab("files");
    }
  }, [isOpen]);

  const connectMutation = useMutation({
    mutationFn: async ({ url, token: canvasToken }: { url: string; token: string }) => {
      const authToken = await getToken();
      const response = await fetch("/api/canvas/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ canvasUrl: url, accessToken: canvasToken }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to connect");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Connected",
        description: "Successfully connected to Canvas",
      });
      setAccessToken("");
      queryClient.invalidateQueries({ queryKey: ["/api/canvas/status"] });
      setStep("courses");
    },
    onError: (error: Error) => {
      toast({
        title: "Connection failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const response = await fetch("/api/canvas/disconnect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to disconnect");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/canvas/status"] });
      setStep("connect");
      toast({
        title: "Disconnected",
        description: "Canvas has been disconnected",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const response = await fetch("/api/canvas/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileIds: Array.from(selectedFileIds),
          classmateCourseId,
          classmateModuleId,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to import files");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import complete",
        description: `Successfully imported ${data.imported.length} file(s)`,
      });
      onImportComplete();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const inviteStudentsMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const response = await fetch(`/api/courses/${classmateCourseId}/enrollments/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          emails: Array.from(selectedStudentEmails),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to invite students");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Students invited",
        description: `Successfully invited ${data.enrolled?.length || selectedStudentEmails.size} student(s)`,
      });
      setSelectedStudentEmails(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/courses", classmateCourseId, "students"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Invitation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleFileSelection = (fileId: number) => {
    const newSelection = new Set(selectedFileIds);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFileIds(newSelection);
  };

  const toggleStudentSelection = (email: string) => {
    const newSelection = new Set(selectedStudentEmails);
    if (newSelection.has(email)) {
      newSelection.delete(email);
    } else {
      newSelection.add(email);
    }
    setSelectedStudentEmails(newSelection);
  };

  const selectAllStudents = () => {
    if (studentsData) {
      setSelectedStudentEmails(new Set(studentsData.map(s => s.email)));
    }
  };

  const deselectAllStudents = () => {
    setSelectedStudentEmails(new Set());
  };

  const toggleModuleExpansion = (moduleId: number) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const getFileIcon = (contentType: string | undefined, filename: string) => {
    const type = contentType || "";
    if (type.includes("pdf") || filename.endsWith(".pdf")) return <FileText className="h-4 w-4" />;
    if (type.includes("image") || /\.(jpg|jpeg|png|gif)$/i.test(filename)) return <Image className="h-4 w-4" />;
    if (type.includes("video") || /\.(mp4|mov|avi|webm)$/i.test(filename)) return <Video className="h-4 w-4" />;
    if (type.includes("word") || /\.(doc|docx)$/i.test(filename)) return <FileText className="h-4 w-4" />;
    if (type.includes("presentation") || /\.(ppt|pptx)$/i.test(filename)) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderContent = () => {
    if (statusLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!canvasStatus?.isConfigured) {
      return (
        <div className="text-center py-8 space-y-4">
          <div className="text-muted-foreground">
            <p className="font-medium">Canvas Integration Not Available</p>
            <p className="text-sm mt-2">
              Canvas integration requires setup by the administrator.
              Please contact support to enable this feature.
            </p>
          </div>
        </div>
      );
    }

    if (step === "connect") {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              Connect your Canvas account to import course materials directly.
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="canvas-url">Your School's Canvas URL</Label>
              <Input
                id="canvas-url"
                placeholder="e.g., myschool.instructure.com"
                value={canvasUrl}
                onChange={(e) => setCanvasUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter your institution's Canvas domain (without https://)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="access-token">Canvas Access Token</Label>
              <Input
                id="access-token"
                type="password"
                placeholder="Paste your access token here"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
              <div className="text-xs text-muted-foreground space-y-1">
                <p>To create an access token:</p>
                <ol className="list-decimal list-inside ml-2 space-y-0.5">
                  <li>Go to Canvas → Account → Settings</li>
                  <li>Scroll to "Approved Integrations"</li>
                  <li>Click "+ New Access Token"</li>
                  <li>Enter a purpose (e.g., "ClassMate") and click "Generate Token"</li>
                  <li>Copy and paste the token here</li>
                </ol>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => connectMutation.mutate({ url: canvasUrl, token: accessToken })}
              disabled={!canvasUrl.trim() || !accessToken.trim() || connectMutation.isPending}
            >
              {connectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="mr-2 h-4 w-4" />
                  Connect to Canvas
                </>
              )}
            </Button>
          </div>
        </div>
      );
    }

    if (step === "courses") {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Connected to: <span className="font-medium">{canvasStatus?.canvasUrl}</span>
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              <Unlink className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Select a Canvas Course</h4>
            {coursesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : canvasCourses && canvasCourses.length > 0 ? (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {canvasCourses.map((course) => (
                    <button
                      key={course.id}
                      className="w-full p-3 border rounded-md hover:bg-muted/50 text-left transition-colors flex items-center justify-between"
                      onClick={() => {
                        setSelectedCourse(course);
                        setStep("files");
                      }}
                    >
                      <div>
                        <div className="font-medium">{course.name}</div>
                        <div className="text-sm text-muted-foreground">{course.course_code}</div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No courses found where you are a teacher.</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (step === "files") {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedCourse(null);
                setSelectedFileIds(new Set());
                setSelectedStudentEmails(new Set());
                setStep("courses");
                setActiveTab("files");
              }}
            >
              Back to Courses
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{selectedCourse?.name}</span>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "files" | "students")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="files" className="flex items-center gap-2">
                <File className="h-4 w-4" />
                Files
              </TabsTrigger>
              <TabsTrigger value="students" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Students
              </TabsTrigger>
            </TabsList>

            <TabsContent value="files" className="mt-4">
              {filesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : courseData ? (
                <>
                  <ScrollArea className="h-[300px] border rounded-md p-2">
                    <div className="space-y-1">
                      {courseData.modules.length > 0 && (
                        <div className="mb-4">
                          <h5 className="text-sm font-medium text-muted-foreground mb-2">By Module</h5>
                          {courseData.modules.map((module) => {
                            const fileItems = module.items.filter(item => item.type === "File" && item.content_id);
                            if (fileItems.length === 0) return null;
                            
                            return (
                              <div key={module.id} className="mb-2">
                                <button
                                  className="flex items-center gap-2 w-full p-2 hover:bg-muted/50 rounded-md"
                                  onClick={() => toggleModuleExpansion(module.id)}
                                >
                                  {expandedModules.has(module.id) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <Folder className="h-4 w-4 text-blue-500" />
                                  <span className="font-medium">{module.name}</span>
                                  <Badge variant="secondary" className="ml-auto">
                                    {fileItems.length}
                                  </Badge>
                                </button>
                                {expandedModules.has(module.id) && (
                                  <div className="ml-8 space-y-1 mt-1">
                                    {fileItems.map((item) => {
                                      const file = courseData.files.find(f => f.id === item.content_id);
                                      if (!file) return null;
                                      
                                      return (
                                        <div
                                          key={item.id}
                                          className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer"
                                          onClick={() => toggleFileSelection(file.id)}
                                        >
                                          <Checkbox
                                            checked={selectedFileIds.has(file.id)}
                                            onCheckedChange={() => toggleFileSelection(file.id)}
                                          />
                                          {getFileIcon(file.content_type, file.filename)}
                                          <span className="flex-1 truncate">{file.display_name}</span>
                                          <span className="text-xs text-muted-foreground">
                                            {formatFileSize(file.size)}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {courseData.files.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-muted-foreground mb-2">All Files</h5>
                          {courseData.files.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer"
                              onClick={() => toggleFileSelection(file.id)}
                            >
                              <Checkbox
                                checked={selectedFileIds.has(file.id)}
                                onCheckedChange={() => toggleFileSelection(file.id)}
                              />
                              {getFileIcon(file.content_type, file.filename)}
                              <span className="flex-1 truncate">{file.display_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatFileSize(file.size)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {courseData.files.length === 0 && courseData.modules.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No files found in this course.</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <p className="text-sm text-muted-foreground">
                      {selectedFileIds.size} file(s) selected
                    </p>
                    <Button
                      onClick={() => importMutation.mutate()}
                      disabled={selectedFileIds.size === 0 || importMutation.isPending}
                    >
                      {importMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Import Selected
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : null}
            </TabsContent>

            <TabsContent value="students" className="mt-4">
              {studentsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : studentsData && studentsData.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">
                      {studentsData.length} student(s) in Canvas course
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={selectAllStudents}>
                        Select All
                      </Button>
                      <Button variant="outline" size="sm" onClick={deselectAllStudents}>
                        Deselect All
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-[300px] border rounded-md p-2">
                    <div className="space-y-1">
                      {studentsData.map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-md cursor-pointer"
                          onClick={() => toggleStudentSelection(student.email)}
                        >
                          <Checkbox
                            checked={selectedStudentEmails.has(student.email)}
                            onCheckedChange={() => toggleStudentSelection(student.email)}
                          />
                          <Users className="h-4 w-4 text-blue-500" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{student.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{student.email}</div>
                          </div>
                          <Badge variant={student.enrollmentState === "active" ? "default" : "secondary"}>
                            {student.enrollmentState}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <p className="text-sm text-muted-foreground">
                      {selectedStudentEmails.size} student(s) selected
                    </p>
                    <Button
                      onClick={() => inviteStudentsMutation.mutate()}
                      disabled={selectedStudentEmails.size === 0 || inviteStudentsMutation.isPending}
                    >
                      {inviteStudentsMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Inviting...
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Invite Selected
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No students found in this Canvas course.</p>
                  <p className="text-xs mt-1">Students must be enrolled in the Canvas course to appear here.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from Canvas</DialogTitle>
          <DialogDescription>
            Import study materials directly from your Canvas courses
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
