import type { Metadata } from "next";
import { Empty } from "@/components/StateViews";

export const metadata: Metadata = { title: "Cases" };

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold md:text-3xl">Cases</h1>
        <p className="mt-1 text-muted">Every ticket, every variant, with the raw model output.</p>
      </header>
      <Empty title="No cases yet" hint="Label the tickets, then run: pnpm pf apply-review" />
    </div>
  );
}
