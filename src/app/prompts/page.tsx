import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Card } from "@/components/Card";
import { RestoreButton } from "@/components/prompts/RestoreButton";
import { Workbench } from "@/components/prompts/Workbench";
import { Empty } from "@/components/StateViews";
import { VariantName } from "@/components/Variant";
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
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold md:text-3xl">Prompts</h1>
        <p className="mt-1 text-muted">Prompt versions are immutable. An edit is saved as a new version, named by a hash of its content.</p>
      </header>
      {!selected ? (
        <Empty title="No prompts yet" hint="Run: pnpm tsx scripts/write-variant-prompts.ts" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[16rem_minmax(0,1fr)_20rem]">
          <Card title="Versions">
            <ul className="space-y-4">
              {names.map((n) => {
                const vs = listVersions(dataDir, n);
                return (
                  <li key={n}>
                    <Link href={`/prompts?name=${n}`} aria-current={n === name ? "true" : undefined} className="text-sm aria-[current=true]:font-semibold">
                      <VariantName name={n} />
                    </Link>
                    <ol aria-label={`${n} versions, newest first`} className="mt-1 space-y-1 border-l border-line pl-3">
                      {[...vs].reverse().map((v, i) => (
                        <li key={v.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <Link
                            href={`/prompts?name=${n}&id=${v.id}`}
                            aria-current={n === name && v.id === selected.id ? "true" : undefined}
                            className="font-mono text-brand underline-offset-2 hover:underline aria-[current=true]:font-semibold"
                          >
                            {v.id}
                          </Link>
                          {frozen[n] === v.id && <span className="rounded-full bg-success-bg px-1.5 text-success">frozen</span>}
                          {i === 0 ? <span className="text-muted">newest</span> : <RestoreButton name={n} id={v.id} disabled={readonly} />}
                          <span className="w-full text-muted">
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
              <p role="status" className="mb-3 rounded-lg bg-success-bg px-3 py-2 text-sm text-success">
                {sp.saved === "1" ? `Saved as ${selected.id}.` : `This content already existed as ${selected.id}; it is now the newest version.`}
              </p>
            )}
            <Workbench key={selected.id} base={selected} readonly={readonly} />
          </Card>
          <Card title="Schema preview" hint="What json_strict sends as response_format. json_prompt asks for the same shape in the text.">
            <pre tabIndex={0} aria-label="JSON schema" className="overflow-x-auto rounded-lg bg-canvas p-3 font-mono text-xs">{JSON.stringify(schema, null, 2)}</pre>
          </Card>
        </div>
      )}
    </div>
  );
}
