import type { Metadata } from "next";
import { Empty } from "@/components/StateViews";

export const metadata: Metadata = { title: "Prompts" };

export default function Page() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold md:text-3xl">Prompts</h1>
        <p className="mt-1 text-muted">Immutable prompt versions.</p>
      </header>
      <Empty title="No prompts yet" hint="Run: pnpm tsx scripts/write-variant-prompts.ts" />
    </div>
  );
}
