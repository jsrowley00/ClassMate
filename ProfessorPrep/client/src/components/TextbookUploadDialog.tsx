import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Upload, BookOpen, FileText, Pencil, Check, X, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface DetectedChapter {
  title: string;
  startPage: number;
  endPage?: number;
  pageRange?: string;
}

interface ChapterDetectionResult {
  fileName: string;
  fileSize: number;
  totalPages: number;
  detectionMethod: 'toc' | 'heuristics' | 'none';
  confidence: 'high' | 'medium' | 'low';
  chapters: DetectedChapter[];
  tempFileData: string;
}

interface TextbookUploadDialogProps {
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TextbookUploadDialog({ courseId, open, onOpenChange }: TextbookUploadDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'upload' | 'preview' | 'confirm'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectionResult, setDetectionResult] = useState<ChapterDetectionResult | null>(null);
  const [editedChapters, setEditedChapters] = useState<DetectedChapter[]>([]);
  const [textbookTitle, setTextbookTitle] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`/api/courses/${courseId}/textbooks/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload textbook');
      }
      
      return response.json() as Promise<ChapterDetectionResult>;
    },
    onSuccess: (data) => {
      setDetectionResult(data);
      setEditedChapters(data.chapters);
      setTextbookTitle(data.fileName.replace(/\.pdf$/i, ''));
      setStep('preview');
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message,
      });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!detectionResult) throw new Error('No detection result');
      
      return apiRequest("POST", `/api/courses/${courseId}/textbooks/confirm`, {
        fileName: detectionResult.fileName,
        tempFileData: detectionResult.tempFileData,
        chapters: editedChapters,
        title: textbookTitle,
      });
    },
    onSuccess: () => {
      toast({
        title: "Textbook Added",
        description: `"${textbookTitle}" has been added with ${editedChapters.length} chapters.`,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/courses/${courseId}/textbooks`] });
      resetAndClose();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to Save",
        description: error.message,
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          variant: "destructive",
          title: "Invalid File",
          description: "Only PDF files are supported for textbook uploads.",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const startEditingChapter = (index: number) => {
    setEditingIndex(index);
    setEditingTitle(editedChapters[index].title);
  };

  const saveChapterEdit = () => {
    if (editingIndex !== null && editingTitle.trim()) {
      const newChapters = [...editedChapters];
      newChapters[editingIndex] = {
        ...newChapters[editingIndex],
        title: editingTitle.trim(),
      };
      setEditedChapters(newChapters);
      setEditingIndex(null);
      setEditingTitle("");
    }
  };

  const cancelChapterEdit = () => {
    setEditingIndex(null);
    setEditingTitle("");
  };

  const removeChapter = (index: number) => {
    if (editedChapters.length <= 1) {
      toast({
        variant: "destructive",
        title: "Cannot Remove",
        description: "You must have at least one chapter.",
      });
      return;
    }
    setEditedChapters(editedChapters.filter((_, i) => i !== index));
  };

  const resetAndClose = () => {
    setStep('upload');
    setSelectedFile(null);
    setDetectionResult(null);
    setEditedChapters([]);
    setTextbookTitle("");
    setEditingIndex(null);
    setEditingTitle("");
    onOpenChange(false);
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return <Badge variant="default" className="bg-green-500">High Confidence</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-yellow-500 text-black">Medium Confidence</Badge>;
      default:
        return <Badge variant="outline">Low Confidence</Badge>;
    }
  };

  const getDetectionMethodText = (method: string) => {
    switch (method) {
      case 'toc':
        return 'Detected from Table of Contents';
      case 'heuristics':
        return 'Detected from chapter headings';
      default:
        return 'No chapters detected automatically';
    }
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {step === 'upload' && 'Upload Textbook'}
            {step === 'preview' && 'Review Detected Chapters'}
            {step === 'confirm' && 'Confirm Textbook Upload'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a PDF textbook to automatically detect and split chapters for studying.'}
            {step === 'preview' && 'Review and edit the detected chapters before saving.'}
            {step === 'confirm' && 'Final confirmation before saving the textbook.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              {selectedFile ? (
                <div className="space-y-2">
                  <FileText className="h-12 w-12 mx-auto text-primary" />
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                  >
                    Change File
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <label htmlFor="textbook-upload" className="cursor-pointer">
                      <span className="text-primary hover:underline">Choose a PDF file</span>
                      <span className="text-muted-foreground"> or drag and drop</span>
                    </label>
                    <input
                      id="textbook-upload"
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PDF files only, up to 10MB
                  </p>
                </div>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <h4 className="font-medium mb-2">How it works:</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Upload your textbook PDF</li>
                <li>Chapters are automatically detected from the table of contents or headings</li>
                <li>Review and edit chapter names if needed</li>
                <li>Each chapter becomes a separate study module</li>
              </ul>
            </div>
          </div>
        )}

        {step === 'preview' && detectionResult && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{getDetectionMethodText(detectionResult.detectionMethod)}</p>
                <p className="text-sm text-muted-foreground">{detectionResult.totalPages} pages total</p>
              </div>
              {getConfidenceBadge(detectionResult.confidence)}
            </div>

            <div className="space-y-2">
              <Label htmlFor="textbook-title">Textbook Title</Label>
              <Input
                id="textbook-title"
                value={textbookTitle}
                onChange={(e) => setTextbookTitle(e.target.value)}
                placeholder="Enter textbook title"
              />
            </div>

            {detectionResult.confidence === 'low' && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">No chapters detected automatically</p>
                  <p className="text-yellow-700">You may want to manually add chapter information or upload the entire book as one module.</p>
                </div>
              </div>
            )}

            <div>
              <Label>Detected Chapters ({editedChapters.length})</Label>
              <ScrollArea className="h-[250px] mt-2 border rounded-lg">
                <div className="p-2 space-y-2">
                  {editedChapters.map((chapter, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 border rounded-md hover:bg-muted/50"
                    >
                      <span className="text-muted-foreground w-8 text-center text-sm">
                        {index + 1}
                      </span>
                      {editingIndex === index ? (
                        <div className="flex-1 flex items-center gap-2">
                          <Input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="flex-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveChapterEdit();
                              if (e.key === 'Escape') cancelChapterEdit();
                            }}
                          />
                          <Button size="icon" variant="ghost" onClick={saveChapterEdit}>
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={cancelChapterEdit}>
                            <X className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{chapter.title}</p>
                            <p className="text-xs text-muted-foreground">
                              Pages {chapter.startPage}-{chapter.endPage || chapter.startPage}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => startEditingChapter(index)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeChapter(index)}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <>
              <Button variant="outline" onClick={resetAndClose}>
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload & Detect Chapters
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending || !textbookTitle.trim() || editedChapters.length === 0}
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Save Textbook ({editedChapters.length} chapters)
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
