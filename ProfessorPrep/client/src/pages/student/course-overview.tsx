import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BookOpen, Target, Calendar, ChevronDown, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type Course = {
  id: string;
  name: string;
  description: string | null;
  professorId: string;
  code: string | null;
};

type CourseModule = {
  id: string;
  name: string;
  description: string | null;
  parentModuleId: string | null;
};

type ModuleItemProps = {
  module: CourseModule;
  childModules: CourseModule[];
  objectives: Array<{ id: string; moduleId: string; objectives: string[] }>;
};

function ModuleItem({ module, childModules, objectives }: ModuleItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const moduleObjectives = objectives.find(obj => obj.moduleId === module.id);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      data-testid={`module-${module.id}`}
    >
      <div className="border rounded-md">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start p-4 h-auto font-semibold hover-elevate"
            data-testid={`button-toggle-module-${module.id}`}
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4 mr-2 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 mr-2 flex-shrink-0" />
            )}
            <span className="text-left">{module.name}</span>
            {moduleObjectives && moduleObjectives.objectives.length > 0 && (
              <span className="ml-auto text-xs text-muted-foreground font-normal">
                {moduleObjectives.objectives.length} objectives
              </span>
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-2 space-y-3">
            {module.description && (
              <p className="text-sm text-muted-foreground">
                {module.description}
              </p>
            )}
            {childModules.length > 0 && (
              <div className="space-y-2 pl-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Sub-modules
                </p>
                {childModules.map((child) => {
                  const childObjectives = objectives.find(obj => obj.moduleId === child.id);
                  return (
                    <div key={child.id} className="text-sm border-l-2 border-border pl-3 py-1">
                      <div className="font-medium">{child.name}</div>
                      {child.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {child.description}
                        </p>
                      )}
                      {childObjectives && childObjectives.objectives.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {childObjectives.objectives.length} objectives
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default function CourseOverview() {
  const { id } = useParams<{ id: string }>();
  const [isObjectivesExpanded, setIsObjectivesExpanded] = useState(false);
  const [expandedObjectiveModules, setExpandedObjectiveModules] = useState<Set<string>>(new Set());

  const { data: course, isLoading: courseLoading } = useQuery<Course>({
    queryKey: [`/api/courses/${id}`],
  });

  const { data: modules = [], isLoading: modulesLoading } = useQuery<CourseModule[]>({
    queryKey: [`/api/courses/${id}/modules`],
  });

  const { data: objectives = [] } = useQuery<Array<{
    id: string;
    moduleId: string;
    objectives: string[];
  }>>({
    queryKey: [`/api/courses/${id}/learning-objectives`],
  });

  const { data: progressData } = useQuery<{
    progress: Array<{
      moduleId: string;
      objectivesDefined: boolean;
      objectives: Array<{
        moduleId: string;
        objectiveIndex: number;
        objectiveText: string;
        correctCount: number;
        totalCount: number;
        masteryPercentage: number;
        lastEncountered: Date | null;
        status: string;
        explanation: string;
        recommendation: string;
      }>;
    }>;
  }>({
    queryKey: [`/api/courses/${id}/student-progress`],
  });

  // Create a map for quick lookup of mastery data
  const masteryMap = new Map<string, {
    correctCount: number;
    totalCount: number;
    masteryPercentage: number;
    status: string;
    explanation: string;
    recommendation: string;
  }>();
  
  if (progressData?.progress) {
    progressData.progress.forEach(moduleProgress => {
      moduleProgress.objectives.forEach(obj => {
        const key = `${obj.moduleId}-${obj.objectiveIndex}`;
        masteryMap.set(key, {
          correctCount: obj.correctCount,
          totalCount: obj.totalCount,
          masteryPercentage: obj.masteryPercentage,
          status: obj.status,
          explanation: obj.explanation,
          recommendation: obj.recommendation,
        });
      });
    });
  }

  const getMasteryColor = (status: string) => {
    if (status === 'mastered') return 'bg-green-500';
    if (status === 'approaching') return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getMasteryTextColor = (status: string) => {
    if (status === 'mastered') return 'text-green-600';
    if (status === 'approaching') return 'text-yellow-600';
    return 'text-red-600';
  };

  const getMasteryLabel = (status: string) => {
    if (status === 'mastered') return 'Mastered';
    if (status === 'approaching') return 'Approaching Mastery';
    return 'Developing';
  };

  const toggleObjectiveModule = (moduleId: string) => {
    setExpandedObjectiveModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  if (courseLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const parentModules = modules.filter(m => !m.parentModuleId);
  const totalObjectives = objectives.reduce((sum, obj) => sum + obj.objectives.length, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Course Header */}
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-course-name">
          {course?.name}
        </h1>
        {course?.code && (
          <p className="text-muted-foreground mt-1" data-testid="text-course-code">
            {course.code}
          </p>
        )}
        {course?.description && (
          <p className="mt-4 text-foreground" data-testid="text-course-description">
            {course.description}
          </p>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-modules">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Modules</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{modulesLoading ? "-" : parentModules.length}</div>
            <p className="text-xs text-muted-foreground">
              Course modules available
            </p>
          </CardContent>
        </Card>

        <Card 
          data-testid="card-objectives"
          className="cursor-pointer hover-elevate transition-shadow"
          onClick={() => setIsObjectivesExpanded(!isObjectivesExpanded)}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Learning Objectives</CardTitle>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              {isObjectivesExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalObjectives}</div>
            <p className="text-xs text-muted-foreground">
              Click to view by module
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-materials">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Study Tools</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4</div>
            <p className="text-xs text-muted-foreground">
              Tools available to study
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Learning Objectives by Module - Expanded View */}
      {isObjectivesExpanded && !modulesLoading && (
        <Card data-testid="card-objectives-expanded">
          <CardHeader>
            <CardTitle>Learning Objectives by Module</CardTitle>
            <CardDescription>View all learning objectives organized by module and week</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {parentModules.map((parentModule) => {
              const childModules = modules.filter(m => m.parentModuleId === parentModule.id);
              const parentObjectives = objectives.find(obj => obj.moduleId === parentModule.id);
              const isParentExpanded = expandedObjectiveModules.has(parentModule.id);

              return (
                <div key={parentModule.id} className="border rounded-md">
                  <Collapsible
                    open={isParentExpanded}
                    onOpenChange={() => toggleObjectiveModule(parentModule.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-start p-4 h-auto font-semibold hover-elevate"
                      >
                        {isParentExpanded ? (
                          <ChevronDown className="h-4 w-4 mr-2 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 mr-2 flex-shrink-0" />
                        )}
                        <BookOpen className="h-4 w-4 mr-2 text-primary flex-shrink-0" />
                        <span className="text-left">{parentModule.name}</span>
                        {parentObjectives && parentObjectives.objectives.length > 0 && (
                          <span className="ml-auto text-xs text-muted-foreground font-normal">
                            {parentObjectives.objectives.length} objectives
                          </span>
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 space-y-3">
                        {/* Parent Module Objectives */}
                        {parentObjectives && parentObjectives.objectives.length > 0 && (
                          <div className="bg-muted/30 rounded-md p-3">
                            <h4 className="text-sm font-semibold mb-2">Module Objectives</h4>
                            <ul className="space-y-3">
                              {parentObjectives.objectives.map((objective, idx) => {
                                const masteryKey = `${parentModule.id}-${idx}`;
                                const mastery = masteryMap.get(masteryKey);
                                
                                return (
                                  <li key={idx} className="space-y-1.5">
                                    <div className="flex gap-2 text-sm">
                                      <span className="text-muted-foreground flex-shrink-0">{idx + 1}.</span>
                                      <span className="flex-1">{objective}</span>
                                    </div>
                                    <div className="ml-6 space-y-2">
                                      {mastery && mastery.totalCount > 0 ? (
                                        <>
                                          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                            <div
                                              className={`h-full transition-all ${getMasteryColor(mastery.status)}`}
                                              style={{ width: `${mastery.masteryPercentage}%` }}
                                            />
                                          </div>
                                          <div className="flex justify-between text-xs">
                                            <span className={`font-semibold ${getMasteryTextColor(mastery.status)}`}>
                                              {getMasteryLabel(mastery.status)}
                                            </span>
                                            <span className="text-muted-foreground">
                                              {mastery.correctCount}/{mastery.totalCount} correct
                                            </span>
                                          </div>
                                          <p className="text-xs text-muted-foreground leading-relaxed">{mastery.explanation}</p>
                                          <p className="text-xs text-foreground"><span className="font-medium">Next step:</span> {mastery.recommendation}</p>
                                        </>
                                      ) : (
                                        <div className="text-xs text-muted-foreground italic">
                                          Not yet attempted
                                        </div>
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}

                        {/* Child Modules (Weeks) */}
                        {childModules.length > 0 && (
                          <div className="space-y-2 pl-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              Weeks / Sub-modules
                            </p>
                            {childModules.map((childModule) => {
                              const childObjectives = objectives.find(obj => obj.moduleId === childModule.id);
                              const isChildExpanded = expandedObjectiveModules.has(childModule.id);

                              return (
                                <div key={childModule.id}>
                                  <Collapsible
                                    open={isChildExpanded}
                                    onOpenChange={() => toggleObjectiveModule(childModule.id)}
                                  >
                                    <div className="border-l-2 border-border">
                                      <CollapsibleTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          className="w-full justify-start p-3 h-auto text-sm hover-elevate"
                                        >
                                          {isChildExpanded ? (
                                            <ChevronDown className="h-3 w-3 mr-2 flex-shrink-0" />
                                          ) : (
                                            <ChevronRight className="h-3 w-3 mr-2 flex-shrink-0" />
                                          )}
                                          <Calendar className="h-3 w-3 mr-2 text-muted-foreground flex-shrink-0" />
                                          <span className="text-left font-medium">{childModule.name}</span>
                                          {childObjectives && childObjectives.objectives.length > 0 && (
                                            <span className="ml-auto text-xs text-muted-foreground font-normal">
                                              {childObjectives.objectives.length} objectives
                                            </span>
                                          )}
                                        </Button>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent>
                                        <div className="pl-6 pr-3 pb-3">
                                          {childObjectives && childObjectives.objectives.length > 0 ? (
                                            <div className="bg-muted/20 rounded-md p-3">
                                              <ul className="space-y-3">
                                                {childObjectives.objectives.map((objective, idx) => {
                                                  const masteryKey = `${childModule.id}-${idx}`;
                                                  const mastery = masteryMap.get(masteryKey);
                                                  
                                                  return (
                                                    <li key={idx} className="space-y-1.5">
                                                      <div className="flex gap-2 text-sm">
                                                        <span className="text-muted-foreground flex-shrink-0">{idx + 1}.</span>
                                                        <span className="flex-1">{objective}</span>
                                                      </div>
                                                      <div className="ml-6 space-y-2">
                                                        {mastery && mastery.totalCount > 0 ? (
                                                          <>
                                                            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                                              <div
                                                                className={`h-full transition-all ${getMasteryColor(mastery.status)}`}
                                                                style={{ width: `${mastery.masteryPercentage}%` }}
                                                              />
                                                            </div>
                                                            <div className="flex justify-between text-xs">
                                                              <span className={`font-semibold ${getMasteryTextColor(mastery.status)}`}>
                                                                {getMasteryLabel(mastery.status)}
                                                              </span>
                                                              <span className="text-muted-foreground">
                                                                {mastery.correctCount}/{mastery.totalCount} correct
                                                              </span>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground leading-relaxed">{mastery.explanation}</p>
                                                            <p className="text-xs text-foreground"><span className="font-medium">Next step:</span> {mastery.recommendation}</p>
                                                          </>
                                                        ) : (
                                                          <div className="text-xs text-muted-foreground italic">
                                                            Not yet attempted
                                                          </div>
                                                        )}
                                                      </div>
                                                    </li>
                                                  );
                                                })}
                                              </ul>
                                            </div>
                                          ) : (
                                            <p className="text-xs text-muted-foreground italic pl-3">
                                              No learning objectives yet
                                            </p>
                                          )}
                                        </div>
                                      </CollapsibleContent>
                                    </div>
                                  </Collapsible>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {!parentObjectives?.objectives.length && childModules.length === 0 && (
                          <p className="text-sm text-muted-foreground italic text-center py-2">
                            No learning objectives yet
                          </p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}
            
            {parentModules.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No modules with learning objectives yet</p>
                <p className="text-sm mt-1">Learning objectives will appear as your professor adds course materials</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modules List */}
      {!modulesLoading && parentModules.length > 0 && (
        <Card data-testid="card-modules-list">
          <CardHeader>
            <CardTitle>Course Modules</CardTitle>
            <CardDescription>Organized learning modules for this course</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {parentModules.map((module) => {
              const childModules = modules.filter(m => m.parentModuleId === module.id);
              return (
                <ModuleItem
                  key={module.id}
                  module={module}
                  childModules={childModules}
                  objectives={objectives}
                />
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
