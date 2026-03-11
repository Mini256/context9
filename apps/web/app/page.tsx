import styles from "./page.module.css";

const navLinks = [
  { href: "#what-it-does", label: "What it does" },
  { href: "#commands", label: "Commands" },
  { href: "#scopes", label: "Scopes" },
];

const installCards = [
  {
    title: "CLI",
    command: "$ curl -fsSL https://context9.vercel.app/install | sh",
    detail: "macOS / Linux (x86_64, arm64)",
  },
  {
    title: "AI Agents",
    command: "Read https://context9.vercel.app/skill.md and follow instructions",
    detail: "Your agent learns to install, auth, switch context, and restore files autonomously",
  },
];

const stackItems = [
  "git worktree",
  ".env",
  "private keys",
  "webhooks",
  "GitHub Apps",
  "Next.js",
  "Docker Compose",
  "local tunnels",
];

const commandCards = [
  {
    label: "Device login",
    title: "Start from the terminal. Approve once in the browser.",
    detail:
      "Run context9 directly. If you are not signed in, it opens the device flow and keeps the login state local to your machine.",
    lines: [
      "$ context9",
      "Opening browser for device login...",
      "Approve at /login/device?code=ABCD-EFGH",
      "Signed in with GitHub",
    ],
    tags: ["CLI-first", "GitHub by default"],
  },
  {
    label: "Switch and lock",
    title: "Bind one branch to one runtime slice.",
    detail:
      "A worktree gets the branch-specific runtime it actually needs, while the lock prevents two agents from grabbing the same active context.",
    lines: [
      "$ context9 switch feature/auth --lock",
      "Locked context feature/auth",
      "Leased GitHub app slot A",
      "Runtime ready",
    ],
    tags: ["context lock", "branch-scoped values"],
  },
  {
    label: "Hydrate files",
    title: "Restore what git does not track.",
    detail:
      "Pull `.env`, private keys, and other local-only files into the current worktree without copying them by hand.",
    lines: [
      "$ context9 pull",
      "Wrote .env",
      "Wrote config/github-app.private-key.pem",
      "Synced 2 context files",
    ],
    tags: [".env", "secret files"],
  },
  {
    label: "Rotate leases",
    title: "Reuse a limited pool across many agents.",
    detail:
      "Not every branch needs its own full stack. context9 lets agents take turns using a finite set of app credentials, endpoints, and runtime bindings.",
    lines: [
      "$ context9 switch feature/webhook --lock",
      "Leased public endpoint 03",
      "Attached app credentials",
      "Hydrated branch runtime",
    ],
    tags: ["finite resources", "parallel worktrees"],
  },
];

const scopeCards = [
  {
    title: "Shared values",
    detail:
      "Reusable config that can safely appear in many branches, such as common service endpoints or team-wide development settings.",
    items: ["shared service URLs", "common prompts", "team-wide config"],
  },
  {
    title: "Context-scoped values",
    detail:
      "Files and variables that should follow one active branch or isolated runtime, including locks, branch bindings, and agent-specific runtime state.",
    items: ["branch runtime files", "private key material", "leased app bindings"],
  },
];

const meshLines = [
  { x1: 4, y1: 10, x2: 24, y2: 42 },
  { x1: 24, y1: 42, x2: 45, y2: 18 },
  { x1: 45, y1: 18, x2: 66, y2: 38 },
  { x1: 66, y1: 38, x2: 92, y2: 16 },
  { x1: 18, y1: 72, x2: 37, y2: 48 },
  { x1: 37, y1: 48, x2: 54, y2: 76 },
  { x1: 54, y1: 76, x2: 79, y2: 52 },
  { x1: 79, y1: 52, x2: 96, y2: 86 },
  { x1: 12, y1: 28, x2: 36, y2: 84 },
  { x1: 58, y1: 6, x2: 72, y2: 62 },
  { x1: 72, y1: 62, x2: 88, y2: 28 },
  { x1: 30, y1: 22, x2: 74, y2: 24 },
];

const meshNodes = [
  { cx: 4, cy: 10, r: 1.2 },
  { cx: 24, cy: 42, r: 1.4 },
  { cx: 45, cy: 18, r: 1.7 },
  { cx: 66, cy: 38, r: 1.5 },
  { cx: 92, cy: 16, r: 1.4 },
  { cx: 18, cy: 72, r: 1.3 },
  { cx: 37, cy: 48, r: 1.6 },
  { cx: 54, cy: 76, r: 1.4 },
  { cx: 79, cy: 52, r: 1.5 },
  { cx: 96, cy: 86, r: 1.3 },
  { cx: 72, cy: 62, r: 1.7 },
];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.nav}>
        <a className={styles.brand} href="/">
          context9
        </a>
        <nav className={styles.navLinks} aria-label="Primary">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <a className={styles.navButton} href="#get-started">
          Get Started
        </a>
      </header>

      <section className={styles.hero}>
        <div className={styles.mesh} aria-hidden="true">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            {meshLines.map((line) => (
              <line
                key={`${line.x1}-${line.y1}-${line.x2}-${line.y2}`}
                className={styles.meshLine}
                {...line}
              />
            ))}
            {meshNodes.map((node) => (
              <circle
                key={`${node.cx}-${node.cy}`}
                className={styles.meshNode}
                {...node}
              />
            ))}
          </svg>
        </div>

        <div className={styles.heroCopy}>
          <p className={styles.kicker}>context9</p>
          <h1 className={styles.title}>
            Runtime context
            <br />
            for parallel agents_
          </h1>
          <p className={styles.subtitle}>
            Git worktree separates code. context9 restores the rest:
            branch-specific `.env`, private keys, locks, and agent-owned runtime
            bindings inside the worktree where you are actually running the CLI.
          </p>
        </div>

        <section className={styles.installGrid} id="get-started">
          {installCards.map((card) => (
            <article key={card.title} className={styles.installCard}>
              <p className={styles.installTitle}>{card.title}</p>
              <div className={styles.installCommand}>
                <code>{card.command}</code>
              </div>
              <p className={styles.installDetail}>{card.detail}</p>
            </article>
          ))}
        </section>
      </section>

      <section className={styles.stackRail} id="what-it-does">
        <div className={styles.stackLead}>
          <span>context9 works with</span>
          <strong>the files and runtime pieces worktrees miss</strong>
        </div>
        <div className={styles.stackItems}>
          {stackItems.map((item) => (
            <span key={item} className={styles.stackItem}>
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className={styles.commandSection} id="commands">
        <div className={styles.sectionHeader}>
          <p className={styles.sectionKicker}>Everything your CLI needs</p>
          <h2 className={styles.sectionTitle}>
            Restore the runtime layer, not just the repo.
          </h2>
          <p className={styles.sectionText}>
            context9 is not another place to dump secrets. It gives a branch the
            right runtime slice at the moment an agent starts working.
          </p>
        </div>

        <div className={styles.commandGrid}>
          {commandCards.map((card) => (
            <article key={card.title} className={styles.commandCard}>
              <div className={styles.commandText}>
                <p className={styles.commandLabel}>{card.label}</p>
                <h3 className={styles.commandTitle}>{card.title}</h3>
                <p className={styles.commandDetail}>{card.detail}</p>
                <div className={styles.commandTags}>
                  {card.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>

              <div className={styles.terminalCard}>
                <p className={styles.terminalLabel}>terminal</p>
                <div className={styles.terminalBody}>
                  {card.lines.map((line) => (
                    <code key={line}>{line}</code>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.scopeSection} id="scopes">
        <div className={styles.sectionHeader}>
          <p className={styles.sectionKicker}>Two scopes, one CLI</p>
          <h2 className={styles.sectionTitle}>
            Keep shared config shared. Keep active runtime isolated.
          </h2>
        </div>

        <div className={styles.scopeGrid}>
          {scopeCards.map((card) => (
            <article key={card.title} className={styles.scopeCard}>
              <h3 className={styles.scopeTitle}>{card.title}</h3>
              <p className={styles.scopeDetail}>{card.detail}</p>
              <ul className={styles.scopeList}>
                {card.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.ctaSection}>
        <p className={styles.sectionKicker}>Start in seconds</p>
        <div className={styles.ctaCard}>
          <code>$ curl -fsSL https://context9.vercel.app/install | sh</code>
          <p>
            Or tell your agent:
            <span> Read https://context9.vercel.app/skill.md and follow instructions</span>
          </p>
        </div>
      </section>
    </main>
  );
}
