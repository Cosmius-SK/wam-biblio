import "server-only";
import type { StructureRequest, StructureResponse, StructuredEntry } from "@/lib/types";
import { FLOOR_MODEL, CEILING_MODEL, routeModel } from "./router";
import { STRUCTURE_SYSTEM, STRUCTURE_SCHEMA, buildUserContent } from "./structurePrompt";
import { structuredCall, parseJsonObject } from "./client";

type ParsedEntry = StructuredEntry & { needsDeeperPass: boolean };

interface PassResult {
  entry: ParsedEntry;
  inputTokens: number;
  outputTokens: number;
}

/** Run a single structuring pass on a specific model. */
async function runPass(model: string, req: StructureRequest): Promise<PassResult> {
  const res = await structuredCall({
    model,
    system: STRUCTURE_SYSTEM,
    user: buildUserContent(req.raw, req.recent, { when: req.occurredAt, place: req.placeName }),
    schema: STRUCTURE_SCHEMA,
  });
  return {
    entry: parseEntry(res.text),
    inputTokens: res.inputTokens,
    outputTokens: res.outputTokens,
  };
}

function parseEntry(raw: string): ParsedEntry {
  const d = parseJsonObject(raw);
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

  const canEscalate = firstModel === FLOOR_MODEL && CEILING_MODEL !== FLOOR_MODEL;
  if (canEscalate && result.entry.needsDeeperPass) {
    const deep = await runPass(CEILING_MODEL, req);
    result = deep;
    model = CEILING_MODEL;
    inputTokens += deep.inputTokens;
    outputTokens += deep.outputTokens;
  }

  const { needsDeeperPass: _drop, ...entry } = result.entry;
  void _drop;

  return { entry, model, usage: { inputTokens, outputTokens } };
}
