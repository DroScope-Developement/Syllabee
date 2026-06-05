import catalogJson from "@/data/catalog.json"

export interface Syllabus {
  title: string
  institution: string | null
  term: string | null
  file: string
  source: string
}

export interface Course {
  slug: string
  name: string
  code: string | null
  category: string
  description: string | null
  requiredBy: string[]
  sharedIn: string[]
  syllabi: Syllabus[]
}

export interface Term {
  name: string
  courses: string[]
}

export interface PlanYear {
  year: number
  terms: Term[]
}

export interface Curriculum {
  slug: string
  name: string
  years: number
  courseCount: number
  plan: PlanYear[]
}

export interface Major {
  slug: string
  name: string
  description: string | null
  requiredCourses: string[]
  curriculum: Curriculum | null
  curricula: Curriculum[]
}

export interface Catalog {
  generatedAt: string
  stats: { majors: number; courses: number; syllabi: number }
  majors: Major[]
  courses: Record<string, Course>
}

export const catalog = catalogJson as unknown as Catalog

export const majors = catalog.majors
export const coursesBySlug = catalog.courses

export function getMajor(slug: string): Major | undefined {
  return majors.find((m) => m.slug === slug)
}

export function getCourse(slug: string): Course | undefined {
  return coursesBySlug[slug]
}

export function getMajorName(slug: string): string {
  return getMajor(slug)?.name ?? slug
}

/** Count the distinct courses that appear in a curriculum's plan. */
export function courseSlugsInCurriculum(curriculum: Curriculum): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const year of curriculum.plan) {
    for (const term of year.terms) {
      for (const slug of term.courses) {
        if (!seen.has(slug)) {
          seen.add(slug)
          out.push(slug)
        }
      }
    }
  }
  return out
}

export function syllabusCountForCurriculum(curriculum: Curriculum): number {
  return courseSlugsInCurriculum(curriculum).reduce((total, slug) => {
    return total + (getCourse(slug)?.syllabi.length ?? 0)
  }, 0)
}

export const CATEGORY_LABELS: Record<string, string> = {
  cs: "Computing",
  ce: "Computer Eng.",
  math: "Mathematics",
  science: "Science",
  nursing: "Nursing",
  engineering: "Engineering",
  business: "Business",
  psychology: "Psychology",
  general: "General Ed.",
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}
