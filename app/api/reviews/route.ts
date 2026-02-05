import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { parseReviews, filterReviewsForPersona } from "../../../lib/reviews";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const societyId = searchParams.get("societyId");
  const archetype = searchParams.get("archetype");

  if (!societyId) {
    return NextResponse.json({ error: "societyId required" }, { status: 400 });
  }

  const knowledgePath = path.join(
    process.cwd(),
    "knowledge",
    `${societyId}.md`
  );
  try {
    const knowledge = fs.readFileSync(knowledgePath, "utf8");
    const allReviews = parseReviews(knowledge);

    if (archetype) {
      const filtered = filterReviewsForPersona(allReviews, archetype, 8);
      const activeIds = new Set(filtered.map((r) => r.id));
      // Return all reviews but mark which are active for this persona
      const reviews = allReviews.map((r) => ({
        ...r,
        active: activeIds.has(r.id),
      }));
      return NextResponse.json({ reviews, activeCount: activeIds.size });
    }

    return NextResponse.json({ reviews: allReviews });
  } catch {
    return NextResponse.json({ reviews: [] });
  }
}
