import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Plus, BookOpen, Trash2, Pencil, GraduationCap, RotateCw, X, FolderPlus, ChevronDown, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type FlashcardSet = {
  id: string;
  courseId: string;
  studentId: string;
  title: string;
  selectedModuleIds: string[] | null;
  createdAt: string;
};

type CourseModule = {
  id: string;
  courseId: string;
  name: string;
  description: string | null;
  parentModuleId: string | null;
  orderIndex: number;
};

type Course = {
  id: string;
  name: string;
  description: string | null;
};

export default function Flashcards() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [cardCount, setCardCount] = useState(20);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectAllModules, setSelectAllModules] = useState(true);
  const [isObjectivesExpanded, setIsObjectivesExpanded] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<FlashcardSet | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const { data: course } = useQuery<Course>({
    queryKey: [`/api/courses/${id}`],
  });

  const { data: modules = [], isLoading: modulesLoading } = useQuery<CourseModule[]>({
    queryKey: [`/api/courses/${id}/modules`],
  });

  const { data: allLearningObjectives = [] } = useQuery<Array<{
    id: string;
    moduleId: string;
    objectives: string[];
    createdAt: Date | null;
  }>>({
    queryKey: [`/api/courses/${id}/learning-objectives`],
  });

  const { data: flashcardSets = [], isLoading, error, refetch } = useQuery<FlashcardSet[]>({
    queryKey: [`/api/courses/${id}/flashcards`],
  });

  const generateMutation = useMutation({
    mutationFn: async (data: { title: string; cardCount: number; moduleIds?: string[] }) => {
      return await apiRequest("POST", `/api/courses/${id}/flashcards/generate`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/courses/${id}/flashcards`] });
      setIsGenerateDialogOpen(false);
      setTitle("");
      setCardCount(20);
      setSelectedModules([]);
      setSelectAllModules(true);
      toast({
        title: "Flashcards generated!",
        description: "Your flashcard set has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Generation failed",
        description: error.message || "Failed to generate flashcards. Please try again.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (setId: string) => {
      return await apiRequest("DELETE", `/api/flashcards/sets/${setId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/courses/${id}/flashcards`] });
      toast({
        title: "Deleted",
        description: "Flashcard set has been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: error.message || "Failed to delete flashcard set.",
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ setId, title }: { setId: string; title: string }) => {
      return await apiRequest("PATCH", `/api/flashcards/sets/${setId}`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/courses/${id}/flashcards`] });
      setIsEditDialogOpen(false);
      setEditingSet(null);
      setEditTitle("");
      toast({
        title: "Updated",
        description: "Flashcard set has been renamed.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message || "Failed to update flashcard set.",
      });
    },
  });

  const handleEditSet = (set: FlashcardSet) => {
    setEditingSet(set);
    setEditTitle(set.title);
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingSet || !editTitle.trim()) {
      toast({
        variant: "destructive",
        title: "Title required",
        description: "Please enter a title for your flashcard set.",
      });
      return;
    }
    editMutation.mutate({ setId: editingSet.id, title: editTitle.trim() });
  };

  const handleGenerateFlashcards = () => {
    if (!title.trim()) {
      toast({
        variant: "destructive",
        title: "Title required",
        description: "Please enter a title for your flashcard set.",
      });
      return;
    }

    const moduleIds = selectAllModules ? undefined : selectedModules;
    generateMutation.mutate({ title: title.trim(), cardCount, moduleIds });
  };

  const toggleModule = (moduleId: string) => {
    setSelectedModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const toggleSelectAll = () => {
    if (selectAllModules) {
      setSelectAllModules(false);
      setSelectedModules([]);
    } else {
      setSelectAllModules(true);
      setSelectedModules(modules.map(m => m.id));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <X className="w-12 h-12 text-destructive" />
            <div className="text-center">
              <p className="font-medium text-lg" data-testid="text-error">Error Loading Flashcard Sets</p>
              <p className="text-sm text-muted-foreground mt-1">
                {(error as any).message || "Failed to load flashcard sets. Please try again."}
              </p>
            </div>
            <Button
              onClick={() => refetch()}
              data-testid="button-retry"
            >
              <RotateCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-flashcards">
            Flashcards
          </h1>
          <p className="text-muted-foreground" data-testid="text-course-name">
            {course?.name}
          </p>
        </div>
        <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-generate-flashcards">
              <Plus className="w-4 h-4 mr-2" />
              Generate Flashcards
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-generate">
            <DialogHeader>
              <DialogTitle>Generate New Flashcard Set</DialogTitle>
              <DialogDescription>
                AI will create flashcards based on your course materials to help you study.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Set Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Chapter 5 Review"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="input-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cardCount">Number of Cards</Label>
                <Input
                  id="cardCount"
                  type="number"
                  min={5}
                  max={50}
                  value={cardCount}
                  onChange={(e) => setCardCount(parseInt(e.target.value) || 20)}
                  data-testid="input-card-count"
                />
              </div>
              {modulesLoading ? (
                <div className="space-y-2">
                  <Label>Modules/Weeks to Include</Label>
                  <div className="flex items-center justify-center p-6 border rounded-md">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading modules...</span>
                  </div>
                </div>
              ) : modules.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Modules/Weeks to Include</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleSelectAll}
                      data-testid="button-toggle-modules"
                    >
                      {selectAllModules ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                    {modules.filter(m => !m.parentModuleId).map((parentModule) => {
                      const childModules = modules.filter(m => m.parentModuleId === parentModule.id);
                      return (
                        <div key={parentModule.id} className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`module-${parentModule.id}`}
                              checked={selectAllModules || selectedModules.includes(parentModule.id)}
                              onCheckedChange={() => {
                                if (selectAllModules) {
                                  setSelectAllModules(false);
                                  setSelectedModules(modules.filter(m => m.id !== parentModule.id).map(m => m.id));
                                } else {
                                  toggleModule(parentModule.id);
                                }
                              }}
                              data-testid={`checkbox-module-${parentModule.id}`}
                            />
                            <Label
                              htmlFor={`module-${parentModule.id}`}
                              className="text-sm font-medium cursor-pointer flex items-center gap-1"
                            >
                              <FolderPlus className="h-3.5 w-3.5" />
                              {parentModule.name}
                            </Label>
                          </div>
                          {childModules.length > 0 && (
                            <div className="ml-6 space-y-1 border-l-2 border-border pl-2">
                              {childModules.map((childModule) => (
                                <div key={childModule.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`module-${childModule.id}`}
                                    checked={selectAllModules || selectedModules.includes(childModule.id)}
                                    onCheckedChange={() => {
                                      if (selectAllModules) {
                                        setSelectAllModules(false);
                                        setSelectedModules(modules.filter(m => m.id !== childModule.id).map(m => m.id));
                                      } else {
                                        toggleModule(childModule.id);
                                      }
                                    }}
                                    data-testid={`checkbox-module-${childModule.id}`}
                                  />
                                  <Label
                                    htmlFor={`module-${childModule.id}`}
                                    className="text-sm font-normal cursor-pointer"
                                  >
                                    {childModule.name}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Learning Objectives Section */}
              {(() => {
                const relevantModuleIds = selectAllModules 
                  ? modules.map(m => m.id) 
                  : selectedModules;
                const relevantObjectives = allLearningObjectives.filter(obj => 
                  relevantModuleIds.includes(obj.moduleId)
                );
                
                if (relevantObjectives.length > 0) {
                  return (
                    <Collapsible open={isObjectivesExpanded} onOpenChange={setIsObjectivesExpanded}>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center gap-2 cursor-pointer hover-elevate p-2 rounded-md">
                          <ChevronDown className={`h-4 w-4 transition-transform ${isObjectivesExpanded ? 'rotate-0' : '-rotate-90'}`} />
                          <Target className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Learning Objectives</span>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 p-3 bg-muted/20 rounded-md border space-y-3">
                          {relevantObjectives.map((objData) => {
                            const module = modules.find(m => m.id === objData.moduleId);
                            return (
                              <div key={objData.id}>
                                <h5 className="text-xs font-semibold text-muted-foreground mb-1">{module?.name}</h5>
                                <ul className="space-y-1 text-sm">
                                  {objData.objectives.map((objective, idx) => (
                                    <li key={idx} className="flex gap-2">
                                      <span className="text-muted-foreground">{idx + 1}.</span>
                                      <span>{objective}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                }
                return null;
              })()}
            </div>
            <DialogFooter>
              <Button
                onClick={handleGenerateFlashcards}
                disabled={generateMutation.isPending}
                data-testid="button-submit-generate"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <GraduationCap className="w-4 h-4 mr-2" />
                    Generate Flashcards
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {flashcardSets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2" data-testid="text-no-sets">
              No flashcard sets yet
            </h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Generate AI-powered flashcards to help you study and prepare for exams.
            </p>
            <Button onClick={() => setIsGenerateDialogOpen(true)} data-testid="button-create-first">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Set
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {flashcardSets.map((set) => (
            <Card key={set.id} className="hover-elevate" data-testid={`card-set-${set.id}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate">{set.title}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditSet(set)}
                      data-testid={`button-edit-${set.id}`}
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(set.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${set.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  Created {new Date(set.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={`/student/courses/${id}/flashcards/${set.id}`}>
                  <Button className="w-full" data-testid={`button-study-${set.id}`}>
                    <BookOpen className="w-4 h-4 mr-2" />
                    Study Cards
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Flashcard Set</DialogTitle>
            <DialogDescription>
              Change the name of your flashcard set.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Enter a new title"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingSet(null);
                setEditTitle("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={editMutation.isPending || !editTitle.trim()}
            >
              {editMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
