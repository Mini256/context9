import styles from "./page.module.css";

const quickStart = [
  "context9",
  "Opening browser for device login...",
  "Connected as you@github",
  "context9 switch feature/auth --lock",
  "✔ Context 'feature/auth' locked",
];

const commandGroups = [
  {
    title: "Login",
    detail: "First run opens the browser with a device code.",
    commands: ["context9", "context9 auth login"],
  },
  {
    title: "Context",
    detail: "Create, switch, and lock a branch runtime.",
    commands: ["context9 create <branch>", "context9 switch <context> --lock"],
  },
  {
    title: "Sync",
    detail: "Push local secrets up and pull them back into a worktree.",
    commands: ["context9 push", "context9 pull", "context9 manifest"],
  },
];

export default function HomePage() {
  return (
    <main className={styles.page}>
      <div className={styles.haloLeft} />
      <div className={styles.haloRight} />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>context9</p>
          <h1 className={styles.title}>
            Branch-scoped runtime context for your CLI.
          </h1>
          <p className={styles.subtitle}>
            Start from the terminal, sign in with a device code, then switch
            worktrees with the right `.env`, secret files, and branch-scoped
            values already materialized.
          </p>

          <div className={styles.pills}>
            <span className={styles.pill}>Device login</span>
            <span className={styles.pill}>Zero-copy sync</span>
            <span className={styles.pill}>No dashboard required</span>
          </div>
        </div>

        <div className={styles.terminalCard}>
          <div className={styles.terminalChrome}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.terminalBody}>
            {quickStart.map((command, index) => (
              <div key={command} className={styles.commandRow}>
                <span className={styles.prompt}>
                  {index === 1 ? "…" : index === 2 || index === 4 ? "✓" : "%"}
                </span>
                <code>{command}</code>
              </div>
            ))}
          </div>
          <p className={styles.terminalHint}>
            First run opens <code>/login/device?code=XXXX</code> in your browser.
          </p>
        </div>
      </section>

      <section className={styles.grid}>
        {commandGroups.map((group) => (
          <article key={group.title} className={styles.glassCard}>
            <div className={styles.cardTop}>
              <p className={styles.cardTitle}>{group.title}</p>
              <p className={styles.cardDetail}>{group.detail}</p>
            </div>
            <div className={styles.cardCommands}>
              {group.commands.map((command) => (
                <code key={command} className={styles.inlineCommand}>
                  {command}
                </code>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className={styles.footerCard}>
        <p className={styles.footerLabel}>Start here</p>
        <code className={styles.footerCommand}>context9</code>
        <p className={styles.footerText}>
          Use the default hosted backend at <code>https://context9.vercel.app</code>,
          finish device login in your browser, then keep working from the CLI.
        </p>
      </section>
    </main>
  );
}
