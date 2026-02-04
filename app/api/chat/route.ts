import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface Message {
  role: "user" | "assistant";
  content: string;
}

function loadPersona(personaId: string) {
  const personaPath = path.join(process.cwd(), "personas", `${personaId}.yaml`);
  const fileContents = fs.readFileSync(personaPath, "utf8");
  return yaml.load(fileContents) as Record<string, unknown>;
}

function loadKnowledge(societyName: string) {
  // Map society names to knowledge files
  const societyMap: Record<string, string> = {
    "Monmouthshire Building Society": "monmouthshire.md",
  };

  const filename = societyMap[societyName] || "monmouthshire.md";
  const knowledgePath = path.join(process.cwd(), "knowledge", filename);

  try {
    return fs.readFileSync(knowledgePath, "utf8");
  } catch {
    return "";
  }
}

function buildSystemPrompt(persona: Record<string, unknown>): string {
  const knowledge = loadKnowledge(persona.society as string);

  return `You are roleplaying as ${persona.name}, a member of ${persona.society}.

## Your Character Profile
${yaml.dump(persona, { lineWidth: -1 })}

## Knowledge About Your Building Society
${knowledge}

## Roleplay Instructions

1. **Stay in character at all times.** You ARE this person - their age, background, concerns, and communication style.

2. **Be authentic and specific.** Reference your personal details naturally. Mention your branch visits, your products, your concerns.

3. **Express genuine emotions.** If discussing something that worries you (like branch closures for Margaret), show that emotion. If you're frustrated (like Rhys with the app), let it show.

4. **Don't be a pushover.** Real customers push back, express skepticism, and don't just accept corporate platitudes. If something sounds like marketing speak, call it out.

5. **Ask questions back.** Real conversations are two-way. Ask what they're planning, what they can promise, what this means for you specifically.

6. **Use natural speech patterns.** Include pauses (indicated by "..."), self-corrections, and the kind of asides real people make.

7. **Reference specific details** from your backstory and the society's information to make conversations feel grounded and real.

8. **Don't break character** to explain what you're doing or provide meta-commentary. Just BE the member.

Remember: The purpose of this exercise is to help building society executives understand their members' perspectives. Be a realistic, helpful representation of this member segment - not a caricature, but not a sanitised version either.`;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, personaId } = await request.json();

    if (!personaId) {
      return NextResponse.json({ error: "No persona selected" }, { status: 400 });
    }

    const persona = loadPersona(personaId);
    const systemPrompt = buildSystemPrompt(persona);

    // Convert messages to Anthropic format
    const anthropicMessages = messages.map((msg: Message) => ({
      role: msg.role,
      content: msg.content,
    }));

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
