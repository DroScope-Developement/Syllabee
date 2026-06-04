import type { SyllabusOutlineData } from "../types/syllabus";

export const mockSyllabus: SyllabusOutlineData = {
  courseTitle: "Introduction to Calculus I",
  courseCode: "MATH 101",
  term: "Fall 2026",
  sections: [
    {
      id: "sec-1",
      title: "Unit 1 — Limits & Continuity",
      description: "Foundations of differential calculus",
      subpoints: [
        {
          id: "sp-1-1",
          title: "Intuitive notion of a limit",
        },
        {
          id: "sp-1-2",
          title: "One-sided limits and limit laws",
        },
        {
          id: "sp-1-3",
          title: "Continuity and the Intermediate Value Theorem",
        },
      ],
    },
    {
      id: "sec-2",
      title: "Unit 2 — Derivatives",
      description: "Rates of change and differentiation rules",
      subpoints: [
        {
          id: "sp-2-1",
          title: "Definition of the derivative",
        },
        {
          id: "sp-2-2",
          title: "Product, quotient, and chain rules",
        },
        {
          id: "sp-2-3",
          title: "Implicit differentiation",
          children: [
            {
              id: "sp-2-3-a",
              title: "Related rates problems",
            },
          ],
        },
      ],
    },
    {
      id: "sec-3",
      title: "Unit 3 — Applications of Derivatives",
      description: "Optimization, curve sketching, and motion",
      subpoints: [
        {
          id: "sp-3-1",
          title: "Critical points and the first derivative test",
        },
        {
          id: "sp-3-2",
          title: "Concavity and the second derivative test",
        },
        {
          id: "sp-3-3",
          title: "Applied optimization",
        },
      ],
    },
    {
      id: "sec-4",
      title: "Unit 4 — Integration",
      description: "Antiderivatives and the Fundamental Theorem",
      subpoints: [
        {
          id: "sp-4-1",
          title: "Antiderivatives and indefinite integrals",
        },
        {
          id: "sp-4-2",
          title: "Riemann sums and definite integrals",
        },
        {
          id: "sp-4-3",
          title: "Fundamental Theorem of Calculus",
        },
      ],
    },
  ],
};
