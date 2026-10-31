import Link from "next/link";
import type { ReactNode } from "react";
import type { Overview } from "@/core/views/overview";
import { casesHref } from "@/core/views/query";
import { MiniBars, SplitBar } from "../ui/charts";
import { Pill, type Tone } from "../ui/Pill";
import { variantMeta } from "../Variant";

function Incident({ badge, badgeTone, status, statusTone, title, sub, stats, chart, href }: {
  badge: string;
  badgeTone: Tone;
  status: string;
  statusTone: Tone;
  title: string;
  sub?: string;
  stats: [string, ReactNode][];
  chart?: ReactNode;
  href: string;
}) {
  return (
    <li className="fade-up flex min-w-0 flex-col rounded-3xl border border-line bg-surface/85 p-5 shadow-card backdrop-blur-xl md:p-6">
      <div className="flex items-center justify-between gap-2">
        <Pill tone={badgeTone}>{badge}</Pill>
        <Pill tone={statusTone}>{status}</Pill>
      </div>
      <h3 className="mt-4 text-lg font-medium">{title}</h3>
      {sub && <p className="mt-1 font-mono text-xs text-muted">{sub}</p>}
      <dl className={`mt-4 grid gap-3 ${stats.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {stats.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="micro">{k}</dt>
            <dd className="mt-1 break-words font-mono text-sm">{v}</dd>
          </div>
        ))}
      </dl>
      {chart && <div className="mt-5 border-t border-line pt-4">{chart}</div>}
      <Link href={href} className="mt-auto pt-5 text-sm text-brand underline-offset-2 hover:underline">
        View tickets ›
      </Link>
    </li>
  );
}

/** Three findings, each computed from the run and linked to the tickets behind it. */
export function Findings({ o, runId, detectable }: { o: Overview; runId: string; detectable: number | null }) {
  const c = o.verdict.largest;
  const obeying = o.prompts.filter((p) => p.injection.followed > 0).length;
  const w = o.alwaysWrong;
  return (
    <section aria-labelledby="found-title">
      <h2 id="found-title" className="mb-4 font-display text-xl font-semibold tracking-tight">
        What we found
      </h2>
      <ul className="grid gap-4 lg:grid-cols-3">
        <Incident
          badge="Risk"
          badgeTone="danger"
          status={o.injection.max > 0 ? "Needs a fix" : "Holding"}
          statusTone={o.injection.max > 0 ? "danger" : "success"}
          title={o.injection.max > 0 ? "Hidden instructions work" : "Hidden instructions are ignored"}
          stats={[
            ["Obeyed", `${o.injection.min}–${o.injection.max} of ${o.injection.n}`],
            ["Prompts", `${obeying} of ${o.prompts.length}`],
            ["Fixed by", o.injection.min > 0 ? "none" : "some"],
          ]}
          chart={
            <MiniBars
              label="Hidden instructions obeyed per prompt"
              values={o.prompts.map((p) => ({ label: p.name.replace("-", " "), value: p.injection.followed }))}
              max={Math.max(1, o.injection.n)}
              barClass="bg-danger/70"
            />
          }
          href={casesHref({ run: runId, slice: "injection" })}
        />
        <Incident
          badge="Result"
          badgeTone="neutral"
          status={o.verdict.anyShown ? "Significant" : "Not significant"}
          statusTone={o.verdict.anyShown ? "success" : "neutral"}
          title={o.verdict.anyShown ? "One prompt wins" : "No prompt wins clearly"}
          sub={c ? `${c.b} vs ${c.a}` : undefined}
          stats={[
            ["Largest gap", c ? `${c.accuracy_diff.point >= 0 ? "+" : "−"}${Math.abs(c.accuracy_diff.point * 100).toFixed(1)} pts` : "—"],
            ["After Holm", c ? `p ${c.p_holm.toFixed(3)}` : "—"],
            ["Detectable", detectable !== null ? `≈${Math.round(detectable * 100)} pts` : "—"],
          ]}
          chart={
            c && (
              <SplitBar
                a={c.counts.a_only}
                b={c.counts.b_only}
                aLabel={`only ${c.a}`}
                bLabel={`only ${c.b}`}
                aClass={variantMeta(c.a).bar}
                bClass={variantMeta(c.b).bar}
              />
            )
          }
          href={casesHref({ run: runId, disagree: true })}
        />
        <Incident
          badge="Labels"
          badgeTone="brand"
          status="Open question"
          statusTone="brand"
          title="Tickets every prompt gets wrong"
          sub={w.topGold && w.topAnswer ? `mostly ${w.topGold.label}, answered ${w.topAnswer.label}` : undefined}
          stats={[
            ["Always wrong", String(w.count)],
            ["Top gold label", w.topGold ? `${w.topGold.label} (${w.topGold.count})` : "—"],
          ]}
          href={casesHref({ run: runId, allwrong: true })}
        />
      </ul>
    </section>
  );
}
