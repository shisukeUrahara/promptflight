"use client";
import type { SelectHTMLAttributes } from "react";

/** A select that submits its GET form on change. The form still works without JavaScript via its button. */
export function AutoSubmitSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
