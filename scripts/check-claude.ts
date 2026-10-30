import { config } from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

config({ path: ".env.local" });

async function main() {
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

  const started = Date.now();
  const res = await client.messages.create({
    model,
    max_tokens: 1024,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: "Reply with the single word: ready" }],
  });

  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  console.log({ model: res.model, stop_reason: res.stop_reason, text, ms: Date.now() - started, usage: res.usage });
}

main().catch((err) => {
  console.error(err instanceof Error ? `${err.name}: ${err.message}` : err);
  process.exit(1);
});
