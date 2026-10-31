import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Card } from "@/components/Card";
import { RestoreButton } from "@/components/prompts/RestoreButton";
import { Workbench } from "@/components/prompts/Workbench";
import { Empty } from "@/components/StateViews";
import { Pill } from "@/components/ui/Pill";
import { VariantName, variantMeta } from "@/components/Variant";
import { strictResponseFormat } from "@/core/llm/strict";
import { readFrozen } from "@/core/prompts/frozen";
import { listNames, listVersions } from "@/core/prompts/version";
import { env } from "../data";

export const metadata: Metadata = { title: "Prompts" };

export default async function Page(props: PageProps<"/prompts">) {
  await connection();
  const sp = await props.searchParams;
  const { dataDir, readonly } = env();
  const names = listNames(dataDir);
  const frozen = readFrozen(dataDir);
  const name = names.includes(String(sp.name)) ? String(sp.name) : names[0];
  const versions = name ? listVersions(dataDir, name) : [];
  const selected = versions.find((v) => v.id === sp.id) ?? versions.at(-1);
  const schema = (strictResponseFormat() as { json_schema: { schema: object } }).json_schema.schema;

  return (
    <div className="space-y-8">
      <header className="fade-up">
        <h1 className="display text-5xl md:text-6xl">Prompts</h1>
        <p className="mt-3 max-w-2xl text-muted">Prompt versions are immutable. An edit is saved as a new version, named by a hash of its content.</p>
      </header>
      {!selected ? (
        <Empty title="No prompts yet" hint="Run: pnpm tsx scripts/write-variant-prompts.ts" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[16rem_minmax(0,1fr)_20rem]">
          <Card title="Versions">
            <ul className="space-y-5">
              {names.map((n) => {
                const vs = listVersions(dataDir, n);
                return (
                  <li key={n}>
                    <Link
                      href={`/prompts?name=${n}`}
                      aria-current={n === name ? "true" : undefined}
                      className="inline-flex rounded-full px-2.5 py-1 text-sm hover:bg-surface-2 aria-[current=true]:bg-brand-bg aria-[current=true]:font-medium"
                    >
                      <VariantName name={n} />
                    </Link>
                    <ol aria-label={`${n} versions, newest first`} className="ml-4 mt-2 space-y-3 border-l border-line pl-4">
                      {[...vs].reverse().map((v, i) => (
                        <li key={v.id} className="relative flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <span aria-hidden className={`absolute -left-[1.3rem] top-1 size-2 rounded-full ring-4 ring-surface ${i === 0 ? variantMeta(n).dot : "bg-line"}`} />
                          <Link
                            href={`/prompts?name=${n}&id=${v.id}`}
                            aria-current={n === name && v.id === selected.id ? "true" : undefined}
                            className="font-mono text-brand underline-offset-2 hover:underline aria-[current=true]:font-semibold"
                          >
                            {v.id}
                          </Link>
                          {frozen[n] === v.id && <Pill tone="success">frozen</Pill>}
                          {i === 0 ? <Pill tone="brand">newest</Pill> : <RestoreButton name={n} id={v.id} disabled={readonly} />}
                          <span className="w-full font-mono text-[11px] text-muted">
                            {v.created_at.slice(0, 16).replace("T", " ")} UTC{v.parent ? ` · from ${v.parent}` : ""}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card title={`${selected.name} · ${selected.id}`} hint={`${selected.output_mode} · examples: ${selected.examples}`}>
            {(sp.saved === "1" || sp.restored === "1") && (
              <p role="status" className="mb-4 rounded-2xl bg-success-bg px-4 py-2.5 text-sm text-success">
                {sp.saved === "1" ? `Saved as ${selected.id}.` : `This content already existed as ${selected.id}; it is now the newest version.`}
              </p>
            )}
            <Workbench key={selected.id} base={selected} readonly={readonly} />
          </Card>
          <Card title="Schema preview" hint="What json_strict sends as response_format. json_prompt asks for the same shape in the text.">
            <pre tabIndex={0} aria-label="JSON schema" className="max-h-[32rem] overflow-auto rounded-2xl border border-line bg-canvas/70 p-4 font-mono text-xs leading-relaxed">{JSON.stringify(schema, null, 2)}</pre>
          </Card>
        </div>
      )}
    </div>
  );
}
