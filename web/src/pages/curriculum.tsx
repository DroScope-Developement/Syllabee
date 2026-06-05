import { useMemo } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, BookOpen, CalendarRange, Layers } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CourseCard } from "@/components/course-card"
import {
  courseSlugsInCurriculum,
  majors,
  syllabusCountForCurriculum,
} from "@/lib/catalog"

export function CurriculumPage() {
  const { slug } = useParams<{ slug: string }>()

  const major = useMemo(
    () => majors.find((m) => m.curriculum?.slug === slug),
    [slug]
  )
  const curriculum = major?.curriculum

  if (!major || !curriculum) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">Curriculum not found</h1>
        <p className="mt-2 text-muted-foreground">
          We couldn&rsquo;t find a curriculum for &ldquo;{slug}&rdquo;.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Back to all majors</Link>
        </Button>
      </div>
    )
  }

  const totalCourses = courseSlugsInCurriculum(curriculum).length
  const totalSyllabi = syllabusCountForCurriculum(curriculum)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All majors
      </Link>

      <header className="mt-4 border-b pb-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {major.name}
        </h1>
        <p className="mt-1 text-lg text-muted-foreground">{curriculum.name}</p>
        {major.description && (
          <p className="mt-3 max-w-3xl text-muted-foreground">
            {major.description}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <CalendarRange className="size-3.5" />
            {curriculum.years} years
          </Badge>
          <Badge variant="secondary" className="gap-1.5">
            <Layers className="size-3.5" />
            {totalCourses} classes
          </Badge>
          <Badge variant="secondary" className="gap-1.5">
            <BookOpen className="size-3.5" />
            {totalSyllabi} syllabi
          </Badge>
        </div>
      </header>

      <div className="mt-8 space-y-10">
        {curriculum.plan.map((year) => (
          <section key={year.year}>
            <h2 className="mb-4 flex items-center gap-3 text-xl font-semibold">
              <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-sm">
                {year.year}
              </span>
              Year {year.year}
            </h2>
            <div className="grid gap-5 md:grid-cols-2">
              {year.terms.map((term) => (
                <div
                  key={term.name}
                  className="rounded-xl border bg-card/40 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-medium">{term.name}</h3>
                    <span className="text-xs text-muted-foreground">
                      {term.courses.length}{" "}
                      {term.courses.length === 1 ? "class" : "classes"}
                    </span>
                  </div>
                  <div className="grid gap-2.5">
                    {term.courses.map((courseSlug) => (
                      <CourseCard key={courseSlug} slug={courseSlug} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-12 text-center text-xs text-muted-foreground">
        Click any class to view its collected syllabi.
      </p>
    </div>
  )
}
