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
            "radial-gradient(circle at top left, rgba(125, 211, 252, 0.18), transparent 24%)",
            "radial-gradient(circle at top right, rgba(255, 255, 255, 0.12), transparent 18%)",
            "linear-gradient(145deg, #07111f, #0a1321 42%, #101826 72%, #152131)",
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
