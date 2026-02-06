# BSA Member Chat — Phase 3 Plan

Based on feedback from BS Pod call (6 Feb 2026).

## Task 1: Shorter Responses (Prompt Tuning)
**Priority:** High | **Effort:** Small
**Files:** `app/api/chat/route.ts`

The system prompt already says "1-3 sentences max" but responses are still too long for a stand demo. Changes:
- Make the short response instruction more aggressive — put it at the END of the prompt (recency bias)
- Add explicit word count target: "Keep responses under 40 words unless telling a specific story"
- Add "You are at a conference stand — the person only has a minute" framing
- Reduce `max_tokens` from 1024 to 512 as a hard cap

## Task 2: Suggested Questions (UI Quick Buttons)
**Priority:** High | **Effort:** Medium
**Files:** `app/page.tsx`

Add clickable preset question chips above the input box in the chat screen:
- 5-6 suggested questions that appear below the chat, above the input
- Questions should be persona-aware (different suggestions per archetype)
- Include forward-looking questions as requested ("What would interest you in the next 5 years?")
- Clicking a chip sends it as a message
- Style: pill-shaped buttons, subtle but visible

Suggested questions per persona:
- **All:** "What do you think of {society}?", "What would you change?", "What keeps you as a member?"
- **Loyalist:** "Tell me about your branch visits", "How do you feel about digital banking?"
- **Digital Native:** "How's the app?", "Would you recommend to a friend?", "How do you compare to other banks?"
- **Family:** "How do you manage the family finances?", "What about your children's savings?"
- **Business Owner:** "How's the business banking relationship?", "What could we do better?"
- **Forward-looking (all):** "What would interest you in the next 5 years?", "What would make you leave?"

## Task 3: Smart Money People Scraping
**Priority:** High | **Effort:** Medium-Large
**Files:** New scraper script, knowledge/*.md files

Smart Money People has 1,500+ reviews per society (vs ~10-17 from Trustpilot).
- URL pattern: `https://smartmoneypeople.com/{society}-reviews/product/savings` (and /mortgages, /insurance)
- Also: `https://smartmoneypeople.com/{society}-reviews/products` for all
- Scrape reviews for all 10 societies
- Parse into the same format as existing Trustpilot reviews in knowledge files
- Append to or replace the existing review sections in knowledge/*.md
- May need browser automation (Playwright) if the site uses JS rendering
- Consider keeping both Trustpilot AND Smart Money People reviews, labelled by source

## Task 4: Benchmarking Report
**Priority:** Medium | **Effort:** Large
**Files:** New API route, new UI components, new analysis logic

Generate a scoring report across 10-15 factors per society:
- **Factors:** App quality, Account opening ease, Branch service, Phone support, Savings rates, Mortgage process, Staff knowledge, Communication clarity, Digital experience, Community involvement, Complaint handling, Value for money
- **Method:** Sentiment analysis across all reviews per factor per society
- Score each factor 1-10 based on review sentiment distribution
- Calculate industry average across all 10 societies
- Generate ranking position per factor

**Delivery flow:**
1. After chat session, offer: "Want to see how {society} benchmarks against the industry?"
2. Show a report page with scores per factor vs average
3. Don't reveal which society is #1/#2 — just their position and the average
4. Option to email the report (stretch goal — requires email integration)

**Implementation:**
- New `/api/benchmark` route that analyses all reviews for a society
- New benchmark results page/modal in the UI
- Pre-compute scores at build time or cache them (avoid re-analysing on every request)
- Could use Claude to do the sentiment classification, or do keyword-based scoring
