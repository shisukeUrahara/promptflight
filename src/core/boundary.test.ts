import { ESLint } from "eslint";
import { expect, test } from "vitest";

async function rules(code: string, filePath: string) {
  const [result] = await new ESLint().lintText(code, { filePath });
  return result.messages.map((m) => m.ruleId);
}

test.each(['import React from "react";', 'import { x } from "next/server";', 'import { Nav } from "@/components/Nav";'])(
  "core rejects %s",
  async (code) => {
    expect(await rules(code + "\nexport {};\n", "src/core/x.ts")).toContain("no-restricted-imports");
  },
);

test("core allows plain imports", async () => {
  expect(await rules('import { z } from "node:path";\nexport const p = z;\n', "src/core/x.ts")).not.toContain(
    "no-restricted-imports",
  );
});

test("app may import react", async () => {
  expect(await rules('import React from "react";\nexport default React;\n', "src/app/x.tsx")).not.toContain(
    "no-restricted-imports",
  );
});
