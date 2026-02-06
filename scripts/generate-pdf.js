#!/usr/bin/env node
/**
 * Generate a benchmark PDF for a given society.
 * Usage: node generate-pdf.js <societyId> <outputPath>
 */

const { jsPDF } = require("jspdf");
const fs = require("fs");
const path = require("path");

// We need to load benchmark logic - import it dynamically
const societyId = process.argv[2];
const outputPath = process.argv[3];

if (!societyId || !outputPath) {
  console.error("Usage: node generate-pdf.js <societyId> <outputPath>");
  process.exit(1);
}

// Load societies
const societies = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "societies.json"), "utf8")
);
const society = societies.find((s) => s.id === societyId);
if (!society) {
  console.error(`Society not found: ${societyId}`);
  process.exit(1);
}

// Load reviews and calculate benchmark inline (simplified version)
const reviewsDir = path.join(__dirname, "..", "data", "reviews");

const FACTOR_KEYWORDS = {
  "Service Quality": {
    positive: ["friendly", "helpful", "professional", "excellent", "amazing", "outstanding", "wonderful", "brilliant", "fantastic", "great service", "lovely", "welcoming", "patient", "caring", "knowledgeable", "efficient", "personal", "warm"],
    negative: ["rude", "unhelpful", "poor service", "terrible", "awful", "appalling", "disgraceful", "dreadful", "worst", "incompetent", "useless", "dismissive", "unprofessional", "shocking"]
  },
  "Digital Experience": {
    positive: ["app", "online", "easy to use", "user friendly", "website", "digital", "mobile", "convenient", "quick online", "simple online", "modern"],
    negative: ["app", "website", "online", "clunky", "outdated", "difficult", "crash", "glitch", "stone age", "archaic", "can't login", "error"]
  },
  "Communication": {
    positive: ["kept informed", "communicated well", "clear", "transparent", "responsive", "quick response", "replied", "called back", "updated", "explained"],
    negative: ["no communication", "never replied", "no response", "ignored", "chasing", "waiting", "no update", "left in the dark", "nobody called", "unanswered"]
  },
  "Complaint Handling": {
    positive: ["resolved quickly", "handled well", "sorted", "compensation", "apologised", "fixed", "dealt with"],
    negative: ["complaint", "unresolved", "escalated", "ombudsman", "FOS", "months", "ignored complaint", "no resolution", "still waiting"]
  },
  "Value & Rates": {
    positive: ["competitive", "good rate", "best rate", "value", "fair", "reasonable", "good deal", "attractive rate"],
    negative: ["poor rate", "low rate", "rip off", "expensive", "overpriced", "better rates elsewhere", "uncompetitive"]
  },
  "Trust & Community": {
    positive: ["trust", "reliable", "safe", "secure", "mutual", "community", "local", "loyal", "member", "ethical", "values"],
    negative: ["don't trust", "scam", "fraudulent", "misleading", "dishonest", "untrustworthy"]
  }
};

const FACTOR_NAMES = Object.keys(FACTOR_KEYWORDS);

// Slug mapping
const SLUG_MAP = {};
societies.forEach(s => {
  const reviewFiles = fs.readdirSync(reviewsDir).filter(f => f.endsWith('.json') && f !== '_summary.json');
  for (const rf of reviewFiles) {
    const slug = rf.replace('.json', '').toLowerCase();
    if (slug.includes(s.id) || s.id.includes(slug.replace('-building-society', ''))) {
      SLUG_MAP[s.id] = rf.replace('.json', '');
    }
  }
});

function loadReviews(sid) {
  // Try direct match first
  const candidates = [
    `${sid}.json`,
    `${sid}-building-society.json`,
    SLUG_MAP[sid] ? `${SLUG_MAP[sid]}.json` : null,
  ].filter(Boolean);
  
  for (const candidate of candidates) {
    const fp = path.join(reviewsDir, candidate);
    if (fs.existsSync(fp)) {
      return JSON.parse(fs.readFileSync(fp, "utf8"));
    }
  }
  
  // Fuzzy match
  const files = fs.readdirSync(reviewsDir).filter(f => f.endsWith('.json') && f !== '_summary.json');
  for (const f of files) {
    if (f.toLowerCase().includes(sid.replace(/-/g, '')) || f.toLowerCase().includes(sid)) {
      return JSON.parse(fs.readFileSync(path.join(reviewsDir, f), "utf8"));
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
      const text = `${r.title || ''} ${r.reviewText || r.text || r.quote || ''} ${r.review || ''}`.toLowerCase();
      let pos = 0, neg = 0;
      
      for (const k of kw.positive) {
        if (text.includes(k.toLowerCase())) pos++;
      }
      for (const k of kw.negative) {
        if (text.includes(k.toLowerCase())) neg++;
      }
      
      if (pos > 0 || neg > 0) {
        matched++;
        positiveCount += pos;
        negativeCount += neg;
      }
    }
    
    const total = positiveCount + negativeCount;
    const score = total > 0 ? Math.min(10, Math.max(1, (positiveCount / total) * 10)) : 5;
    scores[factor] = { score: Math.round(score * 10) / 10, matched };
  }
  return scores;
}

// Calculate all society scores for ranking
const allScores = {};
for (const s of societies) {
  const reviews = loadReviews(s.id);
  if (reviews.length > 0) {
    allScores[s.id] = scoreReviews(reviews);
  }
}

// Calculate averages and ranks
const results = {};
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

const totalSocieties = Object.keys(allScores).length;
const myScores = results[societyId];

if (!myScores) {
  console.error(`No benchmark data for ${societyId}`);
  process.exit(1);
}

// Generate PDF
const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const doc = new jsPDF();
const pageWidth = doc.internal.pageSize.getWidth();
const margin = 20;
const contentWidth = pageWidth - margin * 2;
let y = 25;

doc.setFontSize(20);
doc.setFont("helvetica", "bold");
doc.setTextColor(15, 48, 87);
doc.text(society.name, pageWidth / 2, y, { align: "center" });
y += 10;

doc.setFontSize(14);
doc.setFont("helvetica", "normal");
doc.text("Member Experience Benchmark Report", pageWidth / 2, y, { align: "center" });
y += 10;

doc.setFontSize(10);
doc.setTextColor(100, 100, 100);
doc.text("Generated by Woodhurst Consulting | BSA Member Chat", pageWidth / 2, y, { align: "center" });
y += 7;

const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
doc.setFontSize(9);
doc.text(`Report generated: ${dateStr}`, pageWidth / 2, y, { align: "center" });
y += 12;

doc.setDrawColor(200, 200, 200);
doc.setLineWidth(0.5);
doc.line(margin, y, pageWidth - margin, y);
y += 10;

// Table header
doc.setFontSize(9);
doc.setFont("helvetica", "bold");
doc.setTextColor(80, 80, 80);

const colFactor = margin;
const colScore = margin + contentWidth * 0.45;
const colAvg = margin + contentWidth * 0.58;
const colRank = margin + contentWidth * 0.71;
const colIndicator = margin + contentWidth * 0.82;

doc.text("Factor", colFactor, y);
doc.text("Score", colScore, y);
doc.text("Avg", colAvg, y);
doc.text("Rank", colRank, y);
doc.text("Status", colIndicator, y);
y += 3;

doc.setDrawColor(180, 180, 180);
doc.setLineWidth(0.3);
doc.line(margin, y, pageWidth - margin, y);
y += 7;

for (const factor of FACTOR_NAMES) {
  const s = myScores[factor];
  const diff = s.score - s.average;
  let status, statusColor;

  if (diff >= 1.0) {
    status = "Above avg";
    statusColor = [22, 163, 74];
  } else if (diff > -1.0) {
    status = "Near avg";
    statusColor = [180, 130, 20];
  } else {
    status = "Below avg";
    statusColor = [220, 50, 50];
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text(factor, colFactor, y);

  doc.setFont("helvetica", "bold");
  doc.text(s.score.toFixed(1), colScore, y);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(s.average.toFixed(1), colAvg, y);
  doc.text(`${ordinal(s.rank)} of ${totalSocieties}`, colRank, y);

  doc.setTextColor(...statusColor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(status, colIndicator, y);

  y += 4;

  const barMaxWidth = contentWidth * 0.35;
  doc.setFillColor(235, 235, 235);
  doc.rect(colFactor, y, barMaxWidth, 3, "F");

  const scoreWidth = (s.score / 10) * barMaxWidth;
  if (diff >= 1.0) doc.setFillColor(34, 197, 94);
  else if (diff > -1.0) doc.setFillColor(250, 204, 21);
  else doc.setFillColor(239, 68, 68);
  doc.rect(colFactor, y, scoreWidth, 3, "F");

  const avgX = colFactor + (s.average / 10) * barMaxWidth;
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.5);
  doc.line(avgX, y - 0.5, avgX, y + 3.5);

  y += 10;
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.2);
  doc.line(margin, y - 2, pageWidth - margin, y - 2);
}

y += 5;
doc.setDrawColor(200, 200, 200);
doc.setLineWidth(0.5);
doc.line(margin, y, pageWidth - margin, y);
y += 8;

doc.setFontSize(8);
doc.setFont("helvetica", "bold");
doc.setTextColor(80, 80, 80);
doc.text("Methodology", margin, y);
y += 5;

doc.setFont("helvetica", "normal");
doc.setFontSize(7.5);
doc.setTextColor(120, 120, 120);
const methodology = `Scores derived from analysis of customer reviews across Smart Money People and Trustpilot. Rankings are out of ${totalSocieties} building societies analysed. Scores range from 1-10 where 10 is best.`;
const methodLines = doc.splitTextToSize(methodology, contentWidth);
doc.text(methodLines, margin, y);

doc.setFontSize(7);
doc.setTextColor(160, 160, 160);
doc.text(
  "© Woodhurst Consulting | bsa-member-chat | Confidential",
  pageWidth / 2,
  doc.internal.pageSize.getHeight() - 10,
  { align: "center" }
);

fs.writeFileSync(outputPath, Buffer.from(doc.output("arraybuffer")));
console.log(`PDF generated: ${outputPath}`);
