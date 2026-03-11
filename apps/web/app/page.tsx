import styles from "./page.module.css";

const quickStart = [
  "context9",
  "context9 init",
  "context9 switch feature/auth --lock",
  "context9 push",
  "context9 pull",
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
            CLI-first runtime context for parallel worktrees.
          </h1>
          <p className={styles.subtitle}>
            Sign in from the terminal, open a browser with a device code, then
            switch branches with the right `.env`, secret files, and branch-scoped
            values already in place.
          </p>

          <div className={styles.pills}>
            <span className={styles.pill}>Device login</span>
            <span className={styles.pill}>Branch-scoped secrets</span>
            <span className={styles.pill}>CLI only</span>
          </div>
        </div>

        <div className={styles.terminalCard}>
          <div className={styles.terminalChrome}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.terminalBody}>
            {quickStart.map((command) => (
              <div key={command} className={styles.commandRow}>
                <span className={styles.prompt}>%</span>
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
    </main>
  );
}
