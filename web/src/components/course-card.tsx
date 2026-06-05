import { FileText, Users } from "lucide-react"

import { CategoryBadge } from "@/components/category-badge"
import { useCourseModal } from "@/components/course-modal"
import { getCourse } from "@/lib/catalog"
import { cn } from "@/lib/utils"

export function CourseCard({ slug }: { slug: string }) {
  const { openCourse } = useCourseModal()
  const course = getCourse(slug)

  if (!course) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        {slug}
      </div>
    )
  }

  const syllabusCount = course.syllabi.length
  const shared = course.sharedIn.length > 1

  return (
    <button
      type="button"
      onClick={() => openCourse(slug)}
      className={cn(
        "group flex w-full flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-all",
        "hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm leading-snug font-medium">{course.name}</span>
        {course.code && (
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
            {course.code}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <CategoryBadge category={course.category} className="text-[10px]" />
        {syllabusCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <FileText className="size-3" />
            {syllabusCount}
          </span>
        )}
        {shared && (
          <span
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
            title={`Shared by ${course.sharedIn.length} majors`}
          >
            <Users className="size-3" />
            {course.sharedIn.length}
          </span>
        )}
      </div>
    </button>
  )
}
