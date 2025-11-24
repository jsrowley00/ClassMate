import { CourseTabs } from "@/components/course-tabs";

type CourseLayoutProps = {
  children: React.ReactNode;
};

export function CourseLayout({ children }: CourseLayoutProps) {
  return (
    <div className="flex h-full">
      <CourseTabs />
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
