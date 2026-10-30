import type { Metadata } from "next";
import { Empty } from "@/components/StateViews";

export const metadata: Metadata = { title: "Experiments" };

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold md:text-3xl">Experiments</h1>
        <p className="mt-1 text-muted">Which prompt won, by how much, and on which tickets.</p>
      </header>
      <Empty title="No runs yet" hint="Run: pnpm pf run --split tuning" />
    </div>
  );
}
