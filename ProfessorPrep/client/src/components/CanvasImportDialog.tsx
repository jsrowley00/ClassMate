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
import { FileText, Folder, Image, Video, File, Download, Link2, Unlink, ChevronRight, ChevronDown, Loader2, Users, UserPlus, FolderTree, Check } from "lucide-react";

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
  const [step, setStep] = useState<"status" | "connect" | "courses" | "structure-choice" | "module-selection" | "files">("status");
  const [activeTab, setActiveTab] = useState<"files" | "students">("files");
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<number>>(new Set());
  
  // Structure import state
  const [importedStructure, setImportedStructure] = useState<{
    modules: Array<{
      canvasModuleId: number;
      classmateModuleId: string;
      name: string;
      fileCount: number;
      files: Array<{ contentId: number; title: string }>;
    }>;
    moduleMapping: Record<number, string>;
  } | null>(null);
  const [structureImported, setStructureImported] = useState(false);

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
    enabled: isOpen && selectedCourse !== null && (step === "files" || step === "module-selection"),
  });

  const { data: studentsData, isLoading: studentsLoading } = useQuery<CanvasStudent[]>({
    queryKey: ["/api/canvas/courses", selectedCourse?.id, "students"],
    enabled: isOpen && selectedCourse !== null && step === "files" && activeTab === "students",
  });

  interface EnrolledStudent {
    id: string;
    email: string;
    enrollmentStatus: string;
  }
  
  interface CourseInvitation {
    id: string;
    email: string;
    status: string;
  }

  const { data: enrolledStudentsData } = useQuery<{ students: EnrolledStudent[]; invitations: CourseInvitation[] }>({
    queryKey: ["/api/courses", classmateCourseId, "students"],
    enabled: isOpen && step === "files" && activeTab === "students",
  });

  const alreadyEnrolledEmails = new Set([
    ...(enrolledStudentsData?.students?.map(s => s.email?.toLowerCase()) || []),
    ...(enrolledStudentsData?.invitations?.map(i => i.email?.toLowerCase()) || []),
  ].filter(Boolean));

  const availableCanvasStudents = studentsData?.filter(
    s => !alreadyEnrolledEmails.has(s.email?.toLowerCase())
  ) || [];

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
      setSelectedModuleIds(new Set());
      setExpandedModules(new Set());
      setStep("status");
      setActiveTab("files");
      setImportedStructure(null);
      setStructureImported(false);
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

  const importStructureMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      
      // Build file to Canvas module mapping from courseData
      const fileModuleMapping: Record<number, number> = {};
      courseData?.modules.forEach(module => {
        module.items.forEach(item => {
          if (item.type === "File" && item.content_id && selectedFileIds.has(item.content_id)) {
            fileModuleMapping[item.content_id] = module.id;
          }
        });
      });
      
      const response = await fetch("/api/canvas/import-structure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          canvasCourseId: selectedCourse?.id,
          classmateCourseId,
          selectedModuleIds: Array.from(selectedModuleIds),
          selectedFileIds: Array.from(selectedFileIds),
          fileCanvasModuleMapping: fileModuleMapping,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to import");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import complete",
        description: `Created ${data.modulesCreated} module(s) and imported ${data.filesImported} file(s).`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", classmateCourseId] });
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

  const importMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      
      // Build file-to-module mapping if structure was imported
      let fileModuleMapping: Record<string, string> | undefined;
      if (structureImported && importedStructure) {
        fileModuleMapping = {};
        for (const mod of importedStructure.modules) {
          for (const file of mod.files) {
            if (file.contentId && selectedFileIds.has(file.contentId)) {
              fileModuleMapping[file.contentId.toString()] = mod.classmateModuleId;
            }
          }
        }
      }
      
      const response = await fetch("/api/canvas/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileIds: Array.from(selectedFileIds),
          classmateCourseId,
          classmateModuleId: structureImported ? null : classmateModuleId,
          fileModuleMapping,
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
        description: `Successfully imported ${data.imported.length} file(s)${structureImported ? " into their respective modules" : ""}`,
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
    if (availableCanvasStudents.length > 0) {
      setSelectedStudentEmails(new Set(availableCanvasStudents.map(s => s.email)));
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
                        setStep("structure-choice");
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

    if (step === "structure-choice") {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedCourse(null);
                setStep("courses");
              }}
            >
              Back to Courses
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{selectedCourse?.name}</span>
          </div>

          <div className="text-center">
            <h4 className="font-medium text-lg mb-2">Import Module Structure?</h4>
            <p className="text-sm text-muted-foreground mb-6">
              Would you like to recreate your Canvas module structure in ClassMate?
            </p>
          </div>

          <div className="grid gap-4">
            <button
              className="p-4 border rounded-lg hover:bg-muted/50 text-left transition-colors flex items-start gap-4"
              onClick={() => setStep("module-selection")}
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <FolderTree className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Import with Module Structure</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Select which Canvas modules to recreate in ClassMate, along with their files.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground mt-1" />
            </button>

            <button
              className="p-4 border rounded-lg hover:bg-muted/50 text-left transition-colors flex items-start gap-4"
              onClick={() => setStep("files")}
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                <File className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Skip Structure, Just Import Files</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Browse and select individual files without recreating the module structure.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground mt-1" />
            </button>
          </div>
        </div>
      );
    }

    if (step === "module-selection") {
      // Helper to get files for a module
      const getModuleFiles = (module: CanvasModule) => {
        return module.items.filter(item => item.type === "File" && item.content_id);
      };

      // Toggle module selection (selects/deselects all files in it too)
      const toggleModuleSelection = (moduleId: number, files: Array<{ content_id?: number }>) => {
        const newSelectedModules = new Set(selectedModuleIds);
        const newSelectedFiles = new Set(selectedFileIds);
        
        if (selectedModuleIds.has(moduleId)) {
          // Deselect module and all its files
          newSelectedModules.delete(moduleId);
          files.forEach(f => {
            if (f.content_id) newSelectedFiles.delete(f.content_id);
          });
        } else {
          // Select module and all its files
          newSelectedModules.add(moduleId);
          files.forEach(f => {
            if (f.content_id) newSelectedFiles.add(f.content_id);
          });
        }
        
        setSelectedModuleIds(newSelectedModules);
        setSelectedFileIds(newSelectedFiles);
      };

      // Toggle individual file (updates module partial state)
      const toggleFileInModule = (fileId: number, moduleId: number, allModuleFiles: Array<{ content_id?: number }>) => {
        const newSelectedFiles = new Set(selectedFileIds);
        const newSelectedModules = new Set(selectedModuleIds);
        
        if (selectedFileIds.has(fileId)) {
          newSelectedFiles.delete(fileId);
        } else {
          newSelectedFiles.add(fileId);
        }
        
        // Check if any files in this module are selected
        const anyFileSelected = allModuleFiles.some(f => f.content_id && newSelectedFiles.has(f.content_id));
        if (anyFileSelected) {
          newSelectedModules.add(moduleId);
        } else {
          newSelectedModules.delete(moduleId);
        }
        
        setSelectedFileIds(newSelectedFiles);
        setSelectedModuleIds(newSelectedModules);
      };

      // Check if all files in a module are selected
      const areAllFilesSelected = (files: Array<{ content_id?: number }>) => {
        const fileIds = files.filter(f => f.content_id).map(f => f.content_id!);
        return fileIds.length > 0 && fileIds.every(id => selectedFileIds.has(id));
      };

      // Check if some (but not all) files are selected
      const areSomeFilesSelected = (files: Array<{ content_id?: number }>) => {
        const fileIds = files.filter(f => f.content_id).map(f => f.content_id!);
        const selectedCount = fileIds.filter(id => selectedFileIds.has(id)).length;
        return selectedCount > 0 && selectedCount < fileIds.length;
      };

      // Select all modules and files
      const selectAll = () => {
        const newModules = new Set<number>();
        const newFiles = new Set<number>();
        courseData?.modules.forEach(module => {
          const files = getModuleFiles(module);
          if (files.length > 0) {
            newModules.add(module.id);
            files.forEach(f => {
              if (f.content_id) newFiles.add(f.content_id);
            });
          }
        });
        setSelectedModuleIds(newModules);
        setSelectedFileIds(newFiles);
      };

      // Deselect all
      const deselectAll = () => {
        setSelectedModuleIds(new Set());
        setSelectedFileIds(new Set());
      };

      // Count totals
      const totalModulesWithFiles = courseData?.modules.filter(m => getModuleFiles(m).length > 0).length || 0;
      const totalFiles = courseData?.modules.reduce((sum, m) => sum + getModuleFiles(m).length, 0) || 0;

      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedModuleIds(new Set());
                setSelectedFileIds(new Set());
                setStep("structure-choice");
              }}
            >
              Back
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{selectedCourse?.name}</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Select Modules & Files</h4>
              <p className="text-sm text-muted-foreground">
                {selectedModuleIds.size} of {totalModulesWithFiles} modules, {selectedFileIds.size} of {totalFiles} files selected
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Clear
              </Button>
            </div>
          </div>

          {filesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : courseData?.modules && courseData.modules.length > 0 ? (
            <ScrollArea className="h-[350px] border rounded-md p-2">
              <div className="space-y-1">
                {courseData.modules.map((module) => {
                  const files = getModuleFiles(module);
                  if (files.length === 0) return null;
                  
                  const isExpanded = expandedModules.has(module.id);
                  const allSelected = areAllFilesSelected(files);
                  const someSelected = areSomeFilesSelected(files);
                  
                  return (
                    <div key={module.id} className="border rounded-md">
                      <div className="flex items-center gap-2 p-3 hover:bg-muted/50">
                        <Checkbox
                          checked={allSelected}
                          ref={(el) => {
                            if (el) {
                              (el as unknown as HTMLInputElement).indeterminate = someSelected && !allSelected;
                            }
                          }}
                          onCheckedChange={() => toggleModuleSelection(module.id, files)}
                        />
                        <button
                          className="flex items-center gap-2 flex-1 text-left"
                          onClick={() => toggleModuleExpansion(module.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <Folder className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">{module.name}</span>
                          <Badge variant="secondary" className="ml-auto">
                            {files.filter(f => f.content_id && selectedFileIds.has(f.content_id)).length}/{files.length}
                          </Badge>
                        </button>
                      </div>
                      
                      {isExpanded && (
                        <div className="border-t bg-muted/20 p-2 space-y-1">
                          {files.map((item) => {
                            if (!item.content_id) return null;
                            const isSelected = selectedFileIds.has(item.content_id);
                            
                            return (
                              <label
                                key={item.id}
                                className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleFileInModule(item.content_id!, module.id, files)}
                                />
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{item.title}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No modules with files found in this course.</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedModuleIds(new Set());
                setSelectedFileIds(new Set());
                setStep("structure-choice");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => importStructureMutation.mutate()}
              disabled={selectedFileIds.size === 0 || importStructureMutation.isPending}
            >
              {importStructureMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Import Selected ({selectedFileIds.size} files)
                </>
              )}
            </Button>
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
                setImportedStructure(null);
                setStructureImported(false);
              }}
            >
              Back to Courses
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{selectedCourse?.name}</span>
            {structureImported && (
              <Badge variant="secondary" className="ml-2">
                <Check className="h-3 w-3 mr-1" />
                Modules Created
              </Badge>
            )}
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
              ) : availableCanvasStudents.length > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">
                      {availableCanvasStudents.length} student(s) available to invite
                      {studentsData && studentsData.length > availableCanvasStudents.length && (
                        <span className="text-xs ml-1">
                          ({studentsData.length - availableCanvasStudents.length} already enrolled/invited)
                        </span>
                      )}
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
                      {availableCanvasStudents.map((student) => (
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
              ) : studentsData && studentsData.length > 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>All {studentsData.length} student(s) from Canvas are already enrolled or invited.</p>
                </div>
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
