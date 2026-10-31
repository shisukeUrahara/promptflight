import { VariantName } from "../Variant";

const node = "rounded-2xl border border-line bg-surface-2/70 px-4 py-3 text-center";
/** A connector: horizontal on wide screens, vertical on phones. */
const Link = () => (
  <span aria-hidden className="mx-auto block h-6 w-px bg-gradient-to-b from-brand/10 via-brand/60 to-brand/10 lg:mx-0 lg:h-px lg:w-10 lg:flex-none lg:bg-gradient-to-r" />
);

/** How a run works, as a small pipeline. Counts and names come from the data. */
export function FlowDiagram({ tickets, prompts, model }: { tickets: number; prompts: string[]; model: string }) {
  return (
    <section aria-labelledby="how-title" className="fade-up">
      <h2 id="how-title" className="mb-4 font-display text-xl font-semibold tracking-tight">
        How it works
      </h2>
      <div className="relative overflow-hidden rounded-3xl border border-line bg-surface/85 p-6 shadow-card backdrop-blur-xl md:p-8">
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_70%_at_50%_0%,var(--glow-violet),transparent)]" />
        <ol className="relative flex flex-col items-stretch lg:flex-row lg:items-center lg:justify-between">
          <li className={node}>
            <span className="block font-medium">{tickets} tickets</span>
            <span className="text-xs text-muted">labeled blind</span>
          </li>
          <Link />
          <li>
            <span className="sr-only">{prompts.length} prompts: </span>
            <ul className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {prompts.map((p) => (
                <li key={p} className="rounded-full border border-line bg-surface-2/70 px-3 py-1.5 text-xs">
                  <VariantName name={p} />
                </li>
              ))}
            </ul>
          </li>
          <Link />
          <li className={`${node} font-mono text-sm`}>{model}</li>
          <Link />
          <li className={node}>
            <span className="block font-medium">Checker</span>
            <span className="text-xs text-muted">schema + label</span>
          </li>
          <Link />
          <li className={`${node} border-success/50 bg-success-bg font-medium text-success`}>Scores</li>
        </ol>
        <p className="relative mt-6 text-sm text-muted">
          Every ticket goes through all {prompts.length} prompts. The checker grades each answer against the label a person wrote without seeing the
          intended one. Every number links back to its tickets.
        </p>
      </div>
    </section>
  );
}
