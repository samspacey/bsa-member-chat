export interface Review {
  id: number;
  sentiment: "positive" | "negative";
  title: string;
  quote: string;
  rating: string;
  date: string;
  context: string;
  relevanceScore?: number;
}

// Keywords that signal relevance for each persona archetype
const personaKeywords: Record<string, string[]> = {
  loyalist: [
    "branch", "staff", "counter", "teller", "in person", "face to face",
    "face-to-face", "personal", "by name", "knew me", "know my", "years",
    "loyal", "member for", "elderly", "pension", "retired", "widow",
    "scam", "fraud", "passbook", "tea", "coffee", "appointment", "queue",
    "letter", "paper", "phone call", "traditional", "high street",
    "community", "local", "helped me", "trust", "walk in", "walked in",
    "friendly", "hug", "empathy", "bereavement", "person", "courteous",
    "professional", "spoken to", "spoke to", "called me",
  ],
  "digital-native": [
    "app", "online", "digital", "website", "mobile", "login", "2fa",
    "card reader", "biometric", "switch", "switching", "transfer",
    "monzo", "starling", "revolut", "chase", "first-time", "first time",
    "deposit", "rate", "modern", "open banking", "fintech", "download",
    "install", "reinstall", "crash", "glitch", "stone age", "archaic",
    "technology", "verification", "verify", "faceid", "fingerprint",
    "isa transfer", "sign up", "sign-up", "onboarding",
  ],
  family: [
    "mortgage", "house", "home", "children", "kids", "family", "son",
    "daughter", "wife", "husband", "insurance", "school", "savings",
    "junior", "isa", "remortgage", "move", "moving", "life insurance",
    "bereavement", "health", "funeral", "joint", "baby", "maternity",
    "property", "first home", "valuation", "survey", "buying", "bought",
    "sons", "flight", "emergency", "travel", "accounts for",
  ],
  "business-owner": [
    "business", "account", "manager", "relationship", "professional",
    "commercial", "loan", "investment", "service", "complaint", "years",
    "customer for", "member for", "loyalty", "declined", "expectations",
    "efficient", "process", "competent", "expert", "reliable",
    "resolution", "compensation", "formal", "appeal", "mortgage",
    "property", "valuation", "declined", "rics", "surveyor",
  ],
};

/**
 * Score a review's relevance to a persona archetype.
 * Checks title, quote, and context against keyword lists.
 */
function scoreRelevance(review: Review, archetype: string): number {
  const keywords = personaKeywords[archetype];
  if (!keywords) return 0;

  const searchText = `${review.title} ${review.quote} ${review.context}`.toLowerCase();
  let score = 0;
  for (const keyword of keywords) {
    if (searchText.includes(keyword.toLowerCase())) {
      score++;
    }
  }
  return score;
}

/**
 * Filter and rank reviews by relevance to a persona archetype.
 * Returns up to `maxReviews` reviews, ensuring a mix of positive and negative.
 * All reviews get a relevanceScore attached.
 */
export function filterReviewsForPersona(
  reviews: Review[],
  archetype: string,
  maxReviews: number = 8
): Review[] {
  // Score all reviews
  const scored = reviews.map((r) => ({
    ...r,
    relevanceScore: scoreRelevance(r, archetype),
  }));

  // Sort by relevance score descending
  scored.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));

  // Take top reviews but ensure at least 2 positive and 2 negative
  const positive = scored.filter((r) => r.sentiment === "positive");
  const negative = scored.filter((r) => r.sentiment === "negative");

  const selected: Review[] = [];
  const usedIds = new Set<number>();

  // Guarantee at least 2 of each sentiment from the top-scored
  for (const pool of [positive, negative]) {
    let count = 0;
    for (const r of pool) {
      if (count >= 2) break;
      if (!usedIds.has(r.id)) {
        selected.push(r);
        usedIds.add(r.id);
        count++;
      }
    }
  }

  // Fill remaining slots from the overall ranked list
  for (const r of scored) {
    if (selected.length >= maxReviews) break;
    if (!usedIds.has(r.id)) {
      selected.push(r);
      usedIds.add(r.id);
    }
  }

  // Re-sort selected by ID for stable display
  selected.sort((a, b) => a.id - b.id);
  return selected;
}

export function parseReviews(knowledge: string): Review[] {
  const reviews: Review[] = [];
  // Match various heading formats across knowledge files
  const headings = [
    "## Specific Trustpilot Reviews",
    "## Specific Customer Reviews",
  ];
  let sectionStart = -1;
  for (const heading of headings) {
    sectionStart = knowledge.indexOf(heading);
    if (sectionStart !== -1) break;
  }
  if (sectionStart === -1) return reviews;

  const reviewSection = knowledge.substring(sectionStart);
  const parts = reviewSection.split(/### (Positive|Negative|Mixed) - /);

  for (let i = 1; i < parts.length; i += 2) {
    const rawSentiment = parts[i].toLowerCase();
    // Treat "mixed" as "negative" for filtering purposes (3-star reviews)
    const sentiment = (rawSentiment === "positive" ? "positive" : "negative") as "positive" | "negative";
    const block = parts[i + 1];
    if (!block) continue;

    const lines = block.split("\n");
    const title = lines[0]?.trim() || "";

    // Extract quote — everything in > lines
    const quoteLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("> ")) {
        quoteLines.push(line.substring(2));
      } else if (quoteLines.length > 0 && !line.startsWith("> ")) {
        // Stop at first non-quote line after we've started
        if (line.trim() === "" || line.startsWith("- **")) break;
      }
    }
    const quote = quoteLines.join(" ").replace(/^"|"$/g, "").trim();

    const ratingMatch = block.match(/\*\*Rating:\*\* (.+)/);
    const dateMatch = block.match(/\*\*Date:\*\* (.+)/);
    const contextMatch = block.match(/\*\*Context:\*\* (.+)/);

    reviews.push({
      id: reviews.length + 1,
      sentiment,
      title,
      quote,
      rating: ratingMatch?.[1]?.trim() || "",
      date: dateMatch?.[1]?.trim() || "",
      context: contextMatch?.[1]?.trim() || "",
    });
  }

  return reviews;
}
