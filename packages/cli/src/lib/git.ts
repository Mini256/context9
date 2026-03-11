import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function runGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
  });

  return stdout.trim();
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await runGit(["rev-parse", "--show-toplevel"], cwd);
    return true;
  } catch {
    return false;
  }
}

export async function getGitRoot(cwd: string): Promise<string | null> {
  try {
    return await runGit(["rev-parse", "--show-toplevel"], cwd);
  } catch {
    return null;
  }
}

export async function ensureGitRepository(cwd: string, defaultBranch: string): Promise<void> {
  if (!(await isGitRepo(cwd))) {
    await runGit(["init", "-b", defaultBranch], cwd);
    return;
  }

  const current = await getCurrentBranch(cwd);

  if (!current) {
    await runGit(["checkout", "-b", defaultBranch], cwd);
  }
}

export async function getCurrentBranch(cwd: string): Promise<string | null> {
  try {
    const output = await runGit(["branch", "--show-current"], cwd);
    return output || null;
  } catch {
    return null;
  }
}

export async function hasCommits(cwd: string): Promise<boolean> {
  try {
    await runGit(["rev-parse", "--verify", "HEAD"], cwd);
    return true;
  } catch {
    return false;
  }
}

export async function branchExists(cwd: string, branchName: string): Promise<boolean> {
  try {
    await runGit(["show-ref", "--verify", `refs/heads/${branchName}`], cwd);
    return true;
  } catch {
    return false;
  }
}

export async function createBranch(cwd: string, branchName: string, startPoint: string): Promise<void> {
  if (await branchExists(cwd, branchName)) {
    throw new Error(`Git branch "${branchName}" already exists`);
  }

  if (!(await hasCommits(cwd))) {
    await runGit(["checkout", "--orphan", branchName], cwd);
    return;
  }

  await runGit(["branch", branchName, startPoint], cwd);
}

export async function checkoutBranch(
  cwd: string,
  branchName: string,
  options?: { create?: boolean; startPoint?: string },
): Promise<void> {
  const exists = await branchExists(cwd, branchName);

  if (!exists && options?.create) {
    if (!(await hasCommits(cwd))) {
      await runGit(["checkout", "--orphan", branchName], cwd);
      return;
    }

    const startPoint = options.startPoint ?? "HEAD";
    await runGit(["checkout", "-b", branchName, startPoint], cwd);
    return;
  }

  if (!exists) {
    throw new Error(`Git branch "${branchName}" does not exist`);
  }

  await runGit(["checkout", branchName], cwd);
}

export async function ensureBranch(cwd: string, branchName: string, startPoint: string): Promise<void> {
  if (!(await branchExists(cwd, branchName))) {
    await createBranch(cwd, branchName, startPoint);
  }
}
