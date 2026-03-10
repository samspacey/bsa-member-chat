import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { getBenchmarkForSociety } from "../../../lib/benchmark";
import societiesData from "../../../societies.json";

export const maxDuration = 30;

interface Society {
  id: string;
  name: string;
  shortName: string;
  emoji: string;
  region: string;
  size: string;
  tagline: string;
  color: string;
}

const societies: Society[] = societiesData as Society[];

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

function generatePDF(society: Society, benchmarkData: ReturnType<typeof getBenchmarkForSociety>) {
  if (!benchmarkData) throw new Error("No benchmark data");

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const totalSocieties = benchmarkData.totalSocieties;
  const scores = benchmarkData.scores;

  // ── Colour palette ──────────────────────────────────────────────────────────
  const navy:     [number, number, number] = [15,  48,  87 ];
  const darkGrey: [number, number, number] = [50,  50,  50 ];
  const midGrey:  [number, number, number] = [120, 120, 120];
  const lightGrey:[number, number, number] = [210, 210, 210];
  const paleBlue: [number, number, number] = [240, 245, 251];
  const green:    [number, number, number] = [22,  163, 74 ];
  const amber:    [number, number, number] = [180, 130, 20 ];
  const red:      [number, number, number] = [220, 50,  50 ];
  const greenFill:[number, number, number] = [34,  197, 94 ];
  const amberFill:[number, number, number] = [250, 180, 50 ];
  const redFill:  [number, number, number] = [239, 68,  68 ];

  // ── Column positions (all in mm from left edge) ─────────────────────────────
  // contentWidth = 180mm (margin 15 → 195)
  const colFactor  = margin;          // Factor label, ~52mm wide → ends ~67
  const colScore   = margin + 53;     // Score value, centred in ~10mm window
  const colAvg     = margin + 65;     // Industry avg, centred in ~10mm window
  const colBar     = margin + 77;     // Bar chart, 55mm wide → ends 132
  const colBarW    = 55;
  const colRank    = margin + 134;    // Rank, centred in ~18mm window
  const colStatus  = margin + 154;    // Status badge, 26mm wide → ends 195
  const colStatusW = 26;

  let y = 18;

  // ── Top accent bar ──────────────────────────────────────────────────────────
  doc.setFillColor(...navy);
  doc.rect(0, 0, pageWidth, 8, "F");

  // ── Header ──────────────────────────────────────────────────────────────────
  y = 20;
  doc.setFontSize(21);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...navy);
  doc.text(society.name, pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...midGrey);
  doc.text("Member Experience Benchmark Report", pageWidth / 2, y, { align: "center" });
  y += 6;

  const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  doc.setFontSize(8.5);
  doc.setTextColor(160, 160, 160);
  doc.text(`Woodhurst Consulting  •  ${dateStr}`, pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setDrawColor(...lightGrey);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Summary box ─────────────────────────────────────────────────────────────
  const bestScore  = scores.reduce((best, s) => s.score > best.score ? s : best, scores[0]);
  const worstGap   = scores.reduce((worst, s) => (s.score - s.average) < (worst.score - worst.average) ? s : worst, scores[0]);
  const aboveCount = scores.filter(s => (s.score - s.average) >= 0.5).length;
  const belowCount = scores.filter(s => (s.score - s.average) < -0.5).length;

  const boxH = 26;
  doc.setFillColor(...paleBlue);
  doc.roundedRect(margin, y, contentWidth, boxH, 3, 3, "F");
  doc.setDrawColor(200, 220, 240);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, boxH, 3, 3, "S");

  const bY = y + 8;                              // text baseline inside box
  const col3rd = contentWidth / 3;

  // Panel 1 – Overall Position
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...navy);
  doc.text("Overall Position", margin + 6, bY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...darkGrey);
  doc.text(`${aboveCount} of ${scores.length} factors above industry average`, margin + 6, bY + 6);
  doc.text(`${belowCount} of ${scores.length} factors below industry average`, margin + 6, bY + 11);

  // Divider 1
  const d1 = margin + col3rd;
  doc.setDrawColor(200, 220, 240);
  doc.setLineWidth(0.5);
  doc.line(d1, y + 4, d1, y + boxH - 4);

  // Panel 2 – Top Strength
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...green);
  doc.text("Top Strength", d1 + 5, bY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...darkGrey);
  const bestLabel = bestScore.factor.length > 22 ? bestScore.factor.slice(0, 21) + "…" : bestScore.factor;
  doc.text(bestLabel, d1 + 5, bY + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...midGrey);
  doc.text(`Score: ${bestScore.score.toFixed(1)}  (avg ${bestScore.average.toFixed(1)})`, d1 + 5, bY + 11);

  // Divider 2
  const d2 = margin + col3rd * 2;
  doc.setDrawColor(200, 220, 240);
  doc.line(d2, y + 4, d2, y + boxH - 4);

  // Panel 3 – Biggest Gap
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...red);
  doc.text("Biggest Gap", d2 + 5, bY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...darkGrey);
  const gapLabel = worstGap.factor.length > 22 ? worstGap.factor.slice(0, 21) + "…" : worstGap.factor;
  doc.text(gapLabel, d2 + 5, bY + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...midGrey);
  doc.text(`Score: ${worstGap.score.toFixed(1)}  (avg ${worstGap.average.toFixed(1)})`, d2 + 5, bY + 11);

  y += boxH + 9;

  // ── Table header ─────────────────────────────────────────────────────────────
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...midGrey);
  doc.text("Factor",  colFactor, y);
  doc.text("Score",   colScore  + 5,  y, { align: "center" });
  doc.text("Avg",     colAvg    + 5,  y, { align: "center" });
  // Bar axis labels
  doc.text("0",       colBar,          y);
  doc.text("5",       colBar + colBarW / 2, y, { align: "center" });
  doc.text("10",      colBar + colBarW, y, { align: "right" });
  doc.text("Rank",    colRank   + 9,  y, { align: "center" });
  doc.text("Status",  colStatus + colStatusW / 2, y, { align: "center" });
  y += 2;

  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // ── Table rows ───────────────────────────────────────────────────────────────
  const rowH = 13;
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i];
    const diff = s.score - s.average;

    let statusLabel: string;
    let statusRGB: [number, number, number];
    let barRGB:    [number, number, number];

    if (diff >= 0.5) {
      statusLabel = "Above avg"; statusRGB = green;  barRGB = greenFill;
    } else if (diff >= -0.5) {
      statusLabel = "Near avg";  statusRGB = amber;  barRGB = amberFill;
    } else {
      statusLabel = "Below avg"; statusRGB = red;    barRGB = redFill;
    }

    // Alternating row background
    if (i % 2 === 0) {
      doc.setFillColor(249, 249, 249);
      doc.rect(margin, y - 4, contentWidth, rowH, "F");
    }

    const textY = y + 1;   // text baseline
    const barY  = y - 2;   // bar top edge
    const barH  = 5;       // bar height

    // Factor name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...darkGrey);
    doc.text(s.factor, colFactor, textY);

    // Score (navy bold)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...navy);
    doc.text(s.score.toFixed(1), colScore + 5, textY, { align: "center" });

    // Industry avg
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...midGrey);
    doc.text(s.average.toFixed(1), colAvg + 5, textY, { align: "center" });

    // Bar: grey background
    doc.setFillColor(225, 225, 225);
    doc.roundedRect(colBar, barY, colBarW, barH, 1, 1, "F");

    // Bar: coloured score fill
    const scoreBarW = Math.max(2, (s.score / 10) * colBarW);
    doc.setFillColor(...barRGB);
    doc.roundedRect(colBar, barY, scoreBarW, barH, 1, 1, "F");

    // Bar: industry average tick
    const avgX = colBar + (s.average / 10) * colBarW;
    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(0.8);
    doc.line(avgX, barY - 1, avgX, barY + barH + 1);

    // Rank
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...midGrey);
    doc.text(`${ordinal(s.rank)}`, colRank + 9, textY, { align: "center" });

    // Status badge (filled rounded rect, white text)
    const badgeH   = 5.5;
    const badgeTopY = barY - 0.5;
    doc.setFillColor(...statusRGB);
    doc.roundedRect(colStatus, badgeTopY, colStatusW, badgeH, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(statusLabel, colStatus + colStatusW / 2, badgeTopY + 3.7, { align: "center" });

    // Row divider (skip last)
    if (i < scores.length - 1) {
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, y + rowH - 4, pageWidth - margin, y + rowH - 4);
    }

    y += rowH;
  }

  y += 5;

  // ── Legend ───────────────────────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...midGrey);
  doc.text("Legend:", margin, y);

  const legendItems: Array<[string, [number, number, number]]> = [
    ["Above avg", green ],
    ["Near avg",  amber ],
    ["Below avg", red   ],
  ];
  let lx = margin + 15;
  for (const [label, colour] of legendItems) {
    const bw = 20, bh = 5;
    doc.setFillColor(...colour);
    doc.roundedRect(lx, y - 3.8, bw, bh, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(label, lx + bw / 2, y - 0.3, { align: "center" });
    lx += bw + 4;
  }

  // Avg tick legend
  doc.setDrawColor(50, 50, 50);
  doc.setLineWidth(0.8);
  doc.line(lx + 3, y - 4, lx + 3, y + 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...midGrey);
  doc.text("= Industry average", lx + 6, y);

  y += 10;

  // ── Methodology ──────────────────────────────────────────────────────────────
  doc.setDrawColor(...lightGrey);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...darkGrey);
  doc.text("Methodology", margin, y);
  y += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...midGrey);
  const methodology = `Scores are derived from keyword-based sentiment analysis of customer reviews from Smart Money People and Trustpilot. Each factor is scored 1–10 by the ratio of positive to negative keyword matches in reviews. Rankings are calculated across all ${totalSocieties} building societies in the benchmark. This report is generated automatically and should be considered alongside other data sources.`;
  const methodLines = doc.splitTextToSize(methodology, contentWidth);
  doc.text(methodLines, margin, y);

  // ── Footer ───────────────────────────────────────────────────────────────────
  const footerY = pageHeight - 8;
  doc.setDrawColor(...lightGrey);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(
    "Woodhurst Consulting  |  Data & Digital Advisory  |  Confidential",
    pageWidth / 2, footerY, { align: "center" }
  );

  return Buffer.from(doc.output("arraybuffer"));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, societyId } = body;

    if (!societyId) {
      return NextResponse.json({ error: "societyId is required" }, { status: 400 });
    }

    const society = societies.find((s: Society) => s.id === societyId);
    if (!society) {
      return NextResponse.json({ error: "Society not found" }, { status: 404 });
    }

    const benchmarkData = getBenchmarkForSociety(societyId);
    if (!benchmarkData) {
      return NextResponse.json({ error: "Benchmark data not available" }, { status: 404 });
    }

    const pdfBuffer = generatePDF(society, benchmarkData);

    // If email provided, send via relay server (Exchange / sam.spacey@woodhurst.com)
    if (email) {
      if (!email.includes("@") || !email.includes(".")) {
        return NextResponse.json({ error: "Invalid email" }, { status: 400 });
      }

      const relayUrl = process.env.EMAIL_RELAY_URL;
      const relayToken = process.env.EMAIL_RELAY_TOKEN;

      if (!relayUrl || !relayToken) {
        console.error("[EMAIL] Relay not configured");
        return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
      }

      const relayRes = await fetch(`${relayUrl}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${relayToken}`,
        },
        body: JSON.stringify({
          email,
          societyId,
          societyName: society.name,
          totalSocieties: benchmarkData.totalSocieties,
        }),
      });

      if (!relayRes.ok) {
        const err = await relayRes.json().catch(() => ({ error: "Unknown error" }));
        console.error("[EMAIL] Relay error:", err);
        return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
      }

      console.log(`[EMAIL] Sent to ${email} for ${society.name}`);
      return NextResponse.json({ success: true, message: "Report sent to your email" });
    }

    // No email — return PDF as download
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${societyId}-benchmark-report.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[PDF] Error:", msg);
    return NextResponse.json({ error: "Failed to generate report", detail: msg }, { status: 500 });
  }
}
