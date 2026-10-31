import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { Card } from "@/components/Card";
import { CaseDetail } from "@/components/cases/CaseDetail";
import { CaseDrawer } from "@/components/cases/CaseDrawer";
import { CaseTable } from "@/components/cases/CaseTable";
import { Pager } from "@/components/cases/Pager";
import { RunPicker } from "@/components/report/RunPicker";
import { Empty } from "@/components/StateViews";
import { CATEGORIES, SLICES } from "@/core/domain/labels";
import { OutcomeCode } from "@/core/domain/outcome";
import { buildCaseRows, filterRows } from "@/core/views/cases";
import { casesHref, parseCasesQuery, type CasesQuery } from "@/core/views/query";
import { dataDir, getCases, getRun, getRuns, pickRun } from "../data";

export const metadata: Metadata = { title: "Tickets" };
const PAGE_SIZE = 15;

export default async function Page(props: PageProps<"/cases">) {
  await connection();
  const sp = await props.searchParams;
  const runs = getRuns();
  const q = parseCasesQuery(sp);
  const current = pickRun(runs, q.run);
  const cases = getCases();

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Tickets</h1>
          <p className="mt-1 text-muted">Every ticket, every variant, with the raw model output.</p>
        </div>
        {current && (
          <div className="min-w-0 lg:max-w-xl">
            <RunPicker runs={runs} current={current.id} action="/cases" />
          </div>
        )}
      </header>
      <DatasetPanel count={cases.length} />
      {!current ? <Empty title="No runs yet" hint="Run: pnpm pf run --split tuning" /> : <Results q={{ ...q, run: current.id }} page={Number(sp.page) || 1} openId={typeof sp.case === "string" ? sp.case : undefined} />}
    </div>
  );
}

function DatasetPanel({ count }: { count: number }) {
  const file = path.join(dataDir(), "fixtures", "tickets", "agreement.json");
  const a = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  return (
    <details className="rounded-lg border border-line bg-surface p-4 shadow-card">
      <summary className="cursor-pointer font-medium">About this dataset</summary>
      <div className="mt-3 space-y-2 text-sm text-muted">
        <p>
          {count} synthetic support tickets, written by gpt-4.1 from a grid of intended labels, then labeled by one person who could not see the intended label.
          The human label is the gold label.
        </p>
        {a?.category && (
          <p>
            Agreement with the intended label: category {(a.category.agreement * 100).toFixed(1)}% (Cohen&apos;s kappa {a.category.kappa.toFixed(3)}), priority{" "}
            {(a.priority.agreement * 100).toFixed(1)}% (kappa {a.priority.kappa.toFixed(3)}).
          </p>
        )}
        <p>
          Rules for close calls:{" "}
          <a className="text-brand underline" href="https://github.com/shisukeUrahara/promptflight/blob/main/docs/labeling_guide.md">
            labeling guide
          </a>
          .
        </p>
      </div>
    </details>
  );
}

function Results({ q, page, openId }: { q: CasesQuery; page: number; openId?: string }) {
  const { results } = getRun(q.run!);
  const cases = getCases();
  const all = buildCaseRows(results, cases);
  const variants = [...new Set(results.map((r) => r.variant))];
  const rows = filterRows(all, q);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const p = Math.min(Math.max(1, page), pages);
  const shown = rows.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
  const withPage = (extra: string) => (href: string) => `${href}${href.includes("?") ? "&" : "?"}${extra}`;
  const rowHref = (id: string) => withPage(`page=${p}&case=${id}`)(casesHref(q));
  const open = openId ? cases.find((c) => c.case_id === openId) : undefined;

  const chip = (label: string, next: CasesQuery, active: boolean, count?: number) => (
    <Link
      key={label}
      href={casesHref(next)}
      aria-current={active ? "true" : undefined}
      className="rounded-full border border-line px-3 py-1 text-xs aria-[current=true]:border-ink aria-[current=true]:bg-surface-2 aria-[current=true]:font-medium"
    >
      {label}
      {count !== undefined && <span className="ml-1 font-mono text-muted">{count}</span>}
    </Link>
  );
  const sliceCount = (s: string) => all.filter((r) => r.slice === s).length;

  return (
    <Card>
      <div className="mb-4 space-y-3">
        <nav aria-label="Slice" className="flex flex-wrap gap-2">
          {chip("all", { ...q, slice: undefined }, !q.slice, all.length)}
          {SLICES.map((s) => chip(s.replace("_pair", ""), { ...q, slice: s }, q.slice === s, sliceCount(s)))}
        </nav>
        <nav aria-label="Agreement" className="flex flex-wrap gap-2">
          {chip("Only disagreements", { ...q, disagree: !q.disagree || undefined }, !!q.disagree, filterRows(all, { disagree: true }).length)}
          {chip("All variants wrong", { ...q, allwrong: !q.allwrong || undefined }, !!q.allwrong, filterRows(all, { allwrong: true }).length)}
          {q.variant && chip(`${q.variant}${q.pred ? ` answered ${q.pred}` : ""} ×`, { ...q, variant: undefined, pred: undefined }, true)}
        </nav>
        <form method="get" action="/cases" className="flex flex-wrap gap-2">
          {Object.entries(q).map(([k, v]) => (k === "gold" || k === "failure" || v === undefined ? null : <input key={k} type="hidden" name={k} value={v === true ? "1" : String(v)} />))}
          <label className="sr-only" htmlFor="gold">
            Gold category
          </label>
          <AutoSubmitSelect id="gold" name="gold" defaultValue={q.gold ?? ""} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm">
            <option value="">Any gold category</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </AutoSubmitSelect>
          <label className="sr-only" htmlFor="failure">
            Failure code
          </label>
          <AutoSubmitSelect id="failure" name="failure" defaultValue={q.failure ?? ""} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm">
            <option value="">Any outcome</option>
            {OutcomeCode.options.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </AutoSubmitSelect>
          <noscript>
            <button className="rounded-lg border border-line px-3 py-1.5 text-sm">Filter</button>
          </noscript>
        </form>
      </div>
      {shown.length === 0 ? (
        <Empty title="No tickets match" hint="Remove a filter to see more." />
      ) : (
        <CaseTable rows={shown} variants={variants} rowHref={rowHref} />
      )}
      <div className="mt-4">
        <Pager total={rows.length} pageSize={PAGE_SIZE} page={p} href={(n) => withPage(`page=${n}`)(casesHref(q))} noun="tickets" />
      </div>
      {open && (
        <CaseDrawer title={open.case_id} closeHref={withPage(`page=${p}`)(casesHref(q))} returnFocusId={`row-${open.case_id}`}>
          <CaseDetail c={open} results={results.filter((r) => r.case_id === open.case_id)} />
        </CaseDrawer>
      )}
    </Card>
  );
}
