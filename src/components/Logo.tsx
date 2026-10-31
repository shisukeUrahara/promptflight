import { Send } from "lucide-react";

export function Logo() {
  return (
    <span aria-hidden className="grid size-8 place-items-center rounded-xl bg-primary text-primary-ink shadow-[0_0_24px_var(--glow-violet)]">
      <Send className="size-4 -rotate-12" />
    </span>
  );
}
