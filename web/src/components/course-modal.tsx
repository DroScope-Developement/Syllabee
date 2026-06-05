import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { BookOpen, ExternalLink, FileText, GraduationCap } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CategoryBadge } from "@/components/category-badge"
import { getCourse, getMajorName, type Course } from "@/lib/catalog"

interface CourseModalContextValue {
  openCourse: (slug: string) => void
}

const CourseModalContext = createContext<CourseModalContextValue | null>(null)

export function useCourseModal(): CourseModalContextValue {
  const ctx = useContext(CourseModalContext)
  if (!ctx) {
    throw new Error("useCourseModal must be used within <CourseModalProvider>")
  }
  return ctx
}

export function CourseModalProvider({ children }: { children: React.ReactNode }) {
  const [slug, setSlug] = useState<string | null>(null)

  const openCourse = useCallback((next: string) => setSlug(next), [])
  const value = useMemo(() => ({ openCourse }), [openCourse])

  const course = slug ? getCourse(slug) : undefined

  return (
    <CourseModalContext.Provider value={value}>
      {children}
      <Dialog open={!!course} onOpenChange={(open) => !open && setSlug(null)}>
        <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
          {course && <CourseModalBody course={course} />}
        </DialogContent>
      </Dialog>
    </CourseModalContext.Provider>
  )
}

function CourseModalBody({ course }: { course: Course }) {
  return (
    <>
      <DialogHeader className="space-y-3 border-b p-6 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={course.category} />
          {course.code && (
            <Badge variant="secondary" className="font-mono text-xs">
              {course.code}
            </Badge>
          )}
          {course.sharedIn.length > 1 && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <GraduationCap className="size-3" />
              Shared by {course.sharedIn.length} majors
            </Badge>
          )}
        </div>
        <DialogTitle className="text-2xl">{course.name}</DialogTitle>
        {course.description ? (
          <DialogDescription>{course.description}</DialogDescription>
        ) : (
          <DialogDescription>
            {course.syllabi.length} syllabus
            {course.syllabi.length === 1 ? "" : "es"} collected for this course.
          </DialogDescription>
        )}
      </DialogHeader>

      <ScrollArea className="max-h-[55vh]">
        <div className="space-y-6 p-6">
          {course.requiredBy.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <GraduationCap className="size-4" />
                Required by
              </h3>
              <div className="flex flex-wrap gap-2">
                {course.requiredBy.map((m) => (
                  <Badge key={m} variant="secondary">
                    {getMajorName(m)}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <BookOpen className="size-4" />
              Syllabi ({course.syllabi.length})
            </h3>

            {course.syllabi.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No syllabi collected for this course yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {course.syllabi.map((s, i) => (
                  <li
                    key={`${s.file}-${i}`}
                    className="group rounded-lg border bg-card/50 p-3 transition-colors hover:border-foreground/20 hover:bg-accent/40"
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" title={s.title}>
                          {s.title}
                        </p>
                        <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                          {s.institution && <span>{s.institution}</span>}
                          {s.institution && s.term && <span>&middot;</span>}
                          {s.term && <span>{s.term}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Button asChild size="sm" variant="secondary">
                          <a href={s.file} target="_blank" rel="noreferrer">
                            View PDF
                          </a>
                        </Button>
                        {s.source && !s.source.startsWith("file:") && (
                          <Button asChild size="icon" variant="ghost" title="Original source">
                            <a href={s.source} target="_blank" rel="noreferrer">
                              <ExternalLink className="size-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Separator />
          <p className="text-xs text-muted-foreground">
            Syllabi are public documents collected from universities and open
            courseware. They are provided here for reference only.
          </p>
        </div>
      </ScrollArea>
    </>
  )
}
