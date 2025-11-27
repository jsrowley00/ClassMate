import { useState } from "react";
import { CourseTabs } from "@/components/course-tabs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type CourseLayoutProps = {
  children: React.ReactNode;
};

export function CourseLayout({ children }: CourseLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-full relative">
      <div
        className={cn(
          "transition-all duration-300 ease-in-out relative",
          isCollapsed ? "w-0 overflow-hidden" : "w-56"
        )}
      >
        <CourseTabs isCollapsed={isCollapsed} />
      </div>
      
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 z-10",
          "w-6 h-12 flex items-center justify-center",
          "bg-background border rounded-r-md shadow-sm",
          "hover:bg-muted transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
          isCollapsed ? "left-0" : "left-56 -ml-px"
        )}
        style={{ transition: "left 0.3s ease-in-out" }}
        aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
        data-testid="toggle-course-nav"
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
