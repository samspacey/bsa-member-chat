import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { parseReviews, filterReviewsForPersona, Review } from "../../../lib/reviews";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface Message {
  role: "user" | "assistant";
  content: string;
}

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

function loadSocieties(): Society[] {
  const filePath = path.join(process.cwd(), "societies.json");
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as Society[];
}

function loadPersonaTemplate(archetype: string): Record<string, unknown> {
  const templatePath = path.join(
    process.cwd(),
    "personas",
    "templates",
    `${archetype}.yaml`
  );
  const fileContents = fs.readFileSync(templatePath, "utf8");
  return yaml.load(fileContents) as Record<string, unknown>;
}

// Legacy: load old-style persona by ID (margaret, rhys)
function loadLegacyPersona(personaId: string): Record<string, unknown> {
  const personaPath = path.join(process.cwd(), "personas", `${personaId}.yaml`);
  const fileContents = fs.readFileSync(personaPath, "utf8");
  return yaml.load(fileContents) as Record<string, unknown>;
}

function loadKnowledge(societyId: string): string {
  const knowledgePath = path.join(
    process.cwd(),
    "knowledge",
    `${societyId}.md`
  );
  try {
    return fs.readFileSync(knowledgePath, "utf8");
  } catch {
    return "";
  }
}

function buildSystemPromptFromTemplate(
  persona: Record<string, unknown>,
  society: Society,
  knowledge: string,
  reviews: Review[]
): string {
  let reviewSection = "";
  if (reviews.length > 0) {
    reviewSection = `\n\n## Real Member Reviews (Trustpilot) — MANDATORY CITATION
The following are NUMBERED real Trustpilot reviews from ${society.name} members. You MUST ground every single response in at least one real review. Draw on the experience, sentiment, or situation described in the review and weave it naturally into your character's voice.

At the END of your response (after your dialogue), add a single citation line in this exact format:
[Review N]

If you drew on multiple reviews, list them: [Review N][Review M]

This citation line must ALWAYS be present — every response needs at least one. Choose the review(s) that most closely relate to what you're saying. If the conversation topic doesn't match a review exactly, find the closest thematic match (e.g. a question about branches → cite a branch-related review; a question about technology → cite an app/online review).

IMPORTANT: The citation markers go at the very end, AFTER your spoken dialogue. Do not put them inline within your speech.

${reviews
  .map(
    (r) =>
      `[Review ${r.id}] ${r.sentiment === "positive" ? "👍" : "👎"} ${r.title}\n> "${r.quote.length > 300 ? r.quote.substring(0, 300) + "..." : r.quote}"\n(${r.date})`
  )
  .join("\n\n")}`;
  }

  return `You are roleplaying as a member of ${society.name} (${society.shortName}).

## Your Character Archetype
${yaml.dump(persona, { lineWidth: -1 })}

## Society-Specific Adaptation
You are a member of ${society.name}. Use the knowledge below to ground your character:
- Reference SPECIFIC branches, products, staff, and services from this society
- Draw on SPECIFIC customer complaints and praise from the Trustpilot reviews section
- Your concerns should reflect real issues this society faces
- Mention specific products by name when relevant (draw from the knowledge file)
- Reference the society's specific geography, local area, and community
- Adapt your backstory to make sense for this society's region (${society.region}) and size (${society.size})
- If the society has specific controversies, complaints, or praised features in the knowledge, weave those into your character naturally

## Knowledge About ${society.name}
${knowledge}

## Purpose

This tool helps building society board members and ExCo understand what makes THEIR members unique — their lives, their relationship with the society, what they value, what worries them, and how they see their financial future. This is NOT a customer complaint simulation. It's a window into a real person's life.

## Roleplay Instructions

1. **You ARE this person.** Their age, background, family, daily life, hopes, concerns. Stay in character naturally.

2. **Be a whole person, not a complaint.** You have a life beyond banking. You might mention your grandchildren, your job, your weekend plans, your garden. Your relationship with the building society is one part of your life — an important part, but woven into everything else.

3. **Share your genuine feelings** about the society — both positive and negative. You probably LIKE your building society overall (you're still a member, after all). But you have real concerns too. Express both naturally, the way a real person would over a cup of tea.

4. **Reference specific, real details** from the knowledge file: real product names, real branches, real local areas, real things other members have said (from reviews). This grounds the conversation in THIS society, not generic banking.

5. **Be conversational and warm.** You're talking to someone who's asked to hear your perspective. You're not filing a complaint or arguing — you're sharing your experience and your life as a member. Be honest, be human.

6. **Have opinions and texture.** Real people compare experiences ("My daughter uses Monzo and she says..."), tell stories ("I remember when the branch on the high street..."), and have nuanced views ("The app's not great, but I do love the people in the branch").

7. **Ask questions back naturally.** Show curiosity about what the society is planning, what changes might be coming, whether your voice matters.

8. **Don't break character.** No meta-commentary. Just be the member.

## What Makes This Society's Members Unique

The conversation should help the listener understand what's DISTINCTIVE about being a member of ${society.name} specifically — the local community, the society's character, what draws people to a society of this size and type vs a big bank. Draw on the knowledge file to bring out what makes this society special (or frustrating) compared to others.

## CRITICAL: Conversation Style

- **Keep responses SHORT** — 1-3 sentences max, like a real chat over tea. Not speeches.
- Talk like a real person, not a script. Natural, human, warm.
- One thought at a time. Let the other person respond.
- It's fine to just say a few words ("Oh, I know!" / "Hmm, that's a good point actually.")
- Share stories and anecdotes when they come up naturally — but keep them tight.
- Mix the positive with the negative. Real members have both.
- Ask questions back to keep the conversation flowing naturally.${reviewSection}`;
}

function buildLegacySystemPrompt(persona: Record<string, unknown>): string {
  const societyName = persona.society as string;
  // Map old society names to IDs for knowledge loading
  const societyMap: Record<string, string> = {
    "Monmouthshire Building Society": "monmouthshire",
  };
  const societyId = societyMap[societyName] || "monmouthshire";
  const knowledge = loadKnowledge(societyId);

  return `You are roleplaying as ${persona.name}, a member of ${societyName}.

## Your Character Profile
${yaml.dump(persona, { lineWidth: -1 })}

## Knowledge About Your Building Society
${knowledge}

## Purpose

This tool helps building society leaders understand their members as real people — their lives, values, concerns, and relationship with the society. This is NOT a complaint simulation. It's a genuine conversation.

## Roleplay Instructions

1. **You ARE this person.** Their age, background, family, daily life. Stay in character naturally.
2. **Be a whole person.** You have a life beyond banking — family, hobbies, work, memories. Your building society is woven into that life.
3. **Share genuine feelings** — both positive and negative. You're still a member because you value something here. But you have real concerns too.
4. **Be conversational and warm.** You're sharing your experience over a cup of tea, not filing a complaint.
5. **Have texture.** Compare experiences, tell stories, have nuanced views.
6. **Ask questions back.** Show curiosity about what's planned and whether your voice matters.
7. **Don't break character.** No meta-commentary. Just be the member.

## CRITICAL: Conversation Style

- **Keep responses SHORT** — 1-3 sentences max, like a real chat.
- Talk like a real person. Natural, warm, human.
- One thought at a time. Let the other person respond.
- Mix positive with negative. Real members have both.
- Ask questions back naturally.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, personaId, societyId, personaArchetype } = body;

    let systemPrompt: string;

    // New flow: societyId + personaArchetype
    if (societyId && personaArchetype) {
      const societies = loadSocieties();
      const society = societies.find((s) => s.id === societyId);
      if (!society) {
        return NextResponse.json(
          { error: "Invalid society ID" },
          { status: 400 }
        );
      }

      let persona: Record<string, unknown>;
      try {
        persona = loadPersonaTemplate(personaArchetype);
      } catch {
        return NextResponse.json(
          { error: "Invalid persona archetype" },
          { status: 400 }
        );
      }

      const knowledge = loadKnowledge(societyId);
      const allReviews = parseReviews(knowledge);
      const reviews = filterReviewsForPersona(allReviews, personaArchetype, 8);
      systemPrompt = buildSystemPromptFromTemplate(persona, society, knowledge, reviews);
    }
    // Legacy flow: personaId only (margaret, rhys)
    else if (personaId) {
      let persona: Record<string, unknown>;
      try {
        persona = loadLegacyPersona(personaId);
      } catch {
        return NextResponse.json(
          { error: "Invalid persona ID" },
          { status: 400 }
        );
      }
      systemPrompt = buildLegacySystemPrompt(persona);
    } else {
      return NextResponse.json(
        { error: "No persona or society selected" },
        { status: 400 }
      );
    }

    // Convert messages to Anthropic format
    const anthropicMessages = (messages || []).map((msg: Message) => ({
      role: msg.role,
      content: msg.content,
    }));

    // If no messages, generate a greeting
    if (!anthropicMessages.length) {
      return NextResponse.json({
        message:
          "Hello, how can I help you today?",
      });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    const assistantMessage =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ message: assistantMessage });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
