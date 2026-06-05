import { Link } from "react-router-dom"
import { GraduationCap } from "lucide-react"

import { catalog } from "@/lib/catalog"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-background shadow-sm">
            <GraduationCap className="size-5" />
          </span>
          <div className="leading-tight">
            <span className="block text-lg font-semibold tracking-tight">
              SyllaBee
            </span>
            <span className="block text-[11px] text-muted-foreground">
              Curricula &amp; Syllabi Explorer
            </span>
          </div>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          <Link to="/" className="transition-colors hover:text-foreground">
            Majors
          </Link>
          <span className="tabular-nums">
            {catalog.stats.courses} courses &middot; {catalog.stats.syllabi}{" "}
            syllabi
          </span>
        </nav>
      </div>
    </header>
  )
}
