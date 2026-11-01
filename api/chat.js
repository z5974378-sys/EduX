import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const systemPrompt = readFileSync(
  new URL("./system-prompt.txt", import.meta.url),
  "utf8"
);

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES = 20;

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Please send a message as JSON." },
      { status: 400 }
    );
  }

  const messages = Array.isArray(body?.messages) ? body.messages : null;

  if (!messages || messages.length === 0) {
    return Response.json(
      { error: "Please send at least one message." },
      { status: 400 }
    );
  }

  const cleaned = [];
  for (const message of messages.slice(-MAX_MESSAGES)) {
    const role = message?.role;
    const content = typeof message?.content === "string" ? message.content : "";

    if (role !== "user" && role !== "assistant") {
      return Response.json(
        { error: "Each message needs a user or assistant role." },
        { status: 400 }
      );
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      return Response.json(
        { error: "That message is too long. Please keep it under 2000 characters." },
        { status: 400 }
      );
    }

    if (content.trim()) {
      cleaned.push({ role, content });
    }
  }

  if (cleaned.length === 0) {
    return Response.json(
      { error: "Please send at least one message." },
      { status: 400 }
    );
  }

  try {
    const client = new Anthropic();

    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: systemPrompt,
      messages: cleaned,
    });

    const reply = (response.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!reply) {
      return Response.json(
        { error: "The assistant did not send a reply. Please try again." },
        { status: 502 }
      );
    }

    return Response.json({ reply });
  } catch (error) {
    console.error("Chat request failed:", error);
    return Response.json(
      { error: "Sorry, something went wrong. Please try again in a moment." },
      { status: 500 }
    );
  }
}
