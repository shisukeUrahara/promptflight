"use client";
import { Check, Copy } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PromptVersion } from "@/core/prompts/version";
import { savePrompt, type ActionResult } from "@/app/prompts/actions";

const MonacoEditor = dynamic(() => import("./MonacoEditor"), {
  ssr: false,
  loading: () => <div className="grid h-[22rem] place-items-center rounded-lg border border-line text-sm text-muted">Loading editor…</div>,
});

type Base = Pick<PromptVersion, "name" | "messages" | "output_mode" | "examples"> & { id: string };

/** Edit a version and save it as a new one. The text changes only here; the saved file is immutable. */
export function Workbench({ base, readonly }: { base: Base; readonly: boolean }) {
  const [messages, setMessages] = useState(base.messages);
  const [tab, setTab] = useState(0);
  const [outputMode, setOutputMode] = useState(base.output_mode);
  const [examples, setExamples] = useState(base.examples);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const changed = JSON.stringify([messages, outputMode, examples]) !== JSON.stringify([base.messages, base.output_mode, base.examples]);
  const command = `pnpm pf run --split tuning --variants ${result?.ok ? result.id : base.id}`;

  const save = () =>
    start(async () => {
      const r = await savePrompt({ name: base.name, messages, output_mode: outputMode, examples });
      setResult(r);
      if (r.ok) router.replace(`/prompts?name=${base.name}&id=${r.id}`, { scroll: false });
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Message" className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
          {messages.map((m, i) => (
            <button
              key={i}
              role="tab"
              type="button"
              aria-selected={tab === i}
              onClick={() => setTab(i)}
              className="rounded-md px-3 py-1.5 text-sm capitalize text-muted aria-selected:bg-surface aria-selected:font-medium aria-selected:text-ink"
            >
              {m.role}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted">Output</span>
          <select value={outputMode} onChange={(e) => setOutputMode(e.target.value as Base["output_mode"])} className="rounded-lg border border-line bg-surface px-2 py-1.5">
            <option value="json_prompt">json_prompt</option>
            <option value="json_strict">json_strict</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Examples</span>
          <select value={examples} onChange={(e) => setExamples(e.target.value as Base["examples"])} className="rounded-lg border border-line bg-surface px-2 py-1.5">
            <option value="none">none</option>
            <option value="fewshot">fewshot</option>
          </select>
        </label>
      </div>
      <div className="overflow-hidden rounded-lg border border-line">
        <MonacoEditor
          key={`${base.id}-${tab}`}
          label={`${messages[tab].role} message of ${base.name}`}
          value={messages[tab].content}
          onChange={(v) => setMessages((ms) => ms.map((m, i) => (i === tab ? { ...m, content: v } : m)))}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={readonly || !changed || pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save as new version"}
        </button>
        {readonly && <span className="text-sm text-muted">Read-only: saving is turned off on this server.</span>}
        {!readonly && !changed && <span className="text-sm text-muted">Edit the prompt to save a new version.</span>}
        {result && (
          <span role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-success" : "text-danger"}`}>
            {result.ok ? (result.restored ? `Same as ${result.id}, which is now the newest.` : `Saved as ${result.id}.`) : result.error}
          </span>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs">{command}</code>
        <button
          type="button"
          aria-label="Copy command"
          onClick={() => navigator.clipboard?.writeText(command).then(() => setCopied(true))}
          className="grid size-8 place-items-center rounded-md border border-line"
        >
          {copied ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}
