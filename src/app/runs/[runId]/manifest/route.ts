import type { NextRequest } from "next/server";
import { RunNotFoundError } from "@/core/artifacts/runs";
import { getRun } from "@/app/data";

/** The run manifest as a download. An unknown or unsafe run id is a 404. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/runs/[runId]/manifest">) {
  const { runId } = await ctx.params;
  try {
    const { manifest } = getRun(runId);
    return new Response(JSON.stringify(manifest, null, 2) + "\n", {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${runId}-manifest.json"`,
      },
    });
  } catch (e) {
    if (e instanceof RunNotFoundError) return new Response("run not found\n", { status: 404 });
    throw e;
  }
}
