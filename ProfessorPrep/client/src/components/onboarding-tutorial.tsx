import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { X, ChevronLeft, ChevronRight, Menu, MessageCircle, BookOpen, Plus, Upload, Layers, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  targetSelector?: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
}

const studentSteps: TutorialStep[] = [
  {
    title: "Welcome to ClassMate!",
    description: "Let's take a quick tour to help you get started. This will only take a minute!",
    icon: <BookOpen className="h-8 w-8 text-primary" />,
    position: "center",
  },
  {
    title: "Open the Sidebar",
    description: "Click the menu icon (three lines) in the top-left corner to open the sidebar. This is your main navigation hub for all features.",
    icon: <Menu className="h-8 w-8 text-primary" />,
    targetSelector: '[data-testid="button-sidebar-toggle"]',
    position: "right",
  },
  {
    title: "Your Study Assistant",
    description: "In the sidebar, you'll find the Study Assistant - your AI-powered tutor that can help you across all your courses. Click on it anytime you need help studying!",
    icon: <MessageCircle className="h-8 w-8 text-primary" />,
    position: "center",
  },
  {
    title: "My Courses",
    description: "This section shows courses your professors have added you to. Once enrolled, you'll have access to materials, practice tests, flashcards, and AI tutoring for each course.",
    icon: <BookOpen className="h-8 w-8 text-primary" />,
    position: "center",
  },
  {
    title: "Create Self-Study Rooms",
    description: "Don't have a professor using ClassMate? No problem! Click 'Create Study Room' to create your own study space where you can upload your own materials and use all the AI tools.",
    icon: <Plus className="h-8 w-8 text-primary" />,
    position: "center",
  },
  {
    title: "Upload Your Materials",
    description: "Inside a course or study room, you can upload PDFs, Word documents, PowerPoints, and images. ClassMate will process them to create personalized study tools.",
    icon: <Upload className="h-8 w-8 text-primary" />,
    position: "center",
  },
  {
    title: "Organize with Modules",
    description: "Create modules (like chapters or weeks) to organize your study materials. This helps the AI generate more focused practice tests and flashcards.",
    icon: <Layers className="h-8 w-8 text-primary" />,
    position: "center",
  },
  {
    title: "You're All Set!",
    description: "That's everything you need to know to get started. You can always access this tutorial again by clicking the help button. Happy studying!",
    icon: <HelpCircle className="h-8 w-8 text-primary" />,
    position: "center",
  },
];

const professorSteps: TutorialStep[] = [
  {
    title: "Welcome to ClassMate!",
    description: "Let's take a quick tour to help you set up your courses. This will only take a minute!",
    icon: <BookOpen className="h-8 w-8 text-primary" />,
    position: "center",
  },
  {
    title: "Open the Sidebar",
    description: "Click the menu icon (three lines) in the top-left corner to open the sidebar. This is where you'll find all your navigation options.",
    icon: <Menu className="h-8 w-8 text-primary" />,
    targetSelector: '[data-testid="button-sidebar-toggle"]',
    position: "right",
  },
  {
    title: "Create Your First Course",
    description: "Start by creating a course. Click 'Create Course' in your dashboard to set up a new course with a name, description, and optional start/end dates.",
    icon: <Plus className="h-8 w-8 text-primary" />,
    position: "center",
  },
  {
    title: "Add Course Modules",
    description: "Organize your course content into modules (like weeks, chapters, or units). This helps structure the AI-generated study materials for students.",
    icon: <Layers className="h-8 w-8 text-primary" />,
    position: "center",
  },
  {
    title: "Upload Study Materials",
    description: "Upload PDFs, Word documents, PowerPoints, and images to your course. ClassMate's AI will use these to generate practice tests, flashcards, and provide tutoring.",
    icon: <Upload className="h-8 w-8 text-primary" />,
    position: "center",
  },
  {
    title: "Invite Your Students",
    description: "Add students by their email address. They'll automatically be enrolled when they sign up or subscribe to ClassMate!",
    icon: <MessageCircle className="h-8 w-8 text-primary" />,
    position: "center",
  },
  {
    title: "You're All Set!",
    description: "That's everything you need to know to get started. You can always access this tutorial again by clicking the help button. Happy teaching!",
    icon: <HelpCircle className="h-8 w-8 text-primary" />,
    position: "center",
  },
];

interface OnboardingTutorialProps {
  role: "student" | "professor";
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function OnboardingTutorial({ role, isOpen, onClose, onComplete }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const steps = role === "student" ? studentSteps : professorSteps;
  const step = steps[currentStep];

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  }, [currentStep, steps.length, onComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "ArrowRight" || e.key === "Enter") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "Escape") {
        handleSkip();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleNext, handlePrev, handleSkip]);

  useEffect(() => {
    setCurrentStep(0);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleSkip}
      />
      
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <Card className="relative w-full max-w-md shadow-2xl animate-in fade-in-0 zoom-in-95 duration-300">
          <button
            onClick={handleSkip}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              {step.icon}
            </div>
            <CardTitle className="text-xl">{step.title}</CardTitle>
            <CardDescription className="text-base mt-2">
              {step.description}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pb-4">
            <div className="flex justify-center gap-1.5">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    index === currentStep
                      ? "w-6 bg-primary"
                      : "w-2 bg-muted hover:bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-between gap-2">
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              Skip Tour
            </Button>
            
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  onClick={handlePrev}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              <Button onClick={handleNext}>
                {currentStep === steps.length - 1 ? (
                  "Get Started"
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

interface HelpButtonProps {
  onClick: () => void;
  className?: string;
}

export function HelpButton({ onClick, className }: HelpButtonProps) {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      className={cn("rounded-full", className)}
      title="Show Tutorial"
    >
      <HelpCircle className="h-4 w-4" />
    </Button>
  );
}
