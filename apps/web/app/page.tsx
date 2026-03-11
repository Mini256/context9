export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "96px 24px",
      }}
    >
      <p
        style={{
          textTransform: "uppercase",
          letterSpacing: "0.16em",
          fontSize: 12,
          color: "#93c5fd",
          marginBottom: 12,
        }}
      >
        Context9
      </p>
      <h1 style={{ fontSize: 48, lineHeight: 1.05, margin: "0 0 16px" }}>
        Next.js API gateway for Prisma-backed db9 context storage
      </h1>
      <p style={{ maxWidth: 680, fontSize: 18, lineHeight: 1.7, color: "#cbd5e1" }}>
        This app exposes server-side APIs for projects, contexts, and locks. db9 is
        only accessed from the Next.js server runtime through Prisma. It prefers
        `DATABASE_URL`, then `DB9_API_KEY`, and falls back to db9 anonymous
        bootstrap for local development.
      </p>
      <div
        style={{
          marginTop: 32,
          padding: 24,
          border: "1px solid rgba(148, 163, 184, 0.2)",
          borderRadius: 16,
          background: "rgba(15, 23, 42, 0.55)",
        }}
      >
        <code>GET /api/health</code>
        <br />
        <code>GET /api/auth/access</code>
        <br />
        <code>PUT /api/projects/:projectId</code>
        <br />
        <code>GET|POST /api/projects/:projectId/contexts</code>
        <br />
        <code>POST /api/projects/:projectId/contexts/:contextName/lock</code>
        <br />
        <code>GET|PUT /api/projects/:projectId/contexts/:contextName/secrets</code>
        <br />
        <code>GET /api/projects/:projectId/remote/tree</code>
        <br />
        <code>GET /api/projects/:projectId/remote/inspect</code>
      </div>
    </main>
  );
}
