import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, RotateCw, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Flashcard = {
  id: string;
  setId: string;
  front: string;
  back: string;
  mastered: boolean;
  orderIndex: number;
};

type FlashcardSet = {
  id: string;
  courseId: string;
  studentId: string;
  title: string;
  createdAt: string;
};

type FlashcardData = {
  set: FlashcardSet;
  flashcards: Flashcard[];
};

export default function FlashcardStudy() {
  const { id: courseId, setId } = useParams<{ id: string; setId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<FlashcardData>({
    queryKey: [`/api/flashcards/sets/${setId}`],
  });

  const masteryMutation = useMutation({
    mutationFn: async ({ flashcardId, mastered }: { flashcardId: string; mastered: boolean }) => {
      return await apiRequest("PATCH", `/api/flashcards/${flashcardId}/mastered`, { mastered });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/flashcards/sets/${setId}`] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message || "Failed to update flashcard status.",
      });
    },
  });

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
              <p className="font-medium text-lg" data-testid="text-error">Error Loading Flashcards</p>
              <p className="text-sm text-muted-foreground mt-1">
                {(error as any).message || "Failed to load flashcards. Please try again."}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => refetch()}
                data-testid="button-retry"
              >
                <RotateCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate(`/student/courses/${courseId}/flashcards`)}
                data-testid="button-back-to-sets"
              >
                Back to Sets
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data || !data.flashcards || data.flashcards.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No flashcards found in this set.</p>
            <Button
              onClick={() => navigate(`/student/courses/${courseId}/flashcards`)}
              className="mt-4"
              data-testid="button-back-to-sets"
            >
              Back to Sets
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentCard = data.flashcards[currentIndex];
  const masteredCount = data.flashcards.filter(c => c.mastered).length;
  const progress = (masteredCount / data.flashcards.length) * 100;

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % data.flashcards.length);
  };

  const handlePrevious = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + data.flashcards.length) % data.flashcards.length);
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleMarkMastered = (mastered: boolean) => {
    masteryMutation.mutate({ flashcardId: currentCard.id, mastered });
    setTimeout(handleNext, 300);
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-study">
            {data.set.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Card {currentIndex + 1} of {data.flashcards.length}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(`/student/courses/${courseId}/flashcards`)}
          data-testid="button-back"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Sets
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" data-testid="badge-mastered-count">
              {masteredCount} / {data.flashcards.length} Mastered
            </Badge>
            {currentCard.mastered && (
              <Badge variant="default" data-testid="badge-current-mastered">
                <Check className="w-3 h-3 mr-1" />
                Mastered
              </Badge>
            )}
          </div>
        </div>
        <Progress value={progress} className="h-2" data-testid="progress-mastery" />
      </div>

      <div className="relative min-h-[400px]" style={{ perspective: "1000px" }}>
        <div
          className="relative w-full h-[400px] transition-transform duration-500 cursor-pointer"
          onClick={handleFlip}
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
          data-testid="card-flashcard"
        >
          {/* Front face */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          >
            <Card className="w-full h-full flex items-center justify-center p-8">
              <CardHeader className="text-center w-full">
                <CardTitle className="text-sm text-muted-foreground mb-4">
                  Question
                </CardTitle>
                <div className="text-2xl leading-relaxed" data-testid="text-card-content">
                  {currentCard.front}
                </div>
              </CardHeader>
            </Card>
          </div>

          {/* Back face */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <Card className="w-full h-full flex items-center justify-center p-8">
              <CardHeader className="text-center w-full">
                <CardTitle className="text-sm text-muted-foreground mb-4">
                  Answer
                </CardTitle>
                <div className="text-2xl leading-relaxed">
                  {currentCard.back}
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <RotateCw className="w-4 h-4" />
        <span>Click card to flip</span>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={data.flashcards.length === 1}
          data-testid="button-previous"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => handleMarkMastered(false)}
            disabled={masteryMutation.isPending}
            data-testid="button-mark-learning"
          >
            <X className="w-4 h-4 mr-2" />
            Still Learning
          </Button>
          <Button
            onClick={() => handleMarkMastered(true)}
            disabled={masteryMutation.isPending}
            data-testid="button-mark-mastered"
          >
            <Check className="w-4 h-4 mr-2" />
            Mastered
          </Button>
        </div>

        <Button
          variant="outline"
          onClick={handleNext}
          disabled={data.flashcards.length === 1}
          data-testid="button-next"
        >
          Next
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
