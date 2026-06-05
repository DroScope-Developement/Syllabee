import { Badge } from "@/components/ui/badge"
import { categoryLabel } from "@/lib/catalog"
import { cn } from "@/lib/utils"

const CATEGORY_STYLES: Record<string, string> = {
  cs: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  ce: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  math: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  science: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  nursing: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  engineering: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  business: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  psychology: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300",
  general: "border-slate-500/30 bg-slate-500/10 text-slate-300",
}

export function CategoryBadge({
  category,
  className,
}: {
  category: string
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        CATEGORY_STYLES[category] ?? CATEGORY_STYLES.general,
        "font-medium",
        className
      )}
    >
      {categoryLabel(category)}
    </Badge>
  )
}
