import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowRight, BookOpen, CalendarRange, Layers, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  catalog,
  majors,
  syllabusCountForCurriculum,
  type Major,
} from "@/lib/catalog"

function matchesQuery(major: Major, q: string): boolean {
  if (!q) return true
  const haystack = [
    major.name,
    major.description ?? "",
    major.curriculum?.name ?? "",
    major.slug,
  ]
    .join(" ")
    .toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token))
}

export function HomePage() {
  const [query, setQuery] = useState("")

  const filtered = useMemo(
    () => majors.filter((m) => matchesQuery(m, query)),
    [query]
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <section className="mx-auto max-w-2xl text-center">
        <Badge variant="secondary" className="mb-4">
          {catalog.stats.majors} majors &middot; {catalog.stats.courses} courses
          &middot; {catalog.stats.syllabi} syllabi
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Explore degree curricula,
          <br className="hidden sm:block" /> class by class.
        </h1>
        <p className="mt-4 text-balance text-muted-foreground">
          Search a major to see its four-year plan, then click any course to
          read real syllabi collected from universities and open courseware.
        </p>

        <div className="relative mt-8">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search majors (e.g. computer science, nursing, business)..."
            className="h-13 rounded-full pl-12 text-base shadow-sm"
          />
        </div>
      </section>

      <section className="mt-12">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">
            {query ? "Search results" : "All curricula"}
          </h2>
          <span className="text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "major" : "majors"}
          </span>
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            No majors match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((major) => (
              <CurriculumCard key={major.slug} major={major} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function CurriculumCard({ major }: { major: Major }) {
  const curriculum = major.curriculum
  if (!curriculum) return null

  const syllabi = syllabusCountForCurriculum(curriculum)

  return (
    <Link to={`/curriculum/${curriculum.slug}`} className="group block">
      <Card className="h-full transition-all group-hover:-translate-y-1 group-hover:border-foreground/25 group-hover:shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>{major.name}</span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </CardTitle>
          <CardDescription className="line-clamp-2">
            {major.description ?? curriculum.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarRange className="size-4" />
              {curriculum.years} years
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Layers className="size-4" />
              {curriculum.courseCount} classes
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="size-4" />
              {syllabi} syllabi
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
