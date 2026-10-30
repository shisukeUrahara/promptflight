export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="rounded-lg border border-line bg-surface p-6 text-sm text-muted">
      {label}…
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line p-8 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: { code: string; message: string }; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-danger/30 bg-danger-bg p-4 text-sm">
      <p className="font-medium text-danger">{error.code}</p>
      <p className="mt-1">{error.message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 rounded-md border border-danger/40 px-3 py-1">
          Retry
        </button>
      )}
    </div>
  );
}
