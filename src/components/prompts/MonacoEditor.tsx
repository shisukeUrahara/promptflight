"use client";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { useTheme } from "next-themes";

// Bundle Monaco with the app instead of loading it from a CDN.
loader.config({ monaco });
if (typeof self !== "undefined") {
  (self as unknown as { MonacoEnvironment: object }).MonacoEnvironment = {
    getWorker: () => new Worker(new URL("monaco-editor/editor/editor.worker", import.meta.url), { type: "module" }),
  };
}

// Highlight {{placeholders}} so they stand out from the prompt text.
if (!monaco.languages.getLanguages().some((l) => l.id === "prompt")) {
  monaco.languages.register({ id: "prompt" });
  monaco.languages.setMonarchTokensProvider("prompt", { tokenizer: { root: [[/\{\{\w+\}\}/, "keyword"]] } });
}

export default function MonacoEditor({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const { resolvedTheme } = useTheme();
  return (
    <Editor
      height="22rem"
      language="prompt"
      theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
      value={value}
      onChange={(v) => onChange(v ?? "")}
      options={{ minimap: { enabled: false }, wordWrap: "on", fontSize: 13, lineNumbers: "on", scrollBeyondLastLine: false, ariaLabel: label }}
    />
  );
}
