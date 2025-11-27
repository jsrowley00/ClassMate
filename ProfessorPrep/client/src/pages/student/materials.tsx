import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, FileText, File, Image as ImageIcon, Download, Video, Eye, Presentation } from "lucide-react";
import { Link, useParams } from "wouter";
import type { Course, CourseMaterial } from "@shared/schema";

export default function CourseMaterials() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [previewMaterial, setPreviewMaterial] = useState<CourseMaterial | null>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);

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

  const { data: materials, isLoading: materialsLoading } = useQuery<CourseMaterial[]>({
    queryKey: ["/api/courses", id, "materials"],
    enabled: isAuthenticated && !!id,
  });

  const getFileIcon = (fileType: string) => {
    if (fileType === "pdf") return <FileText className="h-4 w-4" />;
    if (fileType === "docx") return <File className="h-4 w-4" />;
    if (fileType === "pptx") return <Presentation className="h-4 w-4" />;
    if (fileType === "image") return <ImageIcon className="h-4 w-4" />;
    if (fileType === "video") return <Video className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const canPreview = (fileType: string) => {
    return ["pdf", "docx", "pptx", "image", "video"].includes(fileType);
  };

  const handleViewMaterial = async (material: CourseMaterial) => {
    setPreviewMaterial(material);
    
    // For DOCX and PPTX, generate a preview token
    if (material.fileType === "docx" || material.fileType === "pptx") {
      setLoadingToken(true);
      try {
        const response = await fetch(`/api/materials/${material.id}/preview-token`, {
          method: 'POST',
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to generate preview token');
        }
        
        const data = await response.json();
        setPreviewToken(data.token);
      } catch (error) {
        console.error('Error generating preview token:', error);
        toast({
          title: "Preview Error",
          description: "Unable to generate preview. Try downloading the file instead.",
          variant: "destructive",
        });
      } finally {
        setLoadingToken(false);
      }
    }
  };

  const renderPreview = (material: CourseMaterial) => {
    const { fileType, fileUrl, fileName, id } = material;

    if (fileType === "pdf") {
      return (
        <iframe
          src={fileUrl}
          className="w-full h-[70vh] border-0 rounded-md"
          title={fileName}
        />
      );
    }

    if (fileType === "docx" || fileType === "pptx") {
      if (loadingToken) {
        return (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">Loading preview...</p>
            </div>
          </div>
        );
      }

      if (previewToken) {
        // Use Google Docs Viewer with the tokenized URL
        const publicFileUrl = `${window.location.origin}/api/materials/preview/${previewToken}`;
        const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(publicFileUrl)}&embedded=true`;
        return (
          <iframe
            src={viewerUrl}
            className="w-full h-[70vh] border-0 rounded-md"
            title={fileName}
          />
        );
      }

      // Fallback if token failed to generate
      return (
        <div className="text-center py-12 space-y-6">
          <div className="space-y-3">
            <File className="h-16 w-16 text-muted-foreground mx-auto" />
            <div>
              <h3 className="text-lg font-semibold mb-1">{fileName}</h3>
              <p className="text-sm text-muted-foreground">
                {fileType === "docx" ? "Microsoft Word Document" : "Microsoft PowerPoint Presentation"}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <Button size="lg" asChild>
              <a href={fileUrl} download target="_blank" rel="noopener noreferrer">
                <Download className="h-5 w-5 mr-2" />
                Download to View
              </a>
            </Button>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Preview unavailable. Download the file to view it.
            </p>
          </div>
        </div>
      );
    }

    if (fileType === "image") {
      return (
        <div className="flex items-center justify-center bg-muted/30 rounded-md p-4">
          <img
            src={fileUrl}
            alt={fileName}
            className="max-w-full max-h-[70vh] object-contain rounded-md"
          />
        </div>
      );
    }

    if (fileType === "video") {
      return (
        <video
          src={fileUrl}
          controls
          className="w-full max-h-[70vh] rounded-md"
        >
          Your browser does not support the video tag.
        </video>
      );
    }

    return (
      <div className="text-center py-12">
        <File className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground mb-4">
          Preview not available for this file type
        </p>
        <Button asChild>
          <a href={fileUrl} download target="_blank" rel="noopener noreferrer">
            <Download className="h-4 w-4 mr-2" />
            Download File
          </a>
        </Button>
      </div>
    );
  };

  if (authLoading || !isAuthenticated) {
    return null;
  }

  if (courseLoading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48 mb-8" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <p>Course not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-6" data-testid="button-back">
        <Link href="/">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Courses
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{course.name}</h1>
        <p className="text-muted-foreground">Study Materials</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Course Materials</CardTitle>
        </CardHeader>
        <CardContent>
          {materialsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : materials && materials.length > 0 ? (
            <div className="space-y-2">
              {materials.map((material) => (
                <div
                  key={material.id}
                  className="flex items-center justify-between p-4 border rounded-md hover-elevate"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-muted-foreground">
                      {getFileIcon(material.fileType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{material.fileName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {material.fileType.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {material.uploadedAt ? new Date(material.uploadedAt).toLocaleDateString() : 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewMaterial(material)}
                      data-testid={`button-view-${material.id}`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      data-testid={`button-download-${material.id}`}
                    >
                      <a href={material.fileUrl} download target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No materials available yet. Your professor will upload them soon.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewMaterial} onOpenChange={(open) => {
        if (!open) {
          setPreviewMaterial(null);
          setPreviewToken(null);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewMaterial?.fileName}</DialogTitle>
            <DialogDescription>
              {previewMaterial?.fileType.toUpperCase()} • 
              {previewMaterial?.uploadedAt ? ` Uploaded ${new Date(previewMaterial.uploadedAt).toLocaleDateString()}` : ''}
            </DialogDescription>
          </DialogHeader>
          {previewMaterial && (
            <div className="mt-4">
              {renderPreview(previewMaterial)}
              {canPreview(previewMaterial.fileType) && (
                <div className="mt-4 flex justify-end">
                  <Button variant="outline" asChild>
                    <a href={previewMaterial.fileUrl} download target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
