import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, RotateCw, Check, X, Plus, Pencil, Trash2 } from "lucide-react";
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
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [cardFront, setCardFront] = useState("");
  const [cardBack, setCardBack] = useState("");

  const { data, isLoading, error, refetch } = useQuery<FlashcardData>({
    queryKey: [`/api/flashcards/sets/${setId}`],
  });

  const addCardMutation = useMutation({
    mutationFn: async (cardData: { front: string; back: string }) => {
      return await apiRequest("POST", `/api/flashcards/sets/${setId}/cards`, cardData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/flashcards/sets/${setId}`] });
      setIsAddDialogOpen(false);
      setCardFront("");
      setCardBack("");
      toast({
        title: "Card added!",
        description: "Your flashcard has been added to the set.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to add card",
        description: error.message || "Please try again.",
      });
    },
  });

  const editCardMutation = useMutation({
    mutationFn: async ({ cardId, front, back }: { cardId: string; front: string; back: string }) => {
      return await apiRequest("PATCH", `/api/flashcards/${cardId}`, { front, back });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/flashcards/sets/${setId}`] });
      setIsEditDialogOpen(false);
      setEditingCard(null);
      setCardFront("");
      setCardBack("");
      toast({
        title: "Card updated!",
        description: "Your flashcard has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to update card",
        description: error.message || "Please try again.",
      });
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      return await apiRequest("DELETE", `/api/flashcards/${cardId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/flashcards/sets/${setId}`] });
      if (data && currentIndex >= data.flashcards.length - 1 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
      toast({
        title: "Card deleted",
        description: "The flashcard has been removed from the set.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to delete card",
        description: error.message || "Please try again.",
      });
    },
  });

  const handleAddCard = () => {
    if (!cardFront.trim() || !cardBack.trim()) {
      toast({
        variant: "destructive",
        title: "Both sides required",
        description: "Please enter content for both the front and back of the card.",
      });
      return;
    }
    addCardMutation.mutate({ front: cardFront.trim(), back: cardBack.trim() });
  };

  const handleEditCard = () => {
    if (!editingCard || !cardFront.trim() || !cardBack.trim()) {
      toast({
        variant: "destructive",
        title: "Both sides required",
        description: "Please enter content for both the front and back of the card.",
      });
      return;
    }
    editCardMutation.mutate({ cardId: editingCard.id, front: cardFront.trim(), back: cardBack.trim() });
  };

  const openEditDialog = (card: Flashcard) => {
    setEditingCard(card);
    setCardFront(card.front);
    setCardBack(card.back);
    setIsEditDialogOpen(true);
  };

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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setCardFront("");
              setCardBack("");
              setIsAddDialogOpen(true);
            }}
            data-testid="button-add-card"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Card
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/student/courses/${courseId}/flashcards`)}
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Sets
          </Button>
        </div>
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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditDialog(currentCard)}
              data-testid="button-edit-card"
            >
              <Pencil className="w-4 h-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("Are you sure you want to delete this card?")) {
                  deleteCardMutation.mutate(currentCard.id);
                }
              }}
              disabled={deleteCardMutation.isPending}
              data-testid="button-delete-card"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
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

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Flashcard</DialogTitle>
            <DialogDescription>
              Create your own flashcard to add to this set.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="card-front">Front (Question)</Label>
              <Textarea
                id="card-front"
                value={cardFront}
                onChange={(e) => setCardFront(e.target.value)}
                placeholder="Enter the question or term..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card-back">Back (Answer)</Label>
              <Textarea
                id="card-back"
                value={cardBack}
                onChange={(e) => setCardBack(e.target.value)}
                placeholder="Enter the answer or definition..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setCardFront("");
                setCardBack("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCard}
              disabled={addCardMutation.isPending || !cardFront.trim() || !cardBack.trim()}
            >
              {addCardMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Card
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Flashcard</DialogTitle>
            <DialogDescription>
              Update the content of this flashcard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-card-front">Front (Question)</Label>
              <Textarea
                id="edit-card-front"
                value={cardFront}
                onChange={(e) => setCardFront(e.target.value)}
                placeholder="Enter the question or term..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-card-back">Back (Answer)</Label>
              <Textarea
                id="edit-card-back"
                value={cardBack}
                onChange={(e) => setCardBack(e.target.value)}
                placeholder="Enter the answer or definition..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingCard(null);
                setCardFront("");
                setCardBack("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditCard}
              disabled={editCardMutation.isPending || !cardFront.trim() || !cardBack.trim()}
            >
              {editCardMutation.isPending ? (
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
