import type { ReactNode } from "react";

export const metadata = {
  title: "context9",
  description: "CLI-first runtime context for parallel worktrees.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          background: [
            "radial-gradient(circle at top center, rgba(255, 255, 255, 0.08), transparent 24%)",
            "radial-gradient(circle at 20% 18%, rgba(56, 189, 248, 0.08), transparent 22%)",
            "linear-gradient(180deg, #020406, #04070c 52%, #05090f)",
          ].join(", "),
          color: "#e2e8f0",
          minHeight: "100vh",
          backgroundAttachment: "fixed",
        }}
      >
        {children}
      </body>
    </html>
  );
}
