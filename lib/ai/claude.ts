import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { StructureRequest, StructureResponse, StructuredEntry } from "@/lib/types";
import { FLOOR_MODEL, CEILING_MODEL, routeModel } from "./router";
import { STRUCTURE_SYSTEM, STRUCTURE_SCHEMA, buildUserContent } from "./structurePrompt";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set — add it to .env.local");
  }
  if (!_client) _client = new Anthropic();
  return _client;
}

type ParsedEntry = StructuredEntry & { needsDeeperPass: boolean };

interface PassResult {
  entry: ParsedEntry;
  inputTokens: number;
  outputTokens: number;
}

/** Run a single structuring pass on a specific model. */
async function runPass(model: string, req: StructureRequest): Promise<PassResult> {
  // The system prompt is stable → cache it. The volatile context + raw thought
  // go in the user turn, after the cached prefix.
  const params = {
    model,
    max_tokens: 2000,
    system: [
      {
        type: "text",
        text: STRUCTURE_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      { role: "user", content: buildUserContent(req.raw, req.recent) },
    ],
    output_config: {
      format: { type: "json_schema", schema: STRUCTURE_SCHEMA },
    },
  } as unknown as Anthropic.Messages.MessageCreateParamsNonStreaming;

  const message = await client().messages.create(params);

  const text = message.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  return {
    entry: parseEntry(text.text),
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}

function parseEntry(raw: string): ParsedEntry {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    // Defensive: pull the first {...} block if the model wrapped it in prose.
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not parse structured entry from Claude");
    data = JSON.parse(match[0]);
  }
  const d = data as Record<string, unknown>;
  return {
    title: String(d.title ?? "Untitled"),
    body: String(d.body ?? ""),
    summary: String(d.summary ?? ""),
    themes: Array.isArray(d.themes) ? d.themes.map(String) : [],
    mood: String(d.mood ?? "neutral"),
    entities: Array.isArray(d.entities) ? d.entities.map(String) : [],
    significant: Boolean(d.significant),
    imagePrompt: String(d.imagePrompt ?? ""),
    needsDeeperPass: Boolean(d.needsDeeperPass),
  };
}

/**
 * Structure a raw thought into a journal entry, applying the model throttle:
 * route the first pass by complexity, then escalate a flagged entry from the
 * floor model up to the ceiling model.
 */
export async function structureEntry(req: StructureRequest): Promise<StructureResponse> {
  const firstModel = routeModel({
    operation: "structure",
    text: req.raw,
    markedSignificant: req.markedSignificant,
  });

  let result = await runPass(firstModel, req);
  let model = firstModel;
  let inputTokens = result.inputTokens;
  let outputTokens = result.outputTokens;

  const canEscalate =
    firstModel === FLOOR_MODEL && CEILING_MODEL !== FLOOR_MODEL;
  if (canEscalate && result.entry.needsDeeperPass) {
    const deep = await runPass(CEILING_MODEL, req);
    result = deep;
    model = CEILING_MODEL;
    inputTokens += deep.inputTokens;
    outputTokens += deep.outputTokens;
  }

  // Drop the internal escalation flag before returning to the client.
  const { needsDeeperPass: _drop, ...entry } = result.entry;
  void _drop;

  return {
    entry,
    model,
    usage: { inputTokens, outputTokens },
  };
}
