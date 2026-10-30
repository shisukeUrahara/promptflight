"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { restoreVersion, saveEdit } from "@/core/prompts/edit";
import { PromptName, PromptVersion } from "@/core/prompts/version";
import { env } from "../data";

export type ActionResult = { ok: true; id: string; restored: boolean } | { ok: false; error: string };

const SaveInput = z.object({
  name: PromptName,
  messages: PromptVersion.shape.messages,
  output_mode: PromptVersion.shape.output_mode,
  examples: PromptVersion.shape.examples,
});

// Server actions are public POST endpoints: the read-only check and the validation happen here, not in the UI.
const READ_ONLY: ActionResult = { ok: false, error: "Saving is turned off on this server (PF_READONLY=1)." };

export async function savePrompt(input: unknown): Promise<ActionResult> {
  if (env().readonly) return READ_ONLY;
  const parsed = SaveInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: `Not a valid prompt: ${parsed.error.issues.map((i) => i.path.join(".") || i.message).join(", ")}` };
  const { name, ...edit } = parsed.data;
  try {
    const saved = saveEdit(env().dataDir, name, edit, new Date());
    revalidatePath("/prompts");
    return { ok: true, id: saved.id, restored: saved.restored };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function restorePrompt(input: unknown): Promise<ActionResult> {
  if (env().readonly) return READ_ONLY;
  const parsed = z.object({ name: PromptName, id: z.string().regex(/^[0-9a-f]{8}$/) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Not a valid version." };
  try {
    const r = restoreVersion(env().dataDir, parsed.data.name, parsed.data.id, new Date());
    revalidatePath("/prompts");
    return { ok: true, id: r.id, restored: r.restored };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
