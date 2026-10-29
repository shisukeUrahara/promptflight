/** Everything a command touches outside its own arguments. Tests pass fakes. */
export interface Deps {
  /** Folder that holds fixtures/ prompts/ cache/ experiments/. */
  dataDir: string;
  out(line: string): void;
  err(line: string): void;
}
