import type { ReactNode } from "react";

export const metadata = {
  title: "Context9 API",
  description: "Next.js API gateway for context9 and db9.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          background: "linear-gradient(135deg, #0f172a, #111827 45%, #1f2937)",
          color: "#e5e7eb",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
