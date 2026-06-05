/** Snapshot of course structure from the Harvard Math 1a course page. */
export interface Math1aWebUnit {
  number: number;
  label: string;
  lectureFetchPath?: string;
  lectureUrl?: string;
  worksheetFetchPath?: string;
  worksheetUrl?: string;
}

export interface Math1aWebpageSnapshot {
  title: string;
  subtitle: string;
  url: string;
  term: string;
  courseCode: string;
  units: Math1aWebUnit[];
}

const EXTERNAL_BASE =
  "https://people.math.harvard.edu/~knill/teaching/math1a2024/handouts";
const FETCH_BASE = "/harvard-handouts";

/** Units 00–35 from the [Math 1a Spring 2024](https://people.math.harvard.edu/~knill/teaching/math1a2024/) handouts table. */
export const math1aHarvardWebpage: Math1aWebpageSnapshot = {
  title: "Math 1a Spring 2024",
  subtitle: "Introduction to Calculus",
  url: "https://people.math.harvard.edu/~knill/teaching/math1a2024/",
  term: "Spring 2024",
  courseCode: "Math 1a",
  units: Array.from({ length: 36 }, (_, number) => {
    const padded = String(number).padStart(2, "0");
    const unit: Math1aWebUnit = {
      number,
      label: `Unit ${padded}`,
      lectureFetchPath: `${FETCH_BASE}/lecture${padded}.pdf`,
      lectureUrl: `${EXTERNAL_BASE}/lecture${padded}.pdf`,
    };
    if (number > 0) {
      unit.worksheetFetchPath = `${FETCH_BASE}/worksheet${padded}.pdf`;
      unit.worksheetUrl = `${EXTERNAL_BASE}/worksheet${padded}.pdf`;
    }
    return unit;
  }),
};

/**
 * Fetches live course page data.
 * **Plug in a real scraper/API here** — for now returns the bundled snapshot
 * because browser CORS blocks direct fetches to the Harvard course site.
 */
export async function fetchMath1aCourseWebpage(): Promise<Math1aWebpageSnapshot> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return math1aHarvardWebpage;
}
