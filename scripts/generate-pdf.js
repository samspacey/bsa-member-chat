#!/usr/bin/env node
/**
 * Generate a benchmark PDF for a given society.
 * Usage: node generate-pdf.js <societyId> <outputPath>
 */

const { jsPDF } = require("jspdf");
const fs = require("fs");
const path = require("path");

const societyId = process.argv[2];
const outputPath = process.argv[3];

if (!societyId || !outputPath) {
  console.error("Usage: node generate-pdf.js <societyId> <outputPath>");
  process.exit(1);
}

const societies = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "societies.json"), "utf8")
);
const society = societies.find((s) => s.id === societyId);
if (!society) {
  console.error(`Society not found: ${societyId}`);
  process.exit(1);
}

const reviewsDir = path.join(__dirname, "..", "data", "reviews");

const FACTOR_KEYWORDS = {
  "Service Quality": {
    positive: ["friendly", "helpful", "professional", "excellent", "amazing", "outstanding", "wonderful", "brilliant", "fantastic", "great service", "lovely", "welcoming", "patient", "caring", "knowledgeable", "efficient", "personal", "warm"],
    negative: ["rude", "unhelpful", "poor service", "terrible", "awful", "appalling", "disgraceful", "dreadful", "worst", "incompetent", "useless", "dismissive", "unprofessional", "shocking"]
  },
  "Digital Experience": {
    positive: ["easy to use", "user friendly", "website works", "digital", "mobile app", "convenient online", "quick online", "simple online", "modern app", "good app"],
    negative: ["app crash", "website down", "online broken", "clunky", "outdated website", "difficult online", "crash", "glitch", "stone age", "archaic", "can't login", "error page"]
  },
  "Communication": {
    positive: ["kept informed", "communicated well", "clear communication", "transparent", "responsive", "quick response", "replied quickly", "called back", "kept updated", "explained clearly"],
    negative: ["no communication", "never replied", "no response", "ignored", "chasing them", "still waiting", "no update", "left in the dark", "nobody called", "unanswered"]
  },
  "Complaint Handling": {
    positive: ["resolved quickly", "handled well", "sorted out", "fair compensation", "apologised", "fixed promptly", "dealt with well"],
    negative: ["unresolved complaint", "escalated", "ombudsman", "months waiting", "ignored complaint", "no resolution", "still unresolved", "formal complaint"]
  },
  "Value & Rates": {
    positive: ["competitive rate", "good rate", "best rate", "great value", "fair rate", "reasonable rate", "good deal", "attractive rate", "competitive interest"],
    negative: ["poor rate", "low interest", "rip off", "expensive", "overpriced", "better rates elsewhere", "uncompetitive rate", "terrible rate"]
  },
  "Trust & Community": {
    positive: ["trust", "trustworthy", "reliable", "safe", "secure", "mutual", "community", "local branch", "loyal member", "ethical", "good values", "personal touch"],
    negative: ["don't trust", "untrustworthy", "scam", "misleading", "dishonest", "lost trust"]
  }
};

const FACTOR_NAMES = Object.keys(FACTOR_KEYWORDS);

function loadReviews(sid) {
  const candidates = [
    `${sid}.json`,
    `${sid}-building-society.json`,
  ];

  for (const candidate of candidates) {
    const fp = path.join(reviewsDir, candidate);
    if (fs.existsSync(fp)) {
      const data = JSON.parse(fs.readFileSync(fp, "utf8"));
      return Array.isArray(data) ? data : (data.reviews || []);
    }
  }

  const files = fs.readdirSync(reviewsDir).filter(f => f.endsWith('.json') && f !== '_summary.json');
  for (const f of files) {
    if (f.toLowerCase().includes(sid.replace(/-/g, '')) || f.toLowerCase().includes(sid)) {
      const data = JSON.parse(fs.readFileSync(path.join(reviewsDir, f), "utf8"));
      return Array.isArray(data) ? data : (data.reviews || []);
    }
  }
  return [];
}

function scoreReviews(reviews) {
  const scores = {};
  for (const factor of FACTOR_NAMES) {
    const kw = FACTOR_KEYWORDS[factor];
    let positiveCount = 0;
    let negativeCount = 0;
    let matched = 0;

    for (const r of reviews) {
      const text = `${r.title || ''} ${r.text || r.reviewText || r.quote || ''} ${r.review || ''}`.toLowerCase();
      let pos = 0, neg = 0;

      for (const k of kw.positive) { if (text.includes(k.toLowerCase())) pos++; }
      for (const k of kw.negative) { if (text.includes(k.toLowerCase())) neg++; }

      if (pos > 0 || neg > 0) {
        matched++;
        positiveCount += pos;
        negativeCount += neg;
      }
    }

    const total = positiveCount + negativeCount;
    const rawScore = total > 0 ? (positiveCount / total) * 10 : 5;
    const score = Math.min(10, Math.max(1, Math.round(rawScore * 10) / 10));
    scores[factor] = { score, matched };
  }
  return scores;
}

// Calculate all society scores
const allScores = {};
for (const s of societies) {
  const reviews = loadReviews(s.id);
  if (reviews.length > 0) {
    allScores[s.id] = scoreReviews(reviews);
  }
}

// Calculate averages and ranks
const results = {};
const totalSocieties = Object.keys(allScores).length;

for (const factor of FACTOR_NAMES) {
  const entries = Object.entries(allScores)
    .map(([id, scores]) => ({ id, score: scores[factor].score }))
    .sort((a, b) => b.score - a.score);

  const avg = entries.reduce((s, e) => s + e.score, 0) / entries.length;

  let rank = 1;
  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && entries[i].score < entries[i - 1].score) rank = i + 1;
    if (!results[entries[i].id]) results[entries[i].id] = {};
    results[entries[i].id][factor] = {
      score: entries[i].score,
      average: Math.round(avg * 10) / 10,
      rank,
      matched: allScores[entries[i].id][factor].matched,
    };
  }
}

const myScores = results[societyId];
if (!myScores) {
  console.error(`No benchmark data for ${societyId}`);
  process.exit(1);
}

// === Generate PDF ===
const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const doc = new jsPDF();
const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const margin = 20;
const contentWidth = pageWidth - margin * 2;

// Colours
const navy = [15, 48, 87];
const darkGrey = [50, 50, 50];
const midGrey = [120, 120, 120];
const lightGrey = [200, 200, 200];
const green = [22, 163, 74];
const amber = [202, 138, 4];
const red = [220, 50, 50];

let y = 20;

// === HEADER ===
doc.setFontSize(22);
doc.setFont("helvetica", "bold");
doc.setTextColor(...navy);
doc.text(society.name, pageWidth / 2, y, { align: "center" });
y += 9;

doc.setFontSize(13);
doc.setFont("helvetica", "normal");
doc.setTextColor(...midGrey);
doc.text("Member Experience Benchmark Report", pageWidth / 2, y, { align: "center" });
y += 8;

doc.setFontSize(9);
doc.setTextColor(150, 150, 150);
const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
doc.text(`Woodhurst Consulting  •  ${dateStr}`, pageWidth / 2, y, { align: "center" });
y += 10;

// Divider
doc.setDrawColor(...lightGrey);
doc.setLineWidth(0.4);
doc.line(margin, y, pageWidth - margin, y);
y += 8;

// === SUMMARY LINE ===
doc.setFontSize(9);
doc.setFont("helvetica", "normal");
doc.setTextColor(...midGrey);
doc.text(`Benchmarked against ${totalSocieties} building societies  •  Based on customer review sentiment analysis`, margin, y);
y += 10;

// === TABLE HEADER ===
const col1 = margin;                    // Factor name
const col2 = margin + contentWidth * 0.32;  // Bar start
const barWidth = contentWidth * 0.30;   // Bar width
const col3 = margin + contentWidth * 0.65;  // Score
const col4 = margin + contentWidth * 0.74;  // Avg
const col5 = margin + contentWidth * 0.83;  // Rank
const col6 = margin + contentWidth * 0.93;  // Status

doc.setFontSize(7.5);
doc.setFont("helvetica", "bold");
doc.setTextColor(...midGrey);
doc.text("Factor", col1, y);
doc.text("Score", col3, y, { align: "center" });
doc.text("Avg", col4, y, { align: "center" });
doc.text("Rank", col5, y, { align: "center" });
y += 2;

doc.setDrawColor(180, 180, 180);
doc.setLineWidth(0.3);
doc.line(margin, y, pageWidth - margin, y);
y += 6;

// === TABLE ROWS ===
for (const factor of FACTOR_NAMES) {
  const s = myScores[factor];
  const diff = s.score - s.average;

  let statusLabel, statusColor;
  if (diff >= 0.5) { statusLabel = "+"; statusColor = green; }
  else if (diff >= -0.5) { statusLabel = "~"; statusColor = amber; }
  else { statusLabel = "-"; statusColor = red; }

  let barColor;
  if (diff >= 0.5) barColor = [34, 197, 94];
  else if (diff >= -0.5) barColor = [250, 204, 21];
  else barColor = [239, 68, 68];

  // Factor name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...darkGrey);
  doc.text(factor, col1, y);

  // Score
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(s.score.toFixed(1), col3, y, { align: "center" });

  // Average
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...midGrey);
  doc.text(s.average.toFixed(1), col4, y, { align: "center" });

  // Rank
  doc.setFontSize(8);
  doc.text(ordinal(s.rank), col5, y, { align: "center" });

  // Status indicator (colored circle)
  doc.setFillColor(...statusColor);
  doc.circle(col6, y - 1.5, 2, "F");

  // Bar (below text, with some spacing)
  const barY = y + 2;
  const barH = 4;

  // Background bar
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(col2, barY, barWidth, barH, 1, 1, "F");

  // Score bar (scale from 0-10, minimum visible width)
  const scoreBarW = Math.max(3, (s.score / 10) * barWidth);
  doc.setFillColor(...barColor);
  if (scoreBarW > 3) {
    doc.roundedRect(col2, barY, scoreBarW, barH, 1.5, 1.5, "F");
  } else {
    doc.rect(col2, barY, scoreBarW, barH, "F");
  }

  // Average marker line
  const avgX = col2 + (s.average / 10) * barWidth;
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.6);
  doc.line(avgX, barY - 1, avgX, barY + barH + 1);

  // Reviews matched count
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(170, 170, 170);
  doc.text(`${s.matched} reviews matched`, col2, barY + barH + 4);

  y += 18;

  // Row separator
  doc.setDrawColor(240, 240, 240);
  doc.setLineWidth(0.2);
  doc.line(margin, y - 4, pageWidth - margin, y - 4);
}

// === LEGEND ===
y += 2;
doc.setFontSize(7);
doc.setFont("helvetica", "normal");
doc.setTextColor(...midGrey);
// Draw legend with colored dots
doc.setFillColor(...green);
doc.circle(margin + 2, y - 1, 1.5, "F");
doc.setTextColor(...midGrey);
doc.text("Above avg (+0.5)", margin + 6, y);

doc.setFillColor(...amber);
doc.circle(margin + 52, y - 1, 1.5, "F");
doc.text("Near avg", margin + 56, y);

doc.setFillColor(...red);
doc.circle(margin + 82, y - 1, 1.5, "F");
doc.text("Below avg (-0.5)", margin + 86, y);

doc.setDrawColor(80, 80, 80);
doc.setLineWidth(0.5);
doc.line(margin + 130, y - 3, margin + 130, y + 1);
doc.text("Industry average", margin + 133, y);
y += 4;
doc.text("Scores range from 1–10 (10 = best). Bar colour indicates performance relative to the industry average.", margin, y);

// === METHODOLOGY ===
y += 10;
doc.setDrawColor(...lightGrey);
doc.setLineWidth(0.3);
doc.line(margin, y, pageWidth - margin, y);
y += 6;

doc.setFontSize(8);
doc.setFont("helvetica", "bold");
doc.setTextColor(...darkGrey);
doc.text("Methodology", margin, y);
y += 5;

doc.setFont("helvetica", "normal");
doc.setFontSize(7.5);
doc.setTextColor(...midGrey);
const methodology = `Scores are derived from keyword-based sentiment analysis of ${loadReviews(societyId).length} customer reviews from Smart Money People and Trustpilot. Each factor is scored by the ratio of positive to negative keyword matches. Rankings are calculated across ${totalSocieties} building societies. This report is generated automatically and should be considered alongside other data sources.`;
const methodLines = doc.splitTextToSize(methodology, contentWidth);
doc.text(methodLines, margin, y);

// === FOOTER ===
doc.setFontSize(7);
doc.setTextColor(170, 170, 170);
doc.text("© Woodhurst Consulting  •  Confidential  •  bsa-member-chat.vercel.app", pageWidth / 2, pageHeight - 10, { align: "center" });

// Save
fs.writeFileSync(outputPath, Buffer.from(doc.output("arraybuffer")));
console.log(`PDF generated: ${outputPath}`);
