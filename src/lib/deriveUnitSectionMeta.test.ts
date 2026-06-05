import { describe, expect, it } from "vitest";
import { handoutContentCache } from "../data/prebuilt/handoutContentCache";
import {
  buildSectionMetaFromHandouts,
  deriveUnitSectionTitle,
  isGenericHandoutTitle,
} from "./deriveUnitSectionMeta";

describe("deriveUnitSectionMeta", () => {
  it("flags generic handout titles", () => {
    expect(isGenericHandoutTitle("Lecture notes")).toBe(true);
    expect(isGenericHandoutTitle("Unit 9: Worksheet")).toBe(true);
    expect(isGenericHandoutTitle("Important functions")).toBe(false);
    expect(isGenericHandoutTitle("Unit 8: Derivative Rules")).toBe(false);
  });

  it("uses meaningful lecture titles that do not start with Unit", () => {
    const lecture15 = handoutContentCache["/harvard-handouts/lecture15.pdf"];
    expect(
      deriveUnitSectionTitle(15, "Unit 15", lecture15, undefined),
    ).toBe("Unit 15: Important functions");
  });

  it("infers descriptors from lecture content when titles are generic", () => {
    const lecture09 = handoutContentCache["/harvard-handouts/lecture09.pdf"];
    expect(
      deriveUnitSectionTitle(9, "Unit 9", lecture09, undefined),
    ).toBe("Unit 9: Hospital's Rule");

    const lecture10 = handoutContentCache["/harvard-handouts/lecture10.pdf"];
    expect(
      deriveUnitSectionTitle(10, "Unit 10", lecture10, undefined),
    ).toBe("Unit 10: Infinity");

    const lecture19 = handoutContentCache["/harvard-handouts/lecture19.pdf"];
    expect(
      deriveUnitSectionTitle(19, "Unit 19", lecture19, undefined),
    ).toBe("Unit 19: Related Rates");
  });

  it("prefers full Unit titles from lecture or worksheet handouts", () => {
    const lecture08 = handoutContentCache["/harvard-handouts/lecture08.pdf"];
    expect(
      deriveUnitSectionTitle(8, "Unit 8", lecture08, undefined),
    ).toBe("Unit 8: Derivative Rules");
  });

  it("merges worksheet content into section descriptions", () => {
    const lecture01 = handoutContentCache["/harvard-handouts/lecture01.pdf"];
    const worksheet01 = handoutContentCache["/harvard-handouts/worksheet01.pdf"];
    const meta = buildSectionMetaFromHandouts(
      1,
      "Unit 1",
      lecture01,
      worksheet01,
    );

    expect(meta.title).toBe("Unit 1: What is Calculus?");
    expect(meta.description).toMatch(/triangular/i);
    expect(meta.description).toMatch(/tetrahedral/i);
  });
});
