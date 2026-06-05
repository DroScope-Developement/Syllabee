import { useState } from "react";
import {
  DEFAULT_UNIVERSITY_LOGO,
  professorInitials,
} from "../../lib/inferCourseInstitution";
import type { ProfessorInfo, UniversityInfo } from "../../types/course";

export function ProfessorAvatar({
  professor,
  size = "md",
}: {
  professor?: ProfessorInfo;
  size?: "md" | "lg";
}) {
  const [imgError, setImgError] = useState(false);
  const name = professor?.name ?? "Instructor";
  const initials = professorInitials(name);
  const sizeClass = size === "lg" ? "h-14 w-14 text-base" : "h-12 w-12 text-sm";

  if (professor?.photoUrl && !imgError) {
    return (
      <img
        src={professor.photoUrl}
        alt={name}
        className={`${sizeClass} shrink-0 rounded-full object-cover ring-2 ring-stone-100`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-honey-100 font-bold text-honey-800 ring-2 ring-stone-100`}
      aria-hidden
    >
      {initials || "?"}
    </div>
  );
}

export function UniversityBadge({
  university,
}: {
  university?: UniversityInfo;
}) {
  const name = university?.name ?? "University not listed";
  const logoUrl = university?.logoUrl ?? DEFAULT_UNIVERSITY_LOGO;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <img
        src={logoUrl}
        alt=""
        className="h-5 w-5 shrink-0 rounded object-contain"
      />
      <span className="truncate text-sm text-stone-600">{name}</span>
    </div>
  );
}

export function ProfessorLabel({
  professor,
}: {
  professor?: ProfessorInfo;
}) {
  if (!professor?.name) {
    return (
      <p className="truncate text-sm text-stone-500">Instructor not listed</p>
    );
  }

  return (
    <p className="truncate text-sm text-stone-500">Prof. {professor.name}</p>
  );
}

export function CourseInstitutionMeta({
  university,
  professor,
}: {
  university?: UniversityInfo;
  professor?: ProfessorInfo;
}) {
  return (
    <div className="mt-2 space-y-1">
      <UniversityBadge university={university} />
      <ProfessorLabel professor={professor} />
    </div>
  );
}
