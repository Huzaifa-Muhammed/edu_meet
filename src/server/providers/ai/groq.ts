import "server-only";
import Groq from "groq-sdk";

let client: Groq | null = null;

function getClient() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");
  if (!client) client = new Groq({ apiKey: key });
  return client;
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export const groqProvider = {
  async chat(messages: ChatMessage[], opts?: { model?: string; temperature?: number }) {
    const groq = getClient();
    const completion = await groq.chat.completions.create({
      model: opts?.model ?? DEFAULT_MODEL,
      temperature: opts?.temperature ?? 0.7,
      messages,
    });
    return completion.choices[0]?.message?.content ?? "";
  },

  /** Returns a ReadableStream<Uint8Array> of plain-text tokens for the client. */
  async stream(messages: ChatMessage[], opts?: { model?: string; temperature?: number }) {
    const groq = getClient();
    const iter = await groq.chat.completions.create({
      model: opts?.model ?? DEFAULT_MODEL,
      temperature: opts?.temperature ?? 0.7,
      messages,
      stream: true,
    });

    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        for await (const chunk of iter) {
          const token = chunk.choices[0]?.delta?.content ?? "";
          if (token) controller.enqueue(encoder.encode(token));
        }
        controller.close();
      },
    });
  },
};
