import type { ReactNode } from "react";

export function Hero({ prompts, tickets, chips }: { prompts: number; tickets: number; chips: ReactNode }) {
  return (
    <section aria-labelledby="hero-title" className="fade-up flex flex-col items-center gap-6 pt-6 text-center md:pt-12">
      <span className="micro rounded-full border border-line bg-surface/70 px-3 py-1">Prompt test bench</span>
      <h1 id="hero-title" className="display max-w-4xl text-[2.6rem] sm:text-6xl md:text-7xl">
        Which prompt sorts
        <br />
        support tickets best?
      </h1>
      <p className="max-w-xl text-lg text-muted">
        {prompts} prompts. {tickets} frozen tickets. Graded against blind human labels.
      </p>
      {chips}
    </section>
  );
}
