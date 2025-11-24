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

        <Card data-testid="card-objectives">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Learning Objectives</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalObjectives}</div>
            <p className="text-xs text-muted-foreground">
              Objectives to master
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
