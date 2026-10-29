import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PromptFlight",
  description: "A test bench for support-ticket classification prompts.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
