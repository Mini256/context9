import os from "node:os";
import path from "node:path";

export function getProjectConfigPath(cwd: string): string {
  return path.join(cwd, "context9.toml");
}

export function getContext9Home(): string {
  return process.env.CONTEXT9_HOME ?? path.join(os.homedir(), ".config", "context9");
}

export function getCredentialsPath(): string {
  return path.join(getContext9Home(), "credentials.toml");
}

export function getStatePath(): string {
  return path.join(getContext9Home(), "state");
}
