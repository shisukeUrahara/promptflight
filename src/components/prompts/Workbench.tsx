"use client";
import { Check, Copy } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PromptVersion } from "@/core/prompts/version";
import { savePrompt, type ActionResult } from "@/app/prompts/actions";

const MonacoEditor = dynamic(() => import("./MonacoEditor"), {
  ssr: false,
  loading: () => <div className="grid h-[22rem] place-items-center rounded-2xl border border-line text-sm text-muted">Loading editor…</div>,
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
      // The page shows the new version (and remounts this editor), so the result travels in the URL.
      if (r.ok) router.replace(`/prompts?name=${base.name}&id=${r.id}&${r.restored ? "restored" : "saved"}=1`, { scroll: false });
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Message" className="inline-flex rounded-full border border-line bg-surface/70 p-1">
          {messages.map((m, i) => (
            <button
              key={i}
              role="tab"
              type="button"
              aria-selected={tab === i}
              onClick={() => setTab(i)}
              className="rounded-full px-4 py-1.5 text-sm capitalize text-muted transition-colors hover:text-ink aria-selected:bg-surface-2 aria-selected:font-medium aria-selected:text-ink aria-selected:shadow-card"
            >
              {m.role}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="micro">Output</span>
          <select value={outputMode} onChange={(e) => setOutputMode(e.target.value as Base["output_mode"])} className="rounded-full border border-line bg-surface/70 px-3 py-1.5 font-mono text-xs">
            <option value="json_prompt">json_prompt</option>
            <option value="json_strict">json_strict</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="micro">Examples</span>
          <select value={examples} onChange={(e) => setExamples(e.target.value as Base["examples"])} className="rounded-full border border-line bg-surface/70 px-3 py-1.5 font-mono text-xs">
            <option value="none">none</option>
            <option value="fewshot">fewshot</option>
          </select>
        </label>
      </div>
      <div className="overflow-hidden rounded-2xl border border-line">
        <MonacoEditor
          key={`${base.id}-${tab}`}
          label={`${messages[tab].role} message of ${base.name}`}
          value={messages[tab].content}
          onChange={(v) => setMessages((ms) => ms.map((m, i) => (i === tab ? { ...m, content: v } : m)))}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface-2/50 p-3">
        <button
          type="button"
          onClick={save}
          disabled={readonly || !changed || pending}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-ink shadow-[0_0_24px_-6px_var(--glow-violet)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {pending ? "Saving…" : "Save as new version"}
        </button>
        {readonly && <span className="text-sm text-muted">Read-only: saving is turned off on this server.</span>}
        {!readonly && !changed && <span className="text-sm text-muted">Edit the prompt to save a new version.</span>}
        {result && !result.ok && (
          <span role="alert" className="text-sm text-danger">
            {result.error}
          </span>
        )}
      </div>
      <div className="flex min-w-0 items-center gap-2 rounded-full border border-line bg-canvas/70 py-1.5 pl-4 pr-1.5">
        <span className="micro shrink-0">Run it</span>
        <code className="min-w-0 flex-1 truncate font-mono text-xs">{command}</code>
        <button
          type="button"
          aria-label="Copy command"
          onClick={() => navigator.clipboard?.writeText(command).then(() => setCopied(true))}
          className="grid size-8 place-items-center rounded-full border border-line hover:bg-surface-2"
        >
          {copied ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}
