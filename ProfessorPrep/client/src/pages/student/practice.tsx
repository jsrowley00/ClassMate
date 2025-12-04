import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Brain, Check, X, FolderOpen, MessageSquare, BookOpen } from "lucide-react";
import { Link, useParams } from "wouter";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Course, CourseModule } from "@shared/schema";

type TextbookChapter = {
  id: string;
  title: string;
  chapterNumber: number;
  startPage: number | null;
  endPage: number | null;
};

type TextbookWithChapters = {
  id: string;
  courseId: string;
  title: string;
  chapters: TextbookChapter[];
};

export default function PracticeTest() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [testMode, setTestMode] = useState<string>("multiple_choice");
  const [questionCount, setQuestionCount] = useState<string>("10");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [currentTest, setCurrentTest] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [showResults, setShowResults] = useState(false);

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

  const { data: course, isLoading: courseLoading } = useQuery<Course>({
    queryKey: ["/api/courses", id],
    enabled: isAuthenticated && !!id,
  });

  const { data: modules = [], isLoading: modulesLoading } = useQuery<CourseModule[]>({
    queryKey: ["/api/courses", id, "modules"],
    enabled: isAuthenticated && !!id,
  });

  const { data: textbooks = [] } = useQuery<TextbookWithChapters[]>({
    queryKey: [`/api/courses/${id}/textbooks`],
    enabled: isAuthenticated && !!id,
  });

  const generateTestMutation = useMutation({
    mutationFn: async ({ mode, count, moduleIds, textbookChapterIds }: { mode: string; count: number; moduleIds?: string[]; textbookChapterIds?: string[] }) => {
      return await apiRequest("POST", `/api/courses/${id}/practice/generate`, { 
        testMode: mode,
        questionCount: count,
        moduleIds: moduleIds && moduleIds.length > 0 ? moduleIds : undefined,
        textbookChapterIds: textbookChapterIds && textbookChapterIds.length > 0 ? textbookChapterIds : undefined
      });
    },
    onSuccess: (data: any) => {
      if (!data.questions || data.questions.length === 0) {
        toast({
          title: "Error",
          description: "No questions were generated. Please try again.",
          variant: "destructive",
        });
        return;
      }
      setCurrentTest(data);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setShowResults(false);
      toast({
        title: "Success",
        description: "Practice test generated successfully",
      });
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
        description: error.message || "Failed to generate practice test",
        variant: "destructive",
      });
    },
  });

  const submitTestMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/practice-tests/${currentTest.id}/submit`, { answers });
    },
    onSuccess: (data: any) => {
      setCurrentTest(data);
      setShowResults(true);
      toast({
        title: "Test Submitted",
        description: `You scored ${data.score}%`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/student/practice-tests"] });
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
        description: error.message || "Failed to submit test",
        variant: "destructive",
      });
    },
  });

  const handleAnswerChange = (value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: value,
    }));
  };

  const handleNext = () => {
    if (currentTest?.questions && currentQuestionIndex < currentTest.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = () => {
    submitTestMutation.mutate();
  };

  if (authLoading || !isAuthenticated) {
    return null;
  }

  if (courseLoading) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48 mb-8" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <p>Course not found</p>
      </div>
    );
  }

  const currentQuestion = currentTest?.questions?.[currentQuestionIndex];

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-6" data-testid="button-back">
        <Link href="/">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Courses
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{course.name}</h1>
        <p className="text-muted-foreground">Practice Test</p>
      </div>

      {!currentTest ? (
        <Card>
          <CardHeader>
            <CardTitle>Generate Practice Test</CardTitle>
            <CardDescription>
              Choose a test mode and generate AI-powered practice questions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="test-mode">Test Mode</Label>
                <Select value={testMode} onValueChange={setTestMode}>
                  <SelectTrigger id="test-mode" data-testid="select-test-mode">
                    <SelectValue placeholder="Select test mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="short_answer">Short Answer</SelectItem>
                    <SelectItem value="fill_blank">Fill in the Blank</SelectItem>
                    <SelectItem value="mixed">Mixed (All Types)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="question-count">Number of Questions</Label>
                <Select value={questionCount} onValueChange={setQuestionCount}>
                  <SelectTrigger id="question-count" data-testid="select-question-count">
                    <SelectValue placeholder="Select number" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 Questions</SelectItem>
                    <SelectItem value="10">10 Questions</SelectItem>
                    <SelectItem value="15">15 Questions</SelectItem>
                    <SelectItem value="20">20 Questions</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {modules.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Select Modules/Weeks to Practice</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (selectedModules.length === modules.length) {
                        setSelectedModules([]);
                      } else {
                        setSelectedModules(modules.map(m => m.id));
                      }
                    }}
                    data-testid="button-toggle-all-modules"
                  >
                    {selectedModules.length === modules.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Leave all unchecked to practice from all materials. Select parent modules to include all their weeks.
                </p>
                <div className="space-y-2 p-4 rounded-md border">
                  {modules.filter(m => !m.parentModuleId).map((parentModule) => {
                    const childModules = modules.filter(m => m.parentModuleId === parentModule.id);
                    return (
                      <div key={parentModule.id} className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`module-${parentModule.id}`}
                            checked={selectedModules.includes(parentModule.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                // When checking parent, also check all child modules (weeks)
                                const childIds = childModules.map(c => c.id);
                                setSelectedModules([...selectedModules, parentModule.id, ...childIds]);
                              } else {
                                // When unchecking parent, also uncheck all child modules (weeks)
                                const childIds = childModules.map(c => c.id);
                                setSelectedModules(selectedModules.filter(id => 
                                  id !== parentModule.id && !childIds.includes(id)
                                ));
                              }
                            }}
                            data-testid={`checkbox-module-${parentModule.id}`}
                          />
                          <Label
                            htmlFor={`module-${parentModule.id}`}
                            className="text-sm font-medium cursor-pointer flex items-center gap-2"
                          >
                            <FolderOpen className="h-4 w-4 text-primary" />
                            {parentModule.name}
                          </Label>
                        </div>
                        {childModules.length > 0 && (
                          <div className="ml-6 space-y-1 border-l-2 border-border pl-3">
                            {childModules.map((childModule) => (
                              <div key={childModule.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`module-${childModule.id}`}
                                  checked={selectedModules.includes(childModule.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedModules([...selectedModules, childModule.id]);
                                    } else {
                                      setSelectedModules(selectedModules.filter(id => id !== childModule.id));
                                    }
                                  }}
                                  data-testid={`checkbox-module-${childModule.id}`}
                                />
                                <Label
                                  htmlFor={`module-${childModule.id}`}
                                  className="text-sm font-normal cursor-pointer flex items-center gap-2"
                                >
                                  <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
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

            {textbooks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Select Textbook Chapters to Practice</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const allChapterIds = textbooks.flatMap(tb => tb.chapters.map(ch => ch.id));
                      if (selectedChapters.length === allChapterIds.length) {
                        setSelectedChapters([]);
                      } else {
                        setSelectedChapters(allChapterIds);
                      }
                    }}
                    data-testid="button-toggle-all-chapters"
                  >
                    {selectedChapters.length === textbooks.flatMap(tb => tb.chapters).length ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Select chapters from your uploaded textbooks to include in the practice test.
                </p>
                <div className="space-y-3 p-4 rounded-md border">
                  {textbooks.map((textbook) => (
                    <div key={textbook.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">{textbook.title}</span>
                      </div>
                      <div className="ml-6 space-y-1 border-l-2 border-border pl-3">
                        {textbook.chapters.map((chapter) => (
                          <div key={chapter.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`chapter-${chapter.id}`}
                              checked={selectedChapters.includes(chapter.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedChapters([...selectedChapters, chapter.id]);
                                } else {
                                  setSelectedChapters(selectedChapters.filter(id => id !== chapter.id));
                                }
                              }}
                              data-testid={`checkbox-chapter-${chapter.id}`}
                            />
                            <Label
                              htmlFor={`chapter-${chapter.id}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {chapter.title}
                              {chapter.startPage && (
                                <span className="text-muted-foreground ml-1">
                                  (p. {chapter.startPage}{chapter.endPage && chapter.endPage !== chapter.startPage ? `-${chapter.endPage}` : ''})
                                </span>
                              )}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={() => generateTestMutation.mutate({ 
                mode: testMode, 
                count: parseInt(questionCount),
                moduleIds: selectedModules.length > 0 ? selectedModules : undefined,
                textbookChapterIds: selectedChapters.length > 0 ? selectedChapters : undefined
              })}
              disabled={generateTestMutation.isPending}
              data-testid="button-generate-test"
            >
              <Brain className="h-4 w-4 mr-2" />
              {generateTestMutation.isPending ? "Generating..." : "Generate Practice Test"}
            </Button>
          </CardContent>
        </Card>
      ) : showResults ? (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>Review your performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center py-8">
              <div className="text-6xl font-bold text-primary mb-4">
                {currentTest.score}%
              </div>
              <p className="text-lg text-muted-foreground mb-6">
                You got {currentTest.questions?.filter((q: any, idx: number) => {
                  const answer = currentTest.answers?.[idx];
                  return answer && q.correctAnswer && answer.toLowerCase() === q.correctAnswer.toLowerCase();
                }).length || 0} out of {currentTest.questions?.length || 0} questions correct
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button onClick={() => setCurrentTest(null)} data-testid="button-new-test">
                  Take Another Test
                </Button>
                <Button variant="outline" asChild data-testid="button-chat-tutor">
                  <Link href={`/student/courses/${id}/tutor?testId=${currentTest?.id}`}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Get Help from AI Tutor
                  </Link>
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {currentTest.questions.map((question: any, idx: number) => {
                const userAnswer = currentTest.answers?.[idx];
                const isCorrect = userAnswer && question.correctAnswer && 
                  userAnswer.toLowerCase() === question.correctAnswer.toLowerCase();

                return (
                  <div key={idx} className="border rounded-md p-4">
                    <div className="flex items-start gap-3 mb-2">
                      {isCorrect ? (
                        <Check className="h-5 w-5 text-green-600 mt-0.5" />
                      ) : (
                        <X className="h-5 w-5 text-destructive mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="font-medium mb-2">Question {idx + 1}: {question.question}</p>
                        <div className="space-y-1 text-sm">
                          <p className="text-muted-foreground">
                            Your answer: <span className={isCorrect ? "text-green-600" : "text-destructive"}>
                              {userAnswer || "Not answered"}
                            </span>
                          </p>
                          {!isCorrect && (
                            <p className="text-muted-foreground">
                              Correct answer: <span className="text-green-600">{question.correctAnswer}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Question {currentQuestionIndex + 1} of {currentTest?.questions?.length || 0}</CardTitle>
                <CardDescription>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary">
                      {currentTest?.testMode?.replace("_", " ").toUpperCase() || "TEST"}
                    </Badge>
                    {currentQuestion?.type && (
                      <Badge variant="outline">
                        {currentQuestion.type.replace("_", " ").replace("fill blank", "Fill in the Blank")}
                      </Badge>
                    )}
                  </div>
                </CardDescription>
              </div>
              <div className="text-sm text-muted-foreground">
                {Object.keys(answers).length} / {currentTest?.questions?.length || 0} answered
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentQuestion && (
              <>
                <div>
                  <p className="text-lg font-medium mb-4">{currentQuestion.question}</p>

                  {currentQuestion.type === "multiple_choice" && currentQuestion.options ? (
                    <RadioGroup
                      value={answers[currentQuestionIndex] || ""}
                      onValueChange={handleAnswerChange}
                    >
                      {currentQuestion.options.map((option: string, idx: number) => (
                        <div key={idx} className="flex items-center space-x-2 p-3 border rounded-md hover-elevate">
                          <RadioGroupItem value={option} id={`option-${idx}`} data-testid={`radio-option-${idx}`} />
                          <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : currentQuestion.type === "short_answer" ? (
                    <Textarea
                      value={answers[currentQuestionIndex] || ""}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                      placeholder="Type your answer here..."
                      className="min-h-32"
                      data-testid="textarea-answer"
                    />
                  ) : currentQuestion.type === "fill_blank" ? (
                    <Input
                      value={answers[currentQuestionIndex] || ""}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                      placeholder="Fill in the blank..."
                      data-testid="input-answer"
                    />
                  ) : null}
                </div>

                <div className="flex justify-between gap-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                    data-testid="button-previous"
                  >
                    Previous
                  </Button>
                  {currentTest?.questions && currentQuestionIndex === currentTest.questions.length - 1 ? (
                    <Button
                      onClick={handleSubmit}
                      disabled={submitTestMutation.isPending}
                      data-testid="button-submit-test"
                    >
                      {submitTestMutation.isPending ? "Submitting..." : "Submit Test"}
                    </Button>
                  ) : (
                    <Button onClick={handleNext} data-testid="button-next">
                      Next
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
