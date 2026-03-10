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

// Exact same factors as the web app (lib/benchmark.ts)
const FACTOR_KEYWORDS = {
  "App & Digital Experience": {
    positive: ["app is great","app works well","easy to use online","digital","online banking is good","good app","love the app","great app","website is easy","easy online","modern","user friendly","user-friendly","biometric","fingerprint","faceid","smooth login","intuitive","well designed","well-designed"],
    negative: ["no app","clunky","outdated","archaic","stone age","no mobile app","terrible app","app crash","app doesn't work","can't login","login issue","website is awful","website doesn't work","glitch","bug","slow website","hard to navigate","not user friendly","password nightmare","locked out","can't access online","online banking is poor","digital experience is poor"]
  },
  "Account Opening": {
    positive: ["easy to open","quick to open","simple process","straightforward","opened in minutes","easy sign up","sign-up was easy","smooth onboarding","quick setup","opened online easily","simple to set up","hassle free","hassle-free","easy to set up","painless"],
    negative: ["hard to open","difficult to open","took ages to open","complicated","too much paperwork","verification nightmare","couldn't open","refused to open","slow process","waited weeks","convoluted","bureaucratic","red tape","identity check","failed verification","rejected","wait for post"]
  },
  "Branch Service": {
    positive: ["branch","staff were great","friendly staff","helpful staff","in branch","in-branch","counter","teller","face to face","face-to-face","personal service","warm welcome","knew my name","by name","walked in","walk in","courteous","professional","patient","never rushed","took the time","went above and beyond","credit to","exceptional service","brilliant service","lovely branch","welcoming","greeted","a pleasure"],
    negative: ["rude staff","unhelpful","branch was closed","queue","waited ages","unfriendly","dismissive","couldn't care less","wrong information","misinformed","poor branch","branch experience","no appointment","30 miles away","branch closing","no branch","nearest branch","incorrect information"]
  },
  "Phone & Remote Support": {
    positive: ["phone","called","rang","call centre","helpful on the phone","phoned up","spoke to someone","quick response","got back to me","timely manner","email response","customer service was excellent","easiest call","pleasant conversation","resolved quickly","sorted it out","no fuss","helpline","personal call","callback","called me back"],
    negative: ["couldn't get through","on hold","waited on phone","no response","never replied","no one called back","terrible phone service","hung up","rude on phone","automated","can't speak to anyone","no constructive help","after a month","never rang back","ignored"]
  },
  "Savings Products": {
    positive: ["great rates","competitive rates","best rate","good interest","savings rate","good returns","above average rate","high interest","class leading","decent rate","financial offer is decent","competitive","good isa rate","fixed rate","flexible savings","range of savings","savings products"],
    negative: ["poor rates","low interest","rate dropped","rate cut","rate slashed","rates are terrible","better elsewhere","uncompetitive","reduced the rate","bait and switch","con","misleading rate","rate change","variable rate cut"]
  },
  "Mortgage Process": {
    positive: ["mortgage was easy","mortgage advisor","mortgage adviser","smooth mortgage","quick mortgage","great mortgage experience","mortgage process was","helped with mortgage","mortgage application","remortgage was easy","professional and knowledgeable","explaining everything clearly","felt confident","safe hands","mortgage advice","first-time buyer"],
    negative: ["mortgage rejected","mortgage was difficult","slow mortgage","mortgage nightmare","declined mortgage","refused to lend","mortgage process was awful","valuation","surveyor","no proper explanation","inappropriate","upsetting"]
  },
  "Communication": {
    positive: ["explained clearly","clear explanation","jargon free","jargon-free","easy to understand","transparent","kept me informed","kept informed","good communication","regular updates","explained everything","informative"],
    negative: ["no communication","confusing","jargon","unclear","no updates","didn't explain","poor communication","left in the dark","couldn't understand","no explanation","not transparent","small print","hidden","fine print","misleading"]
  },
  "Complaint Handling": {
    positive: ["resolved quickly","complaint handled","compensation","apology","made it right","sorted the problem","escalated","genuine desire to improve","personal call","recovery","followed up","took it seriously"],
    negative: ["complaint ignored","no resolution","unresolved","never replied","no apology","didn't care","complaint","terrible response","final","escalate","ombudsman","fos","formal complaint","appalling","disgusting","never responded"]
  },
  "Value & Rates": {
    positive: ["good value","value for money","competitive","fair rates","above market","above average","better than banks","worth it","best deal","great deal","excellent value","paid more interest","class leading","decent"],
    negative: ["poor value","rip off","not worth it","overpriced","expensive","fees too high","charges","hidden charges","better deals elsewhere","not competitive","worse than","losing money"]
  },
  "Trust & Community": {
    positive: ["trust","mutual","community","local","ethical","member owned","values","ethos","care about members","not a bank","different","personal touch","human","people first","member first","building society","mutual society","looked after","faith","genuine","honest","integrity","green","sustainable","ecology","kinder","fairer"],
    negative: ["don't trust","lost trust","like a bank","no different","just about profit","don't care about members","faceless","impersonal","corporate","abandoned","let down","betrayed","broken promise","lip service"]
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
const pageWidth  = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const margin     = 15;
const contentWidth = pageWidth - margin * 2;  // 180mm

// ── Colour palette ─────────────────────────────────────────────────────────
const navy      = [15,  48,  87 ];
const darkGrey  = [50,  50,  50 ];
const midGrey   = [120, 120, 120];
const lightGrey = [210, 210, 210];
const paleBlue  = [240, 245, 251];
const green     = [22,  163, 74 ];
const amber     = [180, 130, 20 ];
const red       = [220, 50,  50 ];
const greenFill = [34,  197, 94 ];
const amberFill = [250, 180, 50 ];
const redFill   = [239, 68,  68 ];

// ── Column positions ───────────────────────────────────────────────────────
const colFactor  = margin;           // factor label, ~52mm wide → ends ~67
const colScore   = margin + 53;      // score value centre window
const colAvg     = margin + 65;      // avg value centre window
const colBar     = margin + 77;      // bar start, 55mm wide → ends 132
const colBarW    = 55;
const colRank    = margin + 134;     // rank, centred in ~18mm
const colStatus  = margin + 154;     // badge start, 26mm wide → ends 195
const colStatusW = 26;

let y = 18;

// ── Top accent bar ─────────────────────────────────────────────────────────
doc.setFillColor(...navy);
doc.rect(0, 0, pageWidth, 8, "F");

// ── Header ─────────────────────────────────────────────────────────────────
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

doc.setFontSize(8.5);
doc.setTextColor(160, 160, 160);
const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
doc.text(`Woodhurst Consulting  •  ${dateStr}`, pageWidth / 2, y, { align: "center" });
y += 8;

doc.setDrawColor(...lightGrey);
doc.setLineWidth(0.4);
doc.line(margin, y, pageWidth - margin, y);
y += 8;

// ── Summary box ────────────────────────────────────────────────────────────
const scoresArr = FACTOR_NAMES.map(f => ({ factor: f, ...myScores[f] }));
const bestScore  = scoresArr.reduce((best, s) => s.score > best.score ? s : best, scoresArr[0]);
const worstGap   = scoresArr.reduce((worst, s) => (s.score - s.average) < (worst.score - worst.average) ? s : worst, scoresArr[0]);
const aboveCount = scoresArr.filter(s => (s.score - s.average) >= 0.5).length;
const belowCount = scoresArr.filter(s => (s.score - s.average) < -0.5).length;

const boxH = 26;
doc.setFillColor(...paleBlue);
doc.roundedRect(margin, y, contentWidth, boxH, 3, 3, "F");
doc.setDrawColor(200, 220, 240);
doc.setLineWidth(0.5);
doc.roundedRect(margin, y, contentWidth, boxH, 3, 3, "S");

const bY    = y + 8;
const col3rd = contentWidth / 3;

// Panel 1 – Overall Position
doc.setFont("helvetica", "bold");
doc.setFontSize(8.5);
doc.setTextColor(...navy);
doc.text("Overall Position", margin + 6, bY);
doc.setFont("helvetica", "normal");
doc.setFontSize(8);
doc.setTextColor(...darkGrey);
doc.text(`${aboveCount} of ${scoresArr.length} factors above industry average`, margin + 6, bY + 6);
doc.text(`${belowCount} of ${scoresArr.length} factors below industry average`, margin + 6, bY + 11);

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

// ── Table header ───────────────────────────────────────────────────────────
doc.setFontSize(7.5);
doc.setFont("helvetica", "bold");
doc.setTextColor(...midGrey);
doc.text("Factor",  colFactor, y);
doc.text("Score",   colScore  + 5, y, { align: "center" });
doc.text("Avg",     colAvg    + 5, y, { align: "center" });
doc.text("0",       colBar,        y);
doc.text("5",       colBar + colBarW / 2, y, { align: "center" });
doc.text("10",      colBar + colBarW, y, { align: "right" });
doc.text("Rank",    colRank   + 9, y, { align: "center" });
doc.text("Status",  colStatus + colStatusW / 2, y, { align: "center" });
y += 2;

doc.setDrawColor(160, 160, 160);
doc.setLineWidth(0.4);
doc.line(margin, y, pageWidth - margin, y);
y += 5;

// ── Table rows ─────────────────────────────────────────────────────────────
const rowH = 13;
for (let i = 0; i < FACTOR_NAMES.length; i++) {
  const factor = FACTOR_NAMES[i];
  const s      = myScores[factor];
  const diff   = s.score - s.average;

  let statusLabel, statusRGB, barRGB;
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

  const textY  = y + 1;
  const barY   = y - 2;
  const barH   = 5;

  // Factor name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...darkGrey);
  doc.text(factor, colFactor, textY);

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

  // Bar background
  doc.setFillColor(225, 225, 225);
  doc.roundedRect(colBar, barY, colBarW, barH, 1, 1, "F");

  // Bar coloured fill
  const scoreBarW = Math.max(2, (s.score / 10) * colBarW);
  doc.setFillColor(...barRGB);
  doc.roundedRect(colBar, barY, scoreBarW, barH, 1, 1, "F");

  // Average tick
  const avgX = colBar + (s.average / 10) * colBarW;
  doc.setDrawColor(50, 50, 50);
  doc.setLineWidth(0.8);
  doc.line(avgX, barY - 1, avgX, barY + barH + 1);

  // Rank
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...midGrey);
  doc.text(`${ordinal(s.rank)}`, colRank + 9, textY, { align: "center" });

  // Status badge
  const badgeH    = 5.5;
  const badgeTopY = barY - 0.5;
  doc.setFillColor(...statusRGB);
  doc.roundedRect(colStatus, badgeTopY, colStatusW, badgeH, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text(statusLabel, colStatus + colStatusW / 2, badgeTopY + 3.7, { align: "center" });

  // Row divider
  if (i < FACTOR_NAMES.length - 1) {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, y + rowH - 4, pageWidth - margin, y + rowH - 4);
  }

  y += rowH;
}

y += 5;

// ── Legend ─────────────────────────────────────────────────────────────────
doc.setFontSize(7);
doc.setFont("helvetica", "bold");
doc.setTextColor(...midGrey);
doc.text("Legend:", margin, y);

const legendItems = [
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

// ── Methodology ────────────────────────────────────────────────────────────
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

// ── Footer ─────────────────────────────────────────────────────────────────
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

// Save
fs.writeFileSync(outputPath, Buffer.from(doc.output("arraybuffer")));
console.log(`PDF generated: ${outputPath}`);
