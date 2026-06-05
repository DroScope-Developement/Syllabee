import type { ProfessorInfo, UniversityInfo } from "../../types/course";
import {
  CourseInstitutionMeta,
  ProfessorAvatar,
} from "./CourseInstitutionMeta";

export interface CourseRowProps {
  title: string;
  subtitle?: string;
  subjectTag?: string;
  meta: string;
  university?: UniversityInfo;
  professor?: ProfessorInfo;
  onClick: () => void;
  disabled?: boolean;
  loadingLabel?: string;
}

export function CourseRow({
  title,
  subtitle,
  subjectTag,
  meta,
  university,
  professor,
  onClick,
  disabled,
  loadingLabel,
}: CourseRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-start gap-4 rounded-2xl border border-stone-200 bg-white p-4 text-left transition-all hover:border-honey-300 hover:shadow-sm disabled:cursor-wait disabled:opacity-70"
    >
      <ProfessorAvatar professor={professor} />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-stone-900 group-hover:text-honey-900">
          {loadingLabel ?? title}
        </p>
        {!loadingLabel && subtitle && (
          <p className="mt-0.5 truncate text-sm text-stone-500">{subtitle}</p>
        )}
        {!loadingLabel && (
          <CourseInstitutionMeta university={university} professor={professor} />
        )}
        <p className="mt-2 text-xs text-stone-400">{meta}</p>
        {!loadingLabel && subjectTag && (
          <span className="mt-2 inline-flex rounded-full bg-honey-50 px-2 py-0.5 text-[11px] font-medium text-honey-800">
            {subjectTag}
          </span>
        )}
      </div>

      <svg
        className="mt-1 h-5 w-5 shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-honey-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
