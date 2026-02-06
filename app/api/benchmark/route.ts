import { NextRequest, NextResponse } from "next/server";
import { getBenchmarkForSociety } from "../../../lib/benchmark";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const societyId = searchParams.get("societyId");

  if (!societyId) {
    return NextResponse.json(
      { error: "societyId query parameter is required" },
      { status: 400 }
    );
  }

  const result = getBenchmarkForSociety(societyId);

  if (!result) {
    return NextResponse.json(
      { error: `No data found for society: ${societyId}` },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}
