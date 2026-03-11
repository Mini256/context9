export type TrackedFileKind = "dotenv" | "secret_file";

export interface KeyRule {
  name: string;
  branch_scoped?: boolean;
  description?: string;
  provider?: string;
  reference?: string;
  acquire_prompt?: string;
}

export interface TrackedFileConfig {
  path: string;
  kind: TrackedFileKind;
  branch_scoped?: boolean;
  description?: string;
  provider?: string;
  reference?: string;
  acquire_prompt?: string;
  keys?: KeyRule[];
}

export interface Context9Config {
  version: number;
  project_id: string;
  project_name: string;
  current_context_name?: string;
  remote_database_name: string;
  default_branch: string;
  files: TrackedFileConfig[];
}

export interface Context9Credentials {
  token?: string;
  master_key?: string;
  api_url?: string;
  machine_id?: string;
  last_login_at?: string;
}

export interface MachineIdentity {
  machineId: string;
  hostname: string;
  username: string;
}

export interface RemoteContextRecord {
  context_id: string;
  name: string;
  branch_name: string;
  lock_machine_id: string | null;
  lock_owner: string | null;
  lock_worktree: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RemoteTreeRow {
  path: string;
  kind: TrackedFileKind;
  branch_scoped: boolean;
  shared_entries: number;
  context_entries: number;
  context_count: number;
}

export interface DecryptedEntry {
  filePath: string;
  entryName: string;
  scope: string;
  value: string;
  contentEncoding: string;
}

export interface MaterializedFile {
  path: string;
  kind: TrackedFileKind;
  content: string | Buffer;
}
