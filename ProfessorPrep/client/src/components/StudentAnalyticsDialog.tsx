import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { BarChart3, ClipboardList, Target, TrendingUp, Calendar, CheckCircle2, ChevronDown } from "lucide-react";

interface StudentAnalyticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  studentId: string;
  studentName: string;
}

export function StudentAnalyticsDialog({
  open,
  onOpenChange,
  courseId,
  studentId,
  studentName,
}: StudentAnalyticsDialogProps) {
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});

  const { data: analytics, isLoading } = useQuery<any>({
    queryKey: [`/api/courses/${courseId}/students/${studentId}/analytics`],
    enabled: open && !!courseId && !!studentId,
  });

  const toggleModule = (moduleId: string) => {
    setOpenModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{studentName}'s Progress</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : analytics ? (
          <div className="space-y-6">
            {/* Practice Test Analytics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Practice Test Performance
                </CardTitle>
                <CardDescription>
                  Overview of practice test activity and scores
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.practiceTests.totalTests > 0 ? (
                  <div className="space-y-4">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border rounded-md">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <ClipboardList className="h-4 w-4" />
                          <span className="text-sm">Tests Taken</span>
                        </div>
                        <div className="text-2xl font-bold">{analytics.practiceTests.totalTests}</div>
                      </div>
                      <div className="p-4 border rounded-md">
                        <div className="flex items-center gap-2 text-muted-foreground mb-1">
                          <TrendingUp className="h-4 w-4" />
                          <span className="text-sm">Average Score</span>
                        </div>
                        <div className="text-2xl font-bold">{analytics.practiceTests.averageScore}%</div>
                      </div>
                    </div>

                    {/* Recent Tests */}
                    {analytics.practiceTests.recentTests.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Recent Tests
                        </h4>
                        <div className="space-y-2">
                          {analytics.practiceTests.recentTests.map((test: any) => (
                            <div
                              key={test.id}
                              className="flex items-center justify-between p-3 border rounded-md"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">
                                    {test.testMode === 'multiple_choice' ? 'Multiple Choice' :
                                     test.testMode === 'short_answer' ? 'Short Answer' :
                                     test.testMode === 'fill_blank' ? 'Fill in Blank' : 'Mixed'}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">
                                    {test.questionCount} questions
                                  </span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {new Date(test.completedAt).toLocaleDateString()} at{' '}
                                  {new Date(test.completedAt).toLocaleTimeString()}
                                </div>
                              </div>
                              <div className="text-xl font-bold">{test.score}%</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No practice tests completed yet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Learning Objectives Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Learning Objectives Progress
                </CardTitle>
                <CardDescription>
                  Mastery status for course learning objectives
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.learningObjectives.summary.totalObjectives > 0 ? (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="p-4 border rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Overall Mastery</span>
                        <span className="text-sm font-bold">
                          {analytics.learningObjectives.summary.masteredObjectives} / {analytics.learningObjectives.summary.totalObjectives} objectives
                        </span>
                      </div>
                      <Progress value={analytics.learningObjectives.summary.masteryPercentage} className="h-2" />
                      <div className="text-xs text-muted-foreground mt-1 text-right">
                        {analytics.learningObjectives.summary.masteryPercentage}% mastered
                      </div>
                    </div>

                    {/* Per-Module Progress */}
                    <div className="space-y-3">
                      {analytics.learningObjectives.modules.map((module: any) => (
                        <Collapsible
                          key={module.moduleId}
                          open={openModules[module.moduleId]}
                          onOpenChange={() => toggleModule(module.moduleId)}
                        >
                          <div className="border rounded-md">
                            <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                              <h4 className="font-semibold text-left">{module.moduleName}</h4>
                              <ChevronDown
                                className={`h-5 w-5 transition-transform ${
                                  openModules[module.moduleId] ? 'transform rotate-180' : ''
                                }`}
                              />
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="px-4 pb-4">
                                {module.objectivesDefined && module.objectives.length > 0 ? (
                                  <div className="space-y-2">
                                    {module.objectives.map((objective: any) => (
                                      <div
                                        key={objective.objectiveIndex}
                                        className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50"
                                      >
                                        <div className="flex-shrink-0 mt-1">
                                          {objective.status === 'mastered' ? (
                                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                                          ) : objective.status === 'developing' ? (
                                            <div className="h-5 w-5 rounded-full border-2 border-orange-500 bg-orange-500/20" />
                                          ) : (
                                            <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm">{objective.objectiveText}</p>
                                          <div className="flex items-center gap-2 mt-1">
                                            <Badge
                                              variant={
                                                objective.status === 'mastered' ? 'default' :
                                                objective.status === 'developing' ? 'secondary' : 'outline'
                                              }
                                              className={
                                                objective.status === 'mastered' ? 'bg-green-600' :
                                                objective.status === 'developing' ? 'bg-orange-500' : ''
                                              }
                                            >
                                              {objective.status === 'mastered' ? 'Mastered' :
                                               objective.status === 'developing' ? 'Developing' : 'Not Started'}
                                            </Badge>
                                            {objective.totalAttempts > 0 && (
                                              <span className="text-xs text-muted-foreground">
                                                {objective.correctCount}/{objective.totalAttempts} correct
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground text-center py-4">
                                    No learning objectives defined for this module yet
                                  </p>
                                )}
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No learning objectives defined yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>Unable to load student analytics</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
