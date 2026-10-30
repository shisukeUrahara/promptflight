import type { RepoState } from "./git";

export class DirtyTreeError extends Error {
  constructor() {
    super("The working tree has uncommitted changes. Commit them first, or pass --allow-dirty (the manifest will say so).");
    this.name = "DirtyTreeError";
  }
}

export class PreregistrationError extends Error {
  constructor() {
    super("docs/preregistration.md is not committed. Write it and commit it before the holdout run. --allow-dirty does not waive this.");
    this.name = "PreregistrationError";
  }
}

/**
 * A holdout run is the one that gets published, so it must come from committed code
 * and a committed pre-registration. Other splits are not checked.
 */
export function guardRun(split: string, state: RepoState, allowDirty: boolean): void {
  if (split !== "holdout") return;
  if (state.preregistration_sha === null) throw new PreregistrationError();
  if (state.git_dirty && !allowDirty) throw new DirtyTreeError();
}
