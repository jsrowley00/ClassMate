import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, FileText, Brain, MessageSquare, LayoutDashboard, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Course } from "@shared/schema";

interface CourseTabsProps {
  isCollapsed?: boolean;
}

export function CourseTabs({ isCollapsed = false }: CourseTabsProps) {
  const { id } = useParams<{ id: string }>();
  const [location] = useLocation();

  const { data: course } = useQuery<Course>({
    queryKey: ["/api/courses", id],
    enabled: !!id,
  });

  const isSelfStudyRoom = course?.courseType === "self-study";

  const baseTabs = [
    {
      title: "Overview",
      url: `/student/courses/${id}`,
      icon: LayoutDashboard,
    },
    {
      title: "Materials",
      url: `/student/courses/${id}/materials`,
      icon: FileText,
    },
    {
      title: "Practice Tests",
      url: `/student/courses/${id}/practice`,
      icon: Brain,
    },
    {
      title: "Flashcards",
      url: `/student/courses/${id}/flashcards`,
      icon: BookOpen,
    },
    {
      title: "AI Tutor",
      url: `/student/courses/${id}/tutor`,
      icon: MessageSquare,
    },
  ];

  const tabs = isSelfStudyRoom
    ? [
        ...baseTabs,
        {
          title: "Build Study Room",
          url: `/student/courses/${id}/build`,
          icon: Wrench,
        },
      ]
    : baseTabs;

  return (
    <nav className="w-56 min-w-56 border-r bg-muted/20 p-4 space-y-1" data-testid="course-tabs">
      <h3 className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Course Navigation
      </h3>
      {tabs.map((tab) => {
        const isActive = location === tab.url;
        return (
          <Link
            key={tab.url}
            href={tab.url}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              "hover-elevate active-elevate-2",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            data-testid={`tab-${tab.title.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <tab.icon className="h-4 w-4" />
            <span>{tab.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
