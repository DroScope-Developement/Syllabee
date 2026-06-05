import type { Course } from "../../types/course";

interface CourseResourcesPanelProps {
  resources: NonNullable<Course["resources"]>;
}

function ResourceCard({
  badge,
  badgeClass,
  title,
  description,
  href,
  external,
}: {
  badge: string;
  badgeClass: string;
  title: string;
  description: string;
  href: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="group flex flex-col rounded-xl border border-stone-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <span
        className={`mb-2 inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badgeClass}`}
      >
        {badge}
      </span>
      <p className="font-medium text-stone-900 group-hover:text-honey-900">
        {title}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-stone-500">
        {description}
      </p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-honey-700">
        Open
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </span>
    </a>
  );
}

export function CourseResourcesPanel({ resources }: CourseResourcesPanelProps) {
  const { syllabus, textbook, coursePage } = resources;

  return (
    <section className="mb-8 rounded-2xl border border-honey-200/60 bg-gradient-to-b from-white to-honey-50/40 p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
        Course materials
      </p>
      <h2 className="mt-1 font-serif text-lg text-stone-900">Three-source test</h2>
      <p className="mt-1 text-sm text-stone-500">
        This prebuilt course combines a syllabus PDF, textbook PDF, and the
        Harvard course webpage.
      </p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        <li>
          <ResourceCard
            badge="Syllabus"
            badgeClass="bg-amber-50 text-amber-900 ring-amber-200"
            title={syllabus.fileName}
            description="Parsed for course metadata and topic structure."
            href={syllabus.path}
          />
        </li>
        <li>
          <ResourceCard
            badge="Textbook"
            badgeClass="bg-indigo-50 text-indigo-800 ring-indigo-200"
            title={textbook.title}
            description={
              textbook.pageCount
                ? `${textbook.pageCount} pages · full course handouts compilation.`
                : "Full course handouts compilation."
            }
            href={textbook.path}
          />
        </li>
        <li>
          <ResourceCard
            badge="Webpage"
            badgeClass="bg-emerald-50 text-emerald-800 ring-emerald-200"
            title={coursePage.title}
            description="Unit 00–35 structure, exams, and external links."
            href={coursePage.url}
            external
          />
        </li>
      </ul>
    </section>
  );
}
