import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Upload, FileText, File, Image as ImageIcon, Trash2, Video, FolderPlus, Folder, Presentation, ChevronDown, ArrowLeft, ShieldAlert } from "lucide-react";
import { Link, useParams, useLocation, Redirect } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Course, CourseMaterial, CourseModule } from "@shared/schema";

export default function BuildStudyRoom() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [newModuleName, setNewModuleName] = useState("");
  const [selectedParentModuleId, setSelectedParentModuleId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [isModulesListExpanded, setIsModulesListExpanded] = useState(false);

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

  const { data: course, isLoading: courseLoading, error: courseError } = useQuery<Course>({
    queryKey: ["/api/courses", id],
    enabled: isAuthenticated && !!id,
  });

  const isSelfStudyRoom = course?.courseType === "self-study";
  const isOwner = course?.ownerId === user?.id;
  const hasAccess = isSelfStudyRoom && isOwner;
  const isAccessDenied = courseError && (courseError as any)?.message?.includes("403");

  const { data: materials, isLoading: materialsLoading } = useQuery<CourseMaterial[]>({
    queryKey: ["/api/courses", id, "materials"],
    enabled: isAuthenticated && !!id && hasAccess,
  });

  const { data: modules, isLoading: modulesLoading } = useQuery<CourseModule[]>({
    queryKey: ["/api/courses", id, "modules"],
    enabled: isAuthenticated && !!id && hasAccess,
  });

  const { data: allLearningObjectives } = useQuery<Array<{
    id: string;
    moduleId: string;
    objectives: string[];
    createdAt: Date | null;
  }>>({
    queryKey: ["/api/courses", id, "learning-objectives"],
    enabled: isAuthenticated && !!id && hasAccess,
  });

  useEffect(() => {
    if (!hasAccess || !id || !modules || !materials || !allLearningObjectives) return;
    
    const modulesNeedingObjectives = modules.filter(module => {
      const hasMaterials = materials.some(m => m.moduleId === module.id && m.extractedText);
      const hasObjectives = allLearningObjectives.some(obj => obj.moduleId === module.id);
      return hasMaterials && !hasObjectives;
    });

    if (modulesNeedingObjectives.length > 0) {
      apiRequest("POST", `/api/courses/${id}/learning-objectives/generate-all`, {})
        .then(() => {
          console.log(`Auto-generating objectives for ${modulesNeedingObjectives.length} modules`);
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["/api/courses", id, "learning-objectives"] });
          }, 5000);
        })
        .catch(err => {
          console.error("Failed to auto-generate objectives:", err);
        });
    }
  }, [hasAccess, id, modules, materials, allLearningObjectives]);

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
          window.location.href = "/sign-in";
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
          window.location.href = "/sign-in";
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
          window.location.href = "/sign-in";
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
          window.location.href = "/sign-in";
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

  const deleteModuleMutation = useMutation({
    mutationFn: async (moduleId: string) => {
      return await apiRequest("DELETE", `/api/courses/${id}/modules/${moduleId}`, undefined);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Module deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/courses", id, "modules"] });
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
          window.location.href = "/sign-in";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to delete module",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(e.target.files);
    }
  };

  const handleUpload = () => {
    if (selectedFiles) {
      uploadMutation.mutate(selectedFiles);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />;
    if (fileType.includes("word") || fileType.includes("docx") || fileType.includes("doc")) return <FileText className="h-5 w-5 text-blue-500" />;
    if (fileType.includes("presentation") || fileType.includes("pptx") || fileType.includes("ppt")) return <Presentation className="h-5 w-5 text-orange-500" />;
    if (fileType.includes("image")) return <ImageIcon className="h-5 w-5 text-green-500" />;
    if (fileType.includes("video")) return <Video className="h-5 w-5 text-purple-500" />;
    return <File className="h-5 w-5" />;
  };

  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const getModuleMaterials = (moduleId: string | null) => {
    if (!materials) return [];
    return materials.filter(m => m.moduleId === moduleId);
  };

  const renderModuleTree = (parentId: string | null, depth: number = 0) => {
    if (!modules) return null;
    
    const childModules = modules.filter(m => m.parentModuleId === parentId);
    if (childModules.length === 0) return null;

    return childModules.map((module) => {
      const moduleMaterials = getModuleMaterials(module.id);
      const hasChildren = modules.some(m => m.parentModuleId === module.id);
      const isExpanded = expandedModules.has(module.id);

      return (
        <div key={module.id} style={{ marginLeft: `${depth * 16}px` }}>
          <Collapsible open={isExpanded} onOpenChange={() => toggleModule(module.id)}>
            <div className="flex items-center justify-between p-2 border rounded-md mb-1 bg-muted/30 hover-elevate">
              <CollapsibleTrigger asChild>
                <div className="flex items-center gap-2 cursor-pointer flex-1">
                  {(hasChildren || moduleMaterials.length > 0) && (
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                  )}
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{module.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {moduleMaterials.length} files
                  </Badge>
                </div>
              </CollapsibleTrigger>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Module</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{module.name}"? This will also delete all sub-modules and move files to "No Module".
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteModuleMutation.mutate(module.id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <CollapsibleContent>
              <div className="ml-6 space-y-1">
                {moduleMaterials.map((material) => (
                  <div
                    key={material.id}
                    className="flex items-center justify-between p-2 border rounded-md bg-background"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getFileIcon(material.fileType)}
                      <span className="text-sm truncate">{material.fileName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Select
                        value={material.moduleId || "none"}
                        onValueChange={(value) => {
                          updateMaterialModuleMutation.mutate({
                            materialId: material.id,
                            moduleId: value === "none" ? null : value,
                          });
                        }}
                      >
                        <SelectTrigger className="h-8 w-32">
                          <SelectValue placeholder="Move to..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Module</SelectItem>
                          {modules.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Material</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{material.fileName}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(material.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
                {renderModuleTree(module.id, depth + 1)}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      );
    });
  };

  if (authLoading || courseLoading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-4 w-96 mb-8" />
        <Skeleton className="h-64 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isAccessDenied || !course || !hasAccess) {
    const isNotFound = !course && !isAccessDenied;
    
    const getAccessMessage = () => {
      if (isAccessDenied) return "You don't have permission to access this study room.";
      if (!course) return "Study room not found.";
      if (!isSelfStudyRoom) return "This feature is only available for self-study rooms.";
      if (!isOwner) return "You don't have permission to manage this study room.";
      return "Access denied.";
    };

    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-3 bg-destructive/10 rounded-full">
                <ShieldAlert className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{isNotFound ? "Not Found" : "Access Denied"}</h2>
                <p className="text-muted-foreground mt-1">
                  {getAccessMessage()}
                </p>
              </div>
              <Button asChild>
                <Link href={course ? `/student/courses/${id}` : "/"}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {course ? "Back to Overview" : "Back to Dashboard"}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const unorganizedMaterials = getModuleMaterials(null);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{course.name}</h1>
        <p className="text-muted-foreground">Build and organize your study room</p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Course Modules</CardTitle>
          <CardDescription>
            Organize your study materials into sections
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
                placeholder={selectedParentModuleId ? "Enter sub-module name" : "Enter module name (e.g., Chapter 1, Introduction)"}
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
                <Button variant="ghost" className="w-full justify-between p-2">
                  <span className="text-sm font-medium">
                    {modules.length} module{modules.length !== 1 ? 's' : ''} created
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isModulesListExpanded ? 'rotate-0' : '-rotate-90'}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {renderModuleTree(null)}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No modules yet. Create one above to organize your materials.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Upload Study Materials</CardTitle>
          <CardDescription>
            Upload PDFs, Word documents, PowerPoint presentations, images, or videos to study
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
                className="w-full"
                data-testid="button-upload"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadMutation.isPending ? "Uploading..." : "Upload Files"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uploaded Materials</CardTitle>
          <CardDescription>
            Manage and organize your study materials
          </CardDescription>
        </CardHeader>
        <CardContent>
          {materialsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : materials && materials.length > 0 ? (
            <div className="space-y-4">
              {unorganizedMaterials.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Unorganized Materials</h4>
                  {unorganizedMaterials.map((material) => (
                    <div
                      key={material.id}
                      className="flex items-center justify-between p-3 border rounded-md"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {getFileIcon(material.fileType)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{material.fileName}</p>
                          <Badge variant="secondary" className="text-xs">
                            {material.fileType.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {modules && modules.length > 0 && (
                          <Select
                            value="none"
                            onValueChange={(value) => {
                              if (value !== "none") {
                                updateMaterialModuleMutation.mutate({
                                  materialId: material.id,
                                  moduleId: value,
                                });
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 w-32">
                              <SelectValue placeholder="Move to..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" disabled>Move to...</SelectItem>
                              {modules.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Material</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{material.fileName}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(material.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {modules && modules.filter(m => !m.parentModuleId).map((module) => {
                const moduleMaterials = getModuleMaterials(module.id);
                const hasSubModules = modules.some(m => m.parentModuleId === module.id);
                
                if (moduleMaterials.length === 0 && !hasSubModules) return null;

                return (
                  <Collapsible
                    key={module.id}
                    open={expandedModules.has(module.id)}
                    onOpenChange={() => toggleModule(module.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-2 p-3 border rounded-md cursor-pointer hover-elevate">
                        <ChevronDown className={`h-4 w-4 transition-transform ${expandedModules.has(module.id) ? 'rotate-0' : '-rotate-90'}`} />
                        <Folder className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{module.name}</span>
                        <Badge variant="secondary" className="ml-auto">
                          {moduleMaterials.length} files
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-6 mt-2 space-y-2">
                        {moduleMaterials.map((material) => (
                          <div
                            key={material.id}
                            className="flex items-center justify-between p-2 border rounded-md"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {getFileIcon(material.fileType)}
                              <span className="text-sm truncate">{material.fileName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Select
                                value={material.moduleId || "none"}
                                onValueChange={(value) => {
                                  updateMaterialModuleMutation.mutate({
                                    materialId: material.id,
                                    moduleId: value === "none" ? null : value,
                                  });
                                }}
                              >
                                <SelectTrigger className="h-8 w-32">
                                  <SelectValue placeholder="Move..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No Module</SelectItem>
                                  {modules.map((m) => (
                                    <SelectItem key={m.id} value={m.id}>
                                      {m.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Material</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{material.fileName}"?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteMutation.mutate(material.id)}>
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        ))}
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
              <p className="text-sm">Upload files above to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
