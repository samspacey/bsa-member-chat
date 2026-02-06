import fs from "fs";
import path from "path";
import { parseReviews, Review } from "./reviews";

export interface FactorScore {
  factor: string;
  score: number;
  average: number;
  rank: number;
  reviewCount: number;
  positiveCount: number;
  negativeCount: number;
}

export interface BenchmarkResult {
  society: string;
  scores: FactorScore[];
  totalSocieties: number;
}

// Factor definitions with positive and negative keyword signals
const factorKeywords: Record<
  string,
  { positive: string[]; negative: string[] }
> = {
  "App & Digital Experience": {
    positive: [
      "app is great", "app works well", "easy to use online", "digital",
      "online banking is good", "good app", "love the app", "great app",
      "website is easy", "easy online", "modern", "user friendly",
      "user-friendly", "biometric", "fingerprint", "faceid", "smooth login",
      "intuitive", "well designed", "well-designed",
    ],
    negative: [
      "no app", "clunky", "outdated", "archaic", "stone age", "no mobile app",
      "terrible app", "app crash", "app doesn't work", "can't login",
      "login issue", "website is awful", "website doesn't work", "glitch",
      "bug", "slow website", "hard to navigate", "not user friendly",
      "password nightmare", "locked out", "can't access online",
      "online banking is poor", "digital experience is poor", "1972",
      "positively archaic", "no flexibility", "two-step verification",
    ],
  },
  "Account Opening": {
    positive: [
      "easy to open", "quick to open", "simple process", "straightforward",
      "opened in minutes", "easy sign up", "sign-up was easy", "smooth onboarding",
      "quick setup", "opened online easily", "simple to set up",
      "hassle free", "hassle-free", "easy to set up", "painless",
    ],
    negative: [
      "hard to open", "difficult to open", "took ages to open", "complicated",
      "too much paperwork", "verification nightmare", "couldn't open",
      "refused to open", "slow process", "waited weeks", "convoluted",
      "bureaucratic", "red tape", "identity check", "failed verification",
      "rejected", "wait for post", "wait 3 days",
    ],
  },
  "Branch Service": {
    positive: [
      "branch", "staff were great", "friendly staff", "helpful staff",
      "in branch", "in-branch", "counter", "teller", "face to face",
      "face-to-face", "personal service", "warm welcome", "knew my name",
      "by name", "walked in", "walk in", "courteous", "professional",
      "patient", "never rushed", "took the time", "went above and beyond",
      "credit to", "exceptional service", "brilliant service",
      "lovely branch", "welcoming", "greeted", "a pleasure",
    ],
    negative: [
      "rude staff", "unhelpful", "branch was closed", "queue",
      "waited ages", "unfriendly", "dismissive", "couldn't care less",
      "wrong information", "misinformed", "poor branch", "branch experience",
      "no appointment", "30 miles away", "branch closing", "no branch",
      "nearest branch", "incorrect information", "adamant",
    ],
  },
  "Phone & Remote Support": {
    positive: [
      "phone", "called", "rang", "call centre", "helpful on the phone",
      "phoned up", "spoke to someone", "quick response", "got back to me",
      "timely manner", "email response", "customer service was excellent",
      "easiest call", "pleasant conversation", "resolved quickly",
      "sorted it out", "no fuss", "helpline", "customer management",
      "personal call", "callback", "called me back",
    ],
    negative: [
      "couldn't get through", "on hold", "waited on phone", "no response",
      "never replied", "no one called back", "terrible phone service",
      "call centre", "hung up", "rude on phone", "automated",
      "can't speak to anyone", "no constructive help", "after a month",
      "never rang back", "ignored",
    ],
  },
  "Savings Products": {
    positive: [
      "great rates", "competitive rates", "best rate", "good interest",
      "savings rate", "good returns", "above average rate", "high interest",
      "class leading", "decent rate", "financial offer is decent",
      "competitive", "good isa rate", "fixed rate", "flexible savings",
      "range of savings", "savings products",
    ],
    negative: [
      "poor rates", "low interest", "rate dropped", "rate cut", "rate slashed",
      "rates are terrible", "better elsewhere", "uncompetitive",
      "reduced the rate", "bait and switch", "con", "misleading rate",
      "rate change", "variable rate cut",
    ],
  },
  "Mortgage Process": {
    positive: [
      "mortgage was easy", "mortgage advisor", "mortgage adviser",
      "smooth mortgage", "quick mortgage", "great mortgage experience",
      "mortgage process was", "helped with mortgage", "mortgage application",
      "remortgage was easy", "mortgage maze", "professional and knowledgeable",
      "explaining everything clearly", "felt confident", "safe hands",
      "mortgage advice", "first-time buyer",
    ],
    negative: [
      "mortgage rejected", "mortgage was difficult", "slow mortgage",
      "mortgage nightmare", "declined mortgage", "refused to lend",
      "mortgage process was awful", "valuation", "surveyor",
      "power of attorney", "disability discrimination", "no proper explanation",
      "inappropriate", "upsetting",
    ],
  },
  "Communication": {
    positive: [
      "explained clearly", "clear explanation", "jargon free", "jargon-free",
      "easy to understand", "transparent", "kept me informed", "kept informed",
      "good communication", "regular updates", "explained everything",
      "willingness to ensure I understood", "legalities", "informative",
      "going over something until I understood",
    ],
    negative: [
      "no communication", "confusing", "jargon", "unclear", "no updates",
      "didn't explain", "poor communication", "left in the dark",
      "couldn't understand", "no explanation", "not transparent",
      "small print", "hidden", "fine print", "misleading",
    ],
  },
  "Complaint Handling": {
    positive: [
      "resolved quickly", "complaint handled", "compensation",
      "apology", "made it right", "sorted the problem", "escalated",
      "genuine desire to improve", "personal call", "hamper",
      "recovery", "followed up", "took it seriously",
    ],
    negative: [
      "complaint ignored", "no resolution", "unresolved", "never replied",
      "no apology", "didn't care", "complaint", "terrible response",
      "final", "escalate", "ombudsman", "fos", "formal complaint",
      "appalling", "disgusting", "never responded", "said it was final",
    ],
  },
  "Value & Rates": {
    positive: [
      "good value", "value for money", "competitive", "fair rates",
      "above market", "above average", "better than banks", "worth it",
      "best deal", "great deal", "excellent value", "paid more interest",
      "class leading", "decent", "above the market average",
    ],
    negative: [
      "poor value", "rip off", "not worth it", "overpriced", "expensive",
      "fees too high", "charges", "hidden charges", "better deals elsewhere",
      "not competitive", "worse than", "losing money",
    ],
  },
  "Trust & Community": {
    positive: [
      "trust", "mutual", "community", "local", "ethical", "member owned",
      "values", "ethos", "care about members", "not a bank", "different",
      "personal touch", "human", "people first", "member first",
      "building society", "mutual society", "looked after", "faith",
      "genuine", "honest", "integrity", "green", "sustainable", "b corp",
      "environment", "ecology", "kinder", "fairer",
    ],
    negative: [
      "don't trust", "lost trust", "like a bank", "no different",
      "just about profit", "don't care about members", "faceless",
      "impersonal", "corporate", "abandoned", "let down", "betrayed",
      "broken promise", "lip service",
    ],
  },
};

export const FACTOR_NAMES = Object.keys(factorKeywords);

/**
 * Score a single society's reviews for a single factor.
 *
 * Scoring approach:
 * - Count how many positive vs negative keyword matches for this specific factor
 * - Use factor-specific keyword polarity rather than overall review sentiment
 *   (a review negative about the app can still be positive about savings rates)
 * - When a review matches BOTH positive and negative keywords for a factor,
 *   use the overall review sentiment as a tiebreaker
 */
export function scoreSociety(
  reviews: Review[],
  factor: string
): { score: number; positiveCount: number; negativeCount: number } {
  const keywords = factorKeywords[factor];
  if (!keywords) return { score: 5.0, positiveCount: 0, negativeCount: 0 };

  let positiveCount = 0;
  let negativeCount = 0;

  for (const review of reviews) {
    const text =
      `${review.title} ${review.quote} ${review.context}`.toLowerCase();

    // Count positive keyword matches
    let posMatches = 0;
    for (const kw of keywords.positive) {
      if (text.includes(kw.toLowerCase())) {
        posMatches++;
      }
    }

    // Count negative keyword matches
    let negMatches = 0;
    for (const kw of keywords.negative) {
      if (text.includes(kw.toLowerCase())) {
        negMatches++;
      }
    }

    // Skip reviews with no factor-relevant keywords
    if (posMatches === 0 && negMatches === 0) continue;

    if (posMatches > 0 && negMatches === 0) {
      // Only positive keywords for this factor → count as positive
      positiveCount++;
    } else if (negMatches > 0 && posMatches === 0) {
      // Only negative keywords for this factor → count as negative
      negativeCount++;
    } else {
      // Both positive and negative keywords matched — mixed review for this factor
      // Use keyword balance and overall sentiment as tiebreaker
      if (posMatches > negMatches) {
        positiveCount += 0.7;
        negativeCount += 0.3;
      } else if (negMatches > posMatches) {
        positiveCount += 0.3;
        negativeCount += 0.7;
      } else {
        // Equal matches — use overall review sentiment
        if (review.sentiment === "positive") {
          positiveCount += 0.6;
          negativeCount += 0.4;
        } else {
          positiveCount += 0.4;
          negativeCount += 0.6;
        }
      }
    }
  }

  const total = positiveCount + negativeCount;
  if (total === 0) return { score: 5.0, positiveCount: 0, negativeCount: 0 };

  // Score = (positive / total) * 10, clamped between 1 and 10
  const rawScore = (positiveCount / total) * 10;
  const score = Math.round(Math.max(1, Math.min(10, rawScore)) * 10) / 10;

  return {
    score,
    positiveCount: Math.round(positiveCount),
    negativeCount: Math.round(negativeCount),
  };
}

/**
 * Load reviews from scraped JSON files in data/reviews/.
 * Each JSON file contains reviews scraped from Smart Money People.
 */
interface JSONReviewFile {
  society: string;
  slug: string;
  reviews: {
    title: string;
    text: string;
    rating: number;
    date: string;
    product: string;
    sentiment: string;
  }[];
}

function loadReviewsFromJSON(societyId: string): Review[] {
  const reviewsDir = path.join(process.cwd(), "data", "reviews");

  // Map society IDs to SMP slugs
  const slugMap: Record<string, string> = {
    nationwide: "nationwide",
    yorkshire: "yorkshire-building-society",
    coventry: "coventry-building-society",
    skipton: "skipton-building-society",
    leeds: "leeds-building-society",
    principality: "principality-building-society",
    cumberland: "the-cumberland",
    monmouthshire: "monmouthshire-building-society",
    bath: "bath-building-society",
    ecology: "ecology-building-society",
    newcastle: "newcastle-building-society",
    nottingham: "nottingham-building-society",
    cambridge: "cambridge-building-society",
    chelsea: "chelsea-building-society",
    chorley: "chorley-building-society",
    darlington: "darlington-building-society",
    furness: "furness-building-society",
    harpenden: "harpenden-building-society",
    "hinckley-rugby": "hinckley-rugby-building-society",
    manchester: "manchester-building-society",
    mansfield: "mansfield-building-society",
    "market-harborough": "market-harborough-building-society",
    marsden: "marsden-building-society",
    "national-counties": "national-counties-building-society",
    newbury: "newbury-building-society",
    saffron: "saffron-building-society",
    scottish: "scottish-building-society",
    "west-bromwich": "west-bromwich-building-society",
    beverley: "beverley-building-society",
    buckinghamshire: "buckinghamshire-building-society",
    dudley: "dudley-building-society",
    "earl-shilton": "earl-shilton-building-society",
    family: "the-family-building-society",
    "hanley-economic": "hanley-economic-building-society",
    "leek-united": "leek-united-building-society",
    leek: "leek-building-society",
    loughborough: "loughborough-building-society",
    melton: "melton-mowbray-building-society",
    "norwich-peterborough": "norwich-and-peterborough-building-society",
    penrith: "penrith-building-society",
    progressive: "progressive-building-society",
    stafford: "stafford-building-society",
    suffolk: "suffolk-building-society",
    swansea: "swansea-building-society",
    teachers: "teachers-building-society",
    "tipton-coseley": "tipton-coseley-building-society",
    vernon: "vernon-building-society",
  };

  const slug = slugMap[societyId];
  if (!slug) return [];

  const filePath = path.join(reviewsDir, `${slug}.json`);
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data: JSONReviewFile = JSON.parse(raw);
    return data.reviews.map((r, i) => ({
      id: i + 1,
      sentiment: (r.sentiment === "positive" ? "positive" : "negative") as "positive" | "negative",
      title: r.title,
      quote: r.text,
      rating: `${r.rating}/5`,
      date: r.date,
      context: r.product || "",
    }));
  } catch {
    return [];
  }
}

/**
 * Load and parse reviews for a given society ID.
 * Combines knowledge file reviews with scraped JSON reviews.
 */
function loadReviews(societyId: string): Review[] {
  const reviews: Review[] = [];

  // Load from knowledge markdown files (original source)
  const knowledgePath = path.join(
    process.cwd(),
    "knowledge",
    `${societyId}.md`
  );
  try {
    const knowledge = fs.readFileSync(knowledgePath, "utf8");
    reviews.push(...parseReviews(knowledge));
  } catch {
    // No knowledge file — that's fine
  }

  // Load from scraped JSON files (more data)
  const jsonReviews = loadReviewsFromJSON(societyId);

  // Deduplicate: if a JSON review title matches a knowledge review title, skip it
  const existingTitles = new Set(reviews.map((r) => r.title.toLowerCase().slice(0, 60)));
  for (const jr of jsonReviews) {
    const key = jr.title.toLowerCase().slice(0, 60);
    if (!existingTitles.has(key)) {
      // Renumber IDs to avoid conflicts
      jr.id = reviews.length + 1;
      reviews.push(jr);
      existingTitles.add(key);
    }
  }

  return reviews;
}

/**
 * Get all society IDs that have review data (knowledge files or JSON).
 */
function getAllSocietyIds(): string[] {
  const ids = new Set<string>();

  // Check knowledge files
  const knowledgeDir = path.join(process.cwd(), "knowledge");
  try {
    const files = fs.readdirSync(knowledgeDir);
    for (const f of files) {
      if (f.endsWith(".md")) {
        ids.add(f.replace(".md", ""));
      }
    }
  } catch {
    // No knowledge dir
  }

  // Check societies.json for all known IDs
  try {
    const societiesPath = path.join(process.cwd(), "societies.json");
    const societies = JSON.parse(fs.readFileSync(societiesPath, "utf8"));
    for (const s of societies) {
      ids.add(s.id);
    }
  } catch {
    // Fallback
  }

  return Array.from(ids);
}

/**
 * Benchmark all societies across all factors.
 * Returns a map of societyId → FactorScore[] (without rank/average yet).
 */
export function benchmarkAllSocieties(): Map<
  string,
  { factor: string; score: number; positiveCount: number; negativeCount: number; reviewCount: number }[]
> {
  const allScores = new Map<
    string,
    { factor: string; score: number; positiveCount: number; negativeCount: number; reviewCount: number }[]
  >();

  const societyIds = getAllSocietyIds();

  for (const societyId of societyIds) {
    const reviews = loadReviews(societyId);
    if (reviews.length === 0) continue; // Skip societies with no review data

    const factorScores = FACTOR_NAMES.map((factor) => {
      const result = scoreSociety(reviews, factor);
      return {
        factor,
        score: result.score,
        positiveCount: result.positiveCount,
        negativeCount: result.negativeCount,
        reviewCount: result.positiveCount + result.negativeCount,
      };
    });
    allScores.set(societyId, factorScores);
  }

  return allScores;
}

/**
 * Calculate ranks and averages for all societies.
 * Returns a map of societyId → FactorScore[] (with rank and average).
 */
export function calculateRanks(
  allScores: Map<
    string,
    { factor: string; score: number; positiveCount: number; negativeCount: number; reviewCount: number }[]
  >
): Map<string, FactorScore[]> {
  const result = new Map<string, FactorScore[]>();

  // Initialize result entries
  allScores.forEach((scores, societyId) => {
    result.set(
      societyId,
      scores.map((s) => ({
        ...s,
        average: 0,
        rank: 0,
      }))
    );
  });

  // For each factor, compute average and rank
  for (let fi = 0; fi < FACTOR_NAMES.length; fi++) {
    const factor = FACTOR_NAMES[fi];

    // Collect all society scores for this factor
    const entries: { societyId: string; score: number }[] = [];
    allScores.forEach((scores, societyId) => {
      entries.push({ societyId, score: scores[fi].score });
    });

    // Average
    const avg =
      entries.reduce((sum, e) => sum + e.score, 0) / entries.length;
    const roundedAvg = Math.round(avg * 10) / 10;

    // Sort descending to determine rank
    entries.sort((a, b) => b.score - a.score);

    // Assign rank (handle ties: same score = same rank)
    let currentRank = 1;
    for (let i = 0; i < entries.length; i++) {
      if (i > 0 && entries[i].score < entries[i - 1].score) {
        currentRank = i + 1;
      }
      const societyScores = result.get(entries[i].societyId);
      if (societyScores) {
        const factorEntry = societyScores.find((s) => s.factor === factor);
        if (factorEntry) {
          factorEntry.average = roundedAvg;
          factorEntry.rank = currentRank;
        }
      }
    }
  }

  return result;
}

/**
 * Get the full benchmark result for a specific society.
 */
export function getBenchmarkForSociety(societyId: string): BenchmarkResult | null {
  const allRaw = benchmarkAllSocieties();
  if (!allRaw.has(societyId)) return null;

  const allRanked = calculateRanks(allRaw);
  const scores = allRanked.get(societyId);
  if (!scores) return null;

  return {
    society: societyId,
    scores,
    totalSocieties: allRanked.size,
  };
}
