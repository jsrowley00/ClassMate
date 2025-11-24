import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ArrowLeft, Upload, FileText, File, Image as ImageIcon, Trash2, Video, UserPlus, X, FolderPlus, Folder, Presentation, BarChart3, TrendingDown, Users, ClipboardList, ChevronDown, Pencil } from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Course, CourseMaterial, User, CourseModule } from "@shared/schema";

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [studentEmail, setStudentEmail] = useState("");
  const [newModuleName, setNewModuleName] = useState("");
  const [selectedParentModuleId, setSelectedParentModuleId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [isTopicsExpanded, setIsTopicsExpanded] = useState(true);
  const [isActivityExpanded, setIsActivityExpanded] = useState(true);
  const [isModulesListExpanded, setIsModulesListExpanded] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

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

  const { data: materials, isLoading: materialsLoading } = useQuery<CourseMaterial[]>({
    queryKey: ["/api/courses", id, "materials"],
    enabled: isAuthenticated && !!id,
  });

  const { data: students, isLoading: studentsLoading } = useQuery<User[]>({
    queryKey: ["/api/courses", id, "students"],
    enabled: isAuthenticated && !!id,
  });

  const { data: modules, isLoading: modulesLoading } = useQuery<CourseModule[]>({
    queryKey: ["/api/courses", id, "modules"],
    enabled: isAuthenticated && !!id,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<{
    summary: { totalTests: number; averageScore: number; participatingStudents: number };
    students: Array<{
      studentId: string;
      studentName: string;
      studentEmail: string;
      totalTests: number;
      averageScore: number;
      isStruggling: boolean;
      topMissedTopics: string[];
      allMissedTopics: Array<{ topic: string; count: number }>;
    }>;
    recentActivity: Array<{
      studentId: string;
      studentName: string;
      studentEmail: string;
      totalTests: number;
      averageScore: number;
      tests: Array<{
        id: string;
        score: number;
        testMode: string;
        questionCount: number;
        completedAt: Date | null;
      }>;
    }>;
  }>({
    queryKey: ["/api/courses", id, "analytics", "practice-tests"],
    enabled: isAuthenticated && !!id,
  });

  // Fetch all learning objectives for the course
  const { data: allLearningObjectives, isLoading: objectivesLoading } = useQuery<Array<{
    id: string;
    moduleId: string;
    objectives: string[];
    createdAt: Date | null;
  }>>({
    queryKey: ["/api/courses", id, "learning-objectives"],
    enabled: isAuthenticated && !!id,
  });

  // Auto-generate learning objectives for existing modules on first load
  useEffect(() => {
    if (!id || !modules || !materials || !allLearningObjectives) return;
    
    // Check if there are modules with materials but no objectives
    const modulesNeedingObjectives = modules.filter(module => {
      // Check if module has materials with extracted text
      const hasMaterials = materials.some(m => m.moduleId === module.id && m.extractedText);
      // Check if module already has objectives
      const hasObjectives = allLearningObjectives.some(obj => obj.moduleId === module.id);
      return hasMaterials && !hasObjectives;
    });

    if (modulesNeedingObjectives.length > 0) {
      // Trigger auto-generation for all modules
      apiRequest("POST", `/api/courses/${id}/learning-objectives/generate-all`, {})
        .then(() => {
          console.log(`Auto-generating objectives for ${modulesNeedingObjectives.length} modules`);
          // Refresh objectives after a delay
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["/api/courses", id, "learning-objectives"] });
          }, 5000);
        })
        .catch(err => {
          console.error("Failed to auto-generate objectives:", err);
        });
    }
  }, [id, modules, materials, allLearningObjectives]);

  const reprocessMaterialsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/courses/${id}/materials/reprocess`, {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: `Text extracted from ${data.processed} files. ${data.errors > 0 ? `${data.errors} errors occurred.` : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", id, "materials"] });
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
        description: error.message || "Failed to process materials",
        variant: "destructive",
      });
    },
  });

  const createModuleMutation = useMutation({
    mutationFn: async ({ name, parentModuleId }: { name: string; parentModuleId: string | null }) => {
      const modulesCount = modules?.length || 0;
      return await apiRequest("POST", `/api/courses/${id}/modules`, {
        name,
        parentModuleId,
        orderIndex: modulesCount,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Module created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", id, "modules"] });
      setNewModuleName("");
      setSelectedParentModuleId(null);
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
        description: error.message || "Failed to create module",
        variant: "destructive",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("files", file);
      });
      if (selectedModuleId) {
        formData.append("moduleId", selectedModuleId);
      }
      
      const response = await fetch(`/api/courses/${id}/materials`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to upload files");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Files uploaded successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", id, "materials"] });
      setSelectedFiles(null);
      const fileInput = document.getElementById("file-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
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
        description: error.message || "Failed to upload files",
        variant: "destructive",
      });
    },
  });

  const updateMaterialModuleMutation = useMutation({
    mutationFn: async ({ materialId, moduleId }: { materialId: string; moduleId: string | null }) => {
      return await apiRequest("PATCH", `/api/courses/${id}/materials/${materialId}`, { moduleId });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "File moved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", id, "materials"] });
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
        description: error.message || "Failed to move file",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (materialId: string) => {
      return await apiRequest("DELETE", `/api/courses/${id}/materials/${materialId}`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Material deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", id, "materials"] });
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
        description: error.message || "Failed to delete material",
        variant: "destructive",
      });
    },
  });

  const addStudentMutation = useMutation({
    mutationFn: async (email: string) => {
      return await apiRequest("POST", `/api/courses/${id}/students`, { email });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Student added successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", id, "students"] });
      setStudentEmail("");
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
        description: error.message || "Failed to add student",
        variant: "destructive",
      });
    },
  });

  const updateCourseMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      return await apiRequest("PATCH", `/api/courses/${id}`, data);
    },
    onSuccess: (updatedCourse) => {
      // Update the cached course data immediately with the authoritative server response
      if (updatedCourse) {
        queryClient.setQueryData(["/api/courses", id], updatedCourse);
      }
      
      // Invalidate queries to ensure everything stays in sync
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", id] });
      
      toast({
        title: "Success",
        description: "Course updated successfully",
      });
      setEditDialogOpen(false);
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
        description: error.message || "Failed to update course",
        variant: "destructive",
      });
    },
  });

  const deleteCourseMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/courses/${id}`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Course deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      setLocation("/professor/courses");
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
        description: error.message || "Failed to delete course",
        variant: "destructive",
      });
    },
  });

  const removeStudentMutation = useMutation({
    mutationFn: async (studentId: string) => {
      return await apiRequest("DELETE", `/api/courses/${id}/students/${studentId}`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Student removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", id, "students"] });
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
        description: error.message || "Failed to remove student",
        variant: "destructive",
      });
    },
  });


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(e.target.files);
    }
  };

  const handleUpload = () => {
    if (selectedFiles) {
      uploadMutation.mutate(selectedFiles);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType === "pdf") return <FileText className="h-4 w-4" />;
    if (fileType === "docx") return <File className="h-4 w-4" />;
    if (fileType === "pptx") return <Presentation className="h-4 w-4" />;
    if (fileType === "image") return <ImageIcon className="h-4 w-4" />;
    if (fileType === "video") return <Video className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  if (authLoading || !isAuthenticated) {
    return null;
  }

  if (courseLoading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48 mb-8" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <p>Course not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" asChild data-testid="link-back-to-courses">
          <Link href="/professor/courses">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Courses
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setEditName(course.name);
                  setEditDescription(course.description || "");
                }}
                data-testid="button-edit-course"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit Course
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Course</DialogTitle>
                <DialogDescription>
                  Update the course name and description
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Course Name</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter course name"
                    data-testid="input-edit-course-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Enter course description"
                    rows={4}
                    data-testid="input-edit-course-description"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditDialogOpen(false)}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      updateCourseMutation.mutate({
                        name: editName,
                        description: editDescription,
                      });
                    }}
                    disabled={!editName.trim() || updateCourseMutation.isPending}
                    data-testid="button-save-edit"
                  >
                    {updateCourseMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" data-testid="button-delete-course">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the course "{course.name}" and all associated materials, modules, and enrollments. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteCourseMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-testid="button-confirm-delete"
                >
                  Delete Course
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{course.name}</h1>
        <p className="text-muted-foreground">{course.description || "No description"}</p>
      </div>

      {/* Practice Test Analytics */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Practice Test Analytics
          </CardTitle>
          <CardDescription>
            Monitor student practice activity and identify areas where students need help
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analyticsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : analytics && analytics.summary.totalTests > 0 ? (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-md">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <ClipboardList className="h-4 w-4" />
                    <span className="text-sm">Total Tests</span>
                  </div>
                  <div className="text-2xl font-bold">{analytics.summary.totalTests}</div>
                </div>
                <div className="p-4 border rounded-md">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <BarChart3 className="h-4 w-4" />
                    <span className="text-sm">Average Score</span>
                  </div>
                  <div className="text-2xl font-bold">{analytics.summary.averageScore}%</div>
                </div>
                <div className="p-4 border rounded-md">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">Active Students</span>
                  </div>
                  <div className="text-2xl font-bold">{analytics.summary.participatingStudents}</div>
                </div>
              </div>

              {/* Study Topics - Grouped by AI-Categorized Broad Topics */}
              {(analytics as any).topicsByMisses && (analytics as any).topicsByMisses.length > 0 && (
                <Collapsible open={isTopicsExpanded} onOpenChange={setIsTopicsExpanded}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-2 mb-3 cursor-pointer hover-elevate p-2 rounded-md" data-testid="toggle-topics">
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isTopicsExpanded ? 'rotate-0' : '-rotate-90'}`} />
                      <TrendingDown className="h-4 w-4 text-destructive" />
                      <h3 className="font-semibold">Study Topics Students Are Struggling With</h3>
                      <Badge variant="destructive" className="ml-auto">
                        {(analytics as any).topicsByMisses.length} {(analytics as any).topicsByMisses.length === 1 ? 'category' : 'categories'}
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2 ml-6">
                    {(analytics as any).topicsByMisses
                      .slice(0, 15)
                      .map((topicData: any, idx: number) => (
                        <Dialog key={idx}>
                          <DialogTrigger asChild>
                            <div
                              className="p-3 border rounded-md hover-elevate cursor-pointer"
                              data-testid={`analytics-topic-${idx}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="font-medium">{topicData.category}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {topicData.description || `${topicData.totalMisses} question${topicData.totalMisses !== 1 ? 's' : ''} missed in this category`}
                                  </div>
                                </div>
                                <Badge variant="destructive">
                                  {topicData.totalMisses} {topicData.totalMisses === 1 ? 'miss' : 'misses'}
                                </Badge>
                              </div>
                            </div>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{topicData.category}</DialogTitle>
                              <DialogDescription>
                                {topicData.description || "Questions students missed in this study topic"}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="p-3 border rounded-md">
                                <div className="text-sm text-muted-foreground mb-1">Questions Missed</div>
                                <div className="text-2xl font-bold text-destructive">{topicData.totalMisses}</div>
                              </div>
                              
                              <div>
                                <h4 className="font-semibold mb-3">Missed Questions in This Category</h4>
                                <div className="space-y-3">
                                  {topicData.questions.map((missed: any, qIdx: number) => (
                                    <div
                                      key={qIdx}
                                      className="p-3 border rounded-md text-sm"
                                      data-testid={`missed-question-${idx}-${qIdx}`}
                                    >
                                      <div className="font-medium mb-2">{missed.questionText}</div>
                                      <div className="text-xs text-muted-foreground">
                                        Missed by: <span className="font-medium">{missed.studentName}</span>
                                        {missed.studentEmail && ` (${missed.studentEmail})`}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Student Activity */}
              {analytics.recentActivity && analytics.recentActivity.length > 0 && (
                <Collapsible open={isActivityExpanded} onOpenChange={setIsActivityExpanded}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center gap-2 mb-3 cursor-pointer hover-elevate p-2 rounded-md" data-testid="toggle-activity">
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isActivityExpanded ? 'rotate-0' : '-rotate-90'}`} />
                      <Users className="h-4 w-4" />
                      <h3 className="font-semibold">Student Activity</h3>
                      <Badge variant="secondary" className="ml-auto">
                        {analytics.recentActivity.length} {analytics.recentActivity.length === 1 ? 'student' : 'students'}
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2 ml-6">
                    {analytics.recentActivity.map((activity) => (
                      <Dialog key={activity.studentId}>
                        <DialogTrigger asChild>
                          <div
                            className="flex items-center justify-between p-3 border rounded-md hover-elevate cursor-pointer"
                            data-testid={`analytics-activity-${activity.studentId}`}
                          >
                            <div className="flex-1">
                              <div className="font-medium">{activity.studentName}</div>
                              <div className="text-xs text-muted-foreground">{activity.studentEmail}</div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className={`font-bold ${activity.averageScore >= 70 ? "text-green-600" : "text-destructive"}`}>
                                  {activity.averageScore}%
                                </div>
                                <div className="text-xs text-muted-foreground">Average</div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold">{activity.totalTests}</div>
                                <div className="text-xs text-muted-foreground">Tests</div>
                              </div>
                            </div>
                          </div>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{activity.studentName}</DialogTitle>
                            <DialogDescription>{activity.studentEmail}</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 border rounded-md">
                                <div className="text-sm text-muted-foreground mb-1">Average Score</div>
                                <div className={`text-2xl font-bold ${activity.averageScore >= 70 ? "text-green-600" : "text-destructive"}`}>
                                  {activity.averageScore}%
                                </div>
                              </div>
                              <div className="p-3 border rounded-md">
                                <div className="text-sm text-muted-foreground mb-1">Total Tests</div>
                                <div className="text-2xl font-bold">{activity.totalTests}</div>
                              </div>
                            </div>
                            
                            <div>
                              <h4 className="font-semibold mb-3">All Practice Tests</h4>
                              <div className="space-y-2">
                                {activity.tests.map((test, idx) => (
                                  <div
                                    key={test.id}
                                    className="flex items-center justify-between p-2 border rounded-md text-sm"
                                    data-testid={`test-${activity.studentId}-${idx}`}
                                  >
                                    <div className="flex-1">
                                      <div className="font-medium capitalize">
                                        {test.testMode.replace("_", " ")}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {test.questionCount} questions • {test.completedAt ? new Date(test.completedAt).toLocaleDateString() : "Unknown"}
                                      </div>
                                      {(test as any).moduleNames && (test as any).moduleNames.length > 0 && (
                                        <div className="text-xs text-muted-foreground mt-1">
                                          <span className="font-medium">Modules:</span> {(test as any).moduleNames.join(", ")}
                                        </div>
                                      )}
                                    </div>
                                    <div className={`font-bold ${test.score >= 70 ? "text-green-600" : "text-destructive"}`}>
                                      {test.score}%
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No practice test data yet</p>
              <p className="text-sm mt-1">Students haven't completed any practice tests for this course</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Module Management Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Course Modules</CardTitle>
          <CardDescription>
            Organize your course materials into sections/chapters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Select value={selectedParentModuleId || "none"} onValueChange={(value) => setSelectedParentModuleId(value === "none" ? null : value)}>
              <SelectTrigger data-testid="select-parent-module">
                <SelectValue placeholder="Create as top-level module or sub-module?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Top-level module</SelectItem>
                {modules && modules.filter(m => !m.parentModuleId).map((module) => (
                  <SelectItem key={module.id} value={module.id}>
                    Create under: {module.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                placeholder={selectedParentModuleId ? "Enter week/sub-module name (e.g., Week 1)" : "Enter module name (e.g., Module 1, Introduction)"}
                value={newModuleName}
                onChange={(e) => setNewModuleName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newModuleName.trim()) {
                    createModuleMutation.mutate({ name: newModuleName, parentModuleId: selectedParentModuleId });
                  }
                }}
                data-testid="input-module-name"
              />
              <Button
                onClick={() => newModuleName.trim() && createModuleMutation.mutate({ name: newModuleName, parentModuleId: selectedParentModuleId })}
                disabled={!newModuleName.trim() || createModuleMutation.isPending}
                data-testid="button-create-module"
              >
                <FolderPlus className="h-4 w-4 mr-2" />
                {createModuleMutation.isPending ? "Creating..." : "Create Module"}
              </Button>
            </div>
          </div>

          {modulesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
            </div>
          ) : modules && modules.length > 0 ? (
            <Collapsible open={isModulesListExpanded} onOpenChange={setIsModulesListExpanded}>
              <CollapsibleTrigger asChild>
                <div 
                  className="flex items-center gap-2 cursor-pointer hover-elevate p-2 rounded-md mb-2"
                  data-testid="modules-list-toggle"
                >
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isModulesListExpanded ? 'rotate-0' : '-rotate-90'}`} />
                  <span className="text-sm font-medium">View All Modules</span>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {modules.length}
                  </Badge>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid gap-2">
                  {modules.filter(m => !m.parentModuleId).map((parentModule) => {
                    const childModules = modules.filter(m => m.parentModuleId === parentModule.id);
                    const moduleIdStr = `list-${parentModule.id}`;
                    const isExpanded = expandedModules.has(moduleIdStr);
                    
                    const toggleModule = () => {
                      setExpandedModules(prev => {
                        const next = new Set(prev);
                        if (next.has(moduleIdStr)) {
                          next.delete(moduleIdStr);
                        } else {
                          next.add(moduleIdStr);
                        }
                        return next;
                      });
                    };
                    
                    // Get learning objectives for this module
                    const moduleObjectives = allLearningObjectives?.find(obj => obj.moduleId === parentModule.id);
                    
                    return (
                      <div key={parentModule.id} className="space-y-1">
                        <Collapsible open={isExpanded} onOpenChange={toggleModule}>
                          <CollapsibleTrigger asChild>
                            <div
                              className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover-elevate"
                              data-testid={`module-item-${parentModule.id}`}
                            >
                              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                              <Folder className="h-5 w-5 text-primary" />
                              <div className="flex-1">
                                <p className="font-medium">{parentModule.name}</p>
                              </div>
                              {childModules.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {childModules.length}
                                </Badge>
                              )}
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            {/* Learning Objectives Section for Parent Module */}
                            <div className="ml-8 mt-2 mb-3 p-3 bg-muted/20 rounded-md border">
                              <h4 className="text-sm font-medium mb-2">Learning Objectives</h4>
                              {moduleObjectives && moduleObjectives.objectives.length > 0 ? (
                                <ul className="space-y-1 text-sm">
                                  {moduleObjectives.objectives.map((objective, idx) => (
                                    <li key={idx} className="flex gap-2">
                                      <span className="text-muted-foreground">{idx + 1}.</span>
                                      <span>{objective}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-xs text-muted-foreground italic">
                                  Learning objectives will be generated automatically when materials are uploaded to this module
                                </p>
                              )}
                            </div>
                            
                            {/* Sub-modules */}
                            {childModules.length > 0 ? (
                              <div className="space-y-1 mt-1">
                                {childModules.map((childModule) => {
                                  const childObjectives = allLearningObjectives?.find(obj => obj.moduleId === childModule.id);
                                  const childModuleIdStr = `objectives-${childModule.id}`;
                                  const isChildModuleExpanded = expandedModules.has(childModuleIdStr);
                                  
                                  const toggleChildModule = () => {
                                    setExpandedModules(prev => {
                                      const next = new Set(prev);
                                      if (next.has(childModuleIdStr)) {
                                        next.delete(childModuleIdStr);
                                      } else {
                                        next.add(childModuleIdStr);
                                      }
                                      return next;
                                    });
                                  };
                                  
                                  return (
                                    <div key={childModule.id} className="space-y-2">
                                      <Collapsible open={isChildModuleExpanded} onOpenChange={toggleChildModule}>
                                        <CollapsibleTrigger asChild>
                                          <div
                                            className="flex items-center gap-3 p-3 ml-8 border rounded-md bg-muted/30 cursor-pointer hover-elevate"
                                            data-testid={`module-item-${childModule.id}`}
                                          >
                                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isChildModuleExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                            <Folder className="h-4 w-4 text-muted-foreground" />
                                            <div className="flex-1">
                                              <p className="text-sm">{childModule.name}</p>
                                            </div>
                                          </div>
                                        </CollapsibleTrigger>
                                        
                                        <CollapsibleContent>
                                          {/* Learning Objectives for Child Module */}
                                          <div className="ml-16 mt-2 p-3 bg-muted/20 rounded-md border">
                                            <h4 className="text-sm font-medium mb-2">Learning Objectives</h4>
                                            {childObjectives && childObjectives.objectives.length > 0 ? (
                                              <ul className="space-y-1 text-sm">
                                                {childObjectives.objectives.map((objective, idx) => (
                                                  <li key={idx} className="flex gap-2">
                                                    <span className="text-muted-foreground">{idx + 1}.</span>
                                                    <span>{objective}</span>
                                                  </li>
                                                ))}
                                              </ul>
                                            ) : (
                                              <p className="text-xs text-muted-foreground italic">
                                                Learning objectives will be generated automatically when materials are uploaded to this module
                                              </p>
                                            )}
                                          </div>
                                        </CollapsibleContent>
                                      </Collapsible>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-4 text-sm text-muted-foreground ml-8">
                                No sub-modules yet
                              </div>
                            )}
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Folder className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No modules yet</p>
              <p className="text-sm mt-1">Create modules to organize your materials</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Upload Study Materials</CardTitle>
          <CardDescription>
            Upload PDFs, Word documents, PowerPoint presentations, images, or videos for your students to study
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {modules && modules.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Module (Optional)</label>
              <select
                className="w-full p-2 border rounded-md"
                value={selectedModuleId || ""}
                onChange={(e) => setSelectedModuleId(e.target.value || null)}
                data-testid="select-module"
              >
                <option value="">No Module (General)</option>
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="border-2 border-dashed rounded-md p-6 text-center">
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
            <div className="space-y-2">
              <label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-sm text-primary hover:underline">
                  Choose files
                </span>
                <Input
                  id="file-upload"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.mp4,.mov,.avi,.webm"
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="input-file-upload"
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Supports PDF, Word, PowerPoint, image, and video files
              </p>
            </div>
          </div>

          {selectedFiles && selectedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Selected files:</p>
              <div className="space-y-1">
                {Array.from(selectedFiles).map((file, idx) => (
                  <div key={idx} className="text-sm text-muted-foreground">
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </div>
                ))}
              </div>
              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
                data-testid="button-upload-files"
              >
                {uploadMutation.isPending ? "Uploading..." : "Upload Files"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enrolled Students Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Enrolled Students</CardTitle>
          <CardDescription>
            Manage students enrolled in this course
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter student email"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && studentEmail.trim()) {
                  addStudentMutation.mutate(studentEmail);
                }
              }}
              data-testid="input-student-email"
            />
            <Button
              onClick={() => studentEmail.trim() && addStudentMutation.mutate(studentEmail)}
              disabled={!studentEmail.trim() || addStudentMutation.isPending}
              data-testid="button-add-student"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {addStudentMutation.isPending ? "Adding..." : "Add Student"}
            </Button>
          </div>

          {studentsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : students && students.length > 0 ? (
            <div className="space-y-2">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 border rounded-md"
                  data-testid={`student-item-${student.id}`}
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {student.firstName && student.lastName
                        ? `${student.firstName} ${student.lastName}`
                        : student.email}
                    </div>
                    <div className="text-sm text-muted-foreground">{student.email}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeStudentMutation.mutate(student.id)}
                    disabled={removeStudentMutation.isPending}
                    data-testid={`button-remove-student-${student.id}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No students enrolled yet</p>
              <p className="text-sm mt-1">Add students by entering their email above</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Materials List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Course Materials</CardTitle>
              <CardDescription>
                {materials?.length || 0} file{materials?.length !== 1 ? "s" : ""} uploaded
              </CardDescription>
            </div>
            {materials && materials.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => reprocessMaterialsMutation.mutate()}
                disabled={reprocessMaterialsMutation.isPending}
                data-testid="button-reprocess-materials"
              >
                {reprocessMaterialsMutation.isPending ? "Processing..." : "Extract Text for AI"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {materialsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : materials && materials.length > 0 ? (
            <div className="space-y-6">
              {/* General Materials (no module) */}
              {materials.filter(m => !m.moduleId).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">General Materials</h3>
                  <div className="space-y-2">
                    {materials.filter(m => !m.moduleId).map((material) => (
                      <div
                        key={material.id}
                        className="flex items-center justify-between gap-3 p-4 border rounded-md hover-elevate"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="text-muted-foreground">
                            {getFileIcon(material.fileType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{material.fileName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {material.fileType.toUpperCase()}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {material.uploadedAt ? new Date(material.uploadedAt).toLocaleDateString() : 'Unknown'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={material.moduleId || "none"}
                            onValueChange={(value) => {
                              const newModuleId = value === "none" ? null : value;
                              updateMaterialModuleMutation.mutate({ 
                                materialId: material.id, 
                                moduleId: newModuleId 
                              });
                            }}
                            disabled={updateMaterialModuleMutation.isPending}
                          >
                            <SelectTrigger className="w-[180px]" data-testid={`select-module-${material.id}`}>
                              <SelectValue placeholder="No Module" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Module</SelectItem>
                              {modules?.map((module) => (
                                <SelectItem key={module.id} value={module.id}>
                                  {module.parentModuleId ? `  └─ ${module.name}` : module.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(material.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${material.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Materials organized by module */}
              {modules?.filter(m => !m.parentModuleId).map((parentModule) => {
                const parentMaterials = materials.filter(m => m.moduleId === parentModule.id);
                const childModules = modules.filter(m => m.parentModuleId === parentModule.id);
                const totalMaterialsCount = parentMaterials.length + childModules.reduce((sum, child) => 
                  sum + materials.filter(m => m.moduleId === child.id).length, 0
                );
                
                if (totalMaterialsCount === 0) return null;
                
                const parentIdStr = String(parentModule.id);
                const isParentExpanded = expandedModules.has(parentIdStr);
                const toggleParent = () => {
                  setExpandedModules(prev => {
                    const next = new Set(prev);
                    if (next.has(parentIdStr)) {
                      next.delete(parentIdStr);
                    } else {
                      next.add(parentIdStr);
                    }
                    return next;
                  });
                };
                
                return (
                  <Collapsible key={parentModule.id} open={isParentExpanded} onOpenChange={toggleParent}>
                    <CollapsibleTrigger asChild>
                      <div 
                        className="flex items-center gap-2 mb-2 cursor-pointer hover-elevate p-2 rounded-md"
                        data-testid={`module-toggle-${parentModule.id}`}
                      >
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isParentExpanded ? 'rotate-0' : '-rotate-90'}`} />
                        <Folder className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-medium">{parentModule.name}</h3>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {totalMaterialsCount}
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-3 ml-6">
                        {/* Parent module's own materials */}
                        {parentMaterials.length > 0 && (
                          <div className="space-y-2">
                            {parentMaterials.map((material) => (
                              <div
                                key={material.id}
                                className="flex items-center justify-between gap-3 p-4 border rounded-md hover-elevate"
                              >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className="text-muted-foreground">
                                    {getFileIcon(material.fileType)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{material.fileName}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="secondary" className="text-xs">
                                        {material.fileType.toUpperCase()}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {material.uploadedAt ? new Date(material.uploadedAt).toLocaleDateString() : 'Unknown'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Select
                                    value={material.moduleId || "none"}
                                    onValueChange={(value) => {
                                      const newModuleId = value === "none" ? null : value;
                                      updateMaterialModuleMutation.mutate({ 
                                        materialId: material.id, 
                                        moduleId: newModuleId 
                                      });
                                    }}
                                    disabled={updateMaterialModuleMutation.isPending}
                                  >
                                    <SelectTrigger className="w-[180px]" data-testid={`select-module-${material.id}`}>
                                      <SelectValue placeholder="No Module" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">No Module</SelectItem>
                                      {modules?.map((module) => (
                                        <SelectItem key={module.id} value={module.id}>
                                          {module.parentModuleId ? `  └─ ${module.name}` : module.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteMutation.mutate(material.id)}
                                    disabled={deleteMutation.isPending}
                                    data-testid={`button-delete-${material.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Child modules nested under parent */}
                        {childModules.map((childModule) => {
                          const childMaterials = materials.filter(m => m.moduleId === childModule.id);
                          if (childMaterials.length === 0) return null;
                          
                          const childIdStr = String(childModule.id);
                          const isChildExpanded = expandedModules.has(childIdStr);
                          const toggleChild = () => {
                            setExpandedModules(prev => {
                              const next = new Set(prev);
                              if (next.has(childIdStr)) {
                                next.delete(childIdStr);
                              } else {
                                next.add(childIdStr);
                              }
                              return next;
                            });
                          };
                          
                          return (
                            <Collapsible key={childModule.id} open={isChildExpanded} onOpenChange={toggleChild}>
                              <CollapsibleTrigger asChild>
                                <div 
                                  className="flex items-center gap-2 mb-2 cursor-pointer hover-elevate p-2 rounded-md"
                                  data-testid={`module-toggle-${childModule.id}`}
                                >
                                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isChildExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                  <Folder className="h-4 w-4 text-muted-foreground" />
                                  <h3 className="text-sm font-medium text-muted-foreground">{childModule.name}</h3>
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {childMaterials.length}
                                  </Badge>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="space-y-2 ml-6">
                                  {childMaterials.map((material) => (
                                    <div
                                      key={material.id}
                                      className="flex items-center justify-between gap-3 p-4 border rounded-md hover-elevate"
                                    >
                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="text-muted-foreground">
                                          {getFileIcon(material.fileType)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium truncate">{material.fileName}</p>
                                          <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="secondary" className="text-xs">
                                              {material.fileType.toUpperCase()}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">
                                              {material.uploadedAt ? new Date(material.uploadedAt).toLocaleDateString() : 'Unknown'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Select
                                          value={material.moduleId || "none"}
                                          onValueChange={(value) => {
                                            const newModuleId = value === "none" ? null : value;
                                            updateMaterialModuleMutation.mutate({ 
                                              materialId: material.id, 
                                              moduleId: newModuleId 
                                            });
                                          }}
                                          disabled={updateMaterialModuleMutation.isPending}
                                        >
                                          <SelectTrigger className="w-[180px]" data-testid={`select-module-${material.id}`}>
                                            <SelectValue placeholder="No Module" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="none">No Module</SelectItem>
                                            {modules?.map((module) => (
                                              <SelectItem key={module.id} value={module.id}>
                                                {module.parentModuleId ? `  └─ ${module.name}` : module.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => deleteMutation.mutate(material.id)}
                                          disabled={deleteMutation.isPending}
                                          data-testid={`button-delete-${material.id}`}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No materials uploaded yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
