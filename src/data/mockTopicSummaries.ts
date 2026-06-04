import type { TopicSummary } from "../types/syllabus";

/**
 * Mock summaries keyed by topic title (case-insensitive lookup at fetch time).
 * Replace this map with live API responses when wiring real data sources.
 */
export const mockTopicSummaries: Record<string, TopicSummary[]> = {
  "intuitive notion of a limit": [
    {
      sourceId: "wikipedia",
      sourceName: "Wikipedia",
      excerpt:
        "In mathematics, a limit is the value that a function approaches as the input approaches some value. Limits are essential to calculus and are used to define continuity, derivatives, and integrals.",
      url: "https://en.wikipedia.org/wiki/Limit_(mathematics)",
    },
    {
      sourceId: "khan-academy",
      sourceName: "Khan Academy",
      excerpt:
        "Limits describe what a function is 'heading toward' at a particular input, even when the function isn't defined at that exact point. They're the foundation for derivatives and integrals.",
      url: "https://www.khanacademy.org/math/ap-calculus-ab/ab-limits-new",
    },
    {
      sourceId: "openstax",
      sourceName: "OpenStax",
      excerpt:
        "The concept of a limit is fundamental to all of calculus. We begin our study of calculus by considering the limit concept, starting with an intuitive approach and then proceeding to a more rigorous definition.",
      url: "https://openstax.org/books/calculus-volume-1/pages/2-introduction",
    },
  ],
  "one-sided limits and limit laws": [
    {
      sourceId: "khan-academy",
      sourceName: "Khan Academy",
      excerpt:
        "One-sided limits examine the behavior of a function as x approaches a value from only the left or only the right. Limit laws let you combine simpler limits algebraically.",
      url: "https://www.khanacademy.org/math/ap-calculus-ab/ab-limits-new/ab-one-sided-limits",
    },
    {
      sourceId: "openstax",
      sourceName: "OpenStax",
      excerpt:
        "Limit laws provide a toolkit for evaluating limits of combined functions without returning to the formal definition each time.",
      url: "https://openstax.org/books/calculus-volume-1/pages/2-2-the-limit-of-a-function",
    },
    {
      sourceId: "mit-ocw",
      sourceName: "MIT OpenCourseWare",
      excerpt:
        "Lecture notes on computing limits using algebraic manipulation, one-sided approaches, and the squeeze theorem.",
      url: "https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/",
    },
  ],
  "continuity and the intermediate value theorem": [
    {
      sourceId: "wikipedia",
      sourceName: "Wikipedia",
      excerpt:
        "In mathematical analysis, the intermediate value theorem states that if f is a continuous function whose domain contains the interval [a, b], then it takes on any value between f(a) and f(b) at some point within the interval.",
      url: "https://en.wikipedia.org/wiki/Intermediate_value_theorem",
    },
    {
      sourceId: "openstax",
      sourceName: "OpenStax",
      excerpt:
        "A function is continuous at a point if the limit exists and equals the function value. Continuity on an interval enables powerful theorems like the IVT.",
      url: "https://openstax.org/books/calculus-volume-1/pages/2-4-continuity",
    },
  ],
  "definition of the derivative": [
    {
      sourceId: "khan-academy",
      sourceName: "Khan Academy",
      excerpt:
        "The derivative measures instantaneous rate of change. It is defined as the limit of the difference quotient as the interval width approaches zero.",
      url: "https://www.khanacademy.org/math/ap-calculus-ab/ab-differentiation-1-new",
    },
    {
      sourceId: "mit-ocw",
      sourceName: "MIT OpenCourseWare",
      excerpt:
        "Derivatives represent slopes of tangent lines and rates of change. The formal definition uses limits of average rates over shrinking intervals.",
      url: "https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/",
    },
    {
      sourceId: "wikipedia",
      sourceName: "Wikipedia",
      excerpt:
        "The derivative of a function of a real variable measures the sensitivity to change of the function value with respect to a change in its argument.",
      url: "https://en.wikipedia.org/wiki/Derivative",
    },
  ],
  "product, quotient, and chain rules": [
    {
      sourceId: "khan-academy",
      sourceName: "Khan Academy",
      excerpt:
        "Differentiation rules let you find derivatives of products, quotients, and compositions without returning to the limit definition each time.",
      url: "https://www.khanacademy.org/math/ap-calculus-ab/ab-differentiation-2-new",
    },
    {
      sourceId: "openstax",
      sourceName: "OpenStax",
      excerpt:
        "The product rule, quotient rule, and chain rule are the workhorses of symbolic differentiation for combined and nested functions.",
      url: "https://openstax.org/books/calculus-volume-1/pages/3-3-differentiation-rules",
    },
  ],
  "implicit differentiation": [
    {
      sourceId: "openstax",
      sourceName: "OpenStax",
      excerpt:
        "When a curve is defined implicitly by an equation in x and y, we differentiate both sides with respect to x and solve for dy/dx.",
      url: "https://openstax.org/books/calculus-volume-1/pages/4-6-derivatives-of-inverse-functions",
    },
    {
      sourceId: "khan-academy",
      sourceName: "Khan Academy",
      excerpt:
        "Implicit differentiation finds dy/dx for curves that aren't easily written as y = f(x), such as circles and ellipses.",
      url: "https://www.khanacademy.org/math/ap-calculus-ab/ab-differentiation-2-new/ab-implicit-differentiation",
    },
  ],
  "related rates problems": [
    {
      sourceId: "khan-academy",
      sourceName: "Khan Academy",
      excerpt:
        "Related rates problems involve quantities that change with respect to time and are linked by an equation. Differentiate with respect to time to relate their rates.",
      url: "https://www.khanacademy.org/math/ap-calculus-ab/ab-applications-of-differentiation-new/ab-4-5/v/rate-of-change-of-distance-between-point-on-line-and-y-axis",
    },
    {
      sourceId: "mit-ocw",
      sourceName: "MIT OpenCourseWare",
      excerpt:
        "Classic related-rates examples include expanding balloons, sliding ladders, and filling conical tanks.",
      url: "https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/",
    },
  ],
  "critical points and the first derivative test": [
    {
      sourceId: "openstax",
      sourceName: "OpenStax",
      excerpt:
        "Critical points occur where f′(x) = 0 or f′ is undefined. The first derivative test classifies them as local maxima or minima by checking sign changes.",
      url: "https://openstax.org/books/calculus-volume-1/pages/4-3-maxima-and-minima",
    },
    {
      sourceId: "khan-academy",
      sourceName: "Khan Academy",
      excerpt:
        "Analyze where a function increases or decreases to locate turning points and sketch accurate graphs.",
      url: "https://www.khanacademy.org/math/ap-calculus-ab/ab-diff-analytical-applications-new",
    },
  ],
  "concavity and the second derivative test": [
    {
      sourceId: "wikipedia",
      sourceName: "Wikipedia",
      excerpt:
        "Concavity describes whether a function curves upward or downward. The second derivative test uses f″ to classify critical points when f′ = 0.",
      url: "https://en.wikipedia.org/wiki/Derivative_test",
    },
    {
      sourceId: "openstax",
      sourceName: "OpenStax",
      excerpt:
        "If f″ > 0 on an interval, the graph is concave up; if f″ < 0, concave down. Inflection points mark changes in concavity.",
      url: "https://openstax.org/books/calculus-volume-1/pages/4-4-concavity-and-inflection-points",
    },
  ],
  "applied optimization": [
    {
      sourceId: "khan-academy",
      sourceName: "Khan Academy",
      excerpt:
        "Optimization problems ask you to maximize or minimize a quantity subject to constraints — set up a function, find critical points, and verify extrema.",
      url: "https://www.khanacademy.org/math/ap-calculus-ab/ab-diff-analytical-applications-new/ab-5-11/v/optimization-problem",
    },
    {
      sourceId: "mit-ocw",
      sourceName: "MIT OpenCourseWare",
      excerpt:
        "Real-world optimization spans fencing problems, revenue maximization, and minimal surface area designs.",
      url: "https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/",
    },
  ],
  "antiderivatives and indefinite integrals": [
    {
      sourceId: "openstax",
      sourceName: "OpenStax",
      excerpt:
        "Antiderivatives reverse differentiation. The indefinite integral ∫f(x) dx represents the family of all antiderivatives plus a constant C.",
      url: "https://openstax.org/books/calculus-volume-1/pages/5-2-the-definite-integral",
    },
    {
      sourceId: "khan-academy",
      sourceName: "Khan Academy",
      excerpt:
        "Finding antiderivatives is the reverse of finding derivatives — start with basic rules for power, exponential, and trigonometric functions.",
      url: "https://www.khanacademy.org/math/ap-calculus-ab/ab-integration-new",
    },
  ],
  "riemann sums and definite integrals": [
    {
      sourceId: "wikipedia",
      sourceName: "Wikipedia",
      excerpt:
        "In mathematics, a Riemann sum is a certain kind of approximation of an integral by a finite sum. It is named after nineteenth century German mathematician Bernhard Riemann.",
      url: "https://en.wikipedia.org/wiki/Riemann_sum",
    },
    {
      sourceId: "openstax",
      sourceName: "OpenStax",
      excerpt:
        "Definite integrals accumulate signed area under a curve. Riemann sums approximate this area using rectangles and refine as partition width shrinks.",
      url: "https://openstax.org/books/calculus-volume-1/pages/5-2-the-definite-integral",
    },
  ],
  "fundamental theorem of calculus": [
    {
      sourceId: "khan-academy",
      sourceName: "Khan Academy",
      excerpt:
        "The Fundamental Theorem connects differentiation and integration: if F is an antiderivative of f, then ∫ₐᵇ f(x) dx = F(b) − F(a).",
      url: "https://www.khanacademy.org/math/ap-calculus-ab/ab-integration-new/ab-6-7/v/fundamental-theorem-of-calculus",
    },
    {
      sourceId: "mit-ocw",
      sourceName: "MIT OpenCourseWare",
      excerpt:
        "FTC Part 1 gives a formula for the derivative of an integral with variable upper limit; Part 2 evaluates definite integrals via antiderivatives.",
      url: "https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/",
    },
    {
      sourceId: "wikipedia",
      sourceName: "Wikipedia",
      excerpt:
        "The fundamental theorem of calculus is a theorem that links the concept of differentiating a function with the concept of integrating a function.",
      url: "https://en.wikipedia.org/wiki/Fundamental_theorem_of_calculus",
    },
  ],
};

/** Fallback summaries when a topic isn't in the mock map. */
export function getGenericSummaries(topic: string): TopicSummary[] {
  return [
    {
      sourceId: "wikipedia",
      sourceName: "Wikipedia",
      excerpt: `Explore encyclopedic coverage of "${topic}" including definitions, history, and related concepts.`,
      url: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(topic)}`,
    },
    {
      sourceId: "khan-academy",
      sourceName: "Khan Academy",
      excerpt: `Browse video lessons and practice exercises related to "${topic}".`,
      url: "https://www.khanacademy.org/search?page_search_query=" + encodeURIComponent(topic),
    },
  ];
}
