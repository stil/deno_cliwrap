export class Cli {
  private targetFilePath: string;
  private arguments?: string[];
  private cwd?: string;
  private stdoutPipe?: PipeTarget;
  private stderrPipe?: PipeTarget;
  private stdinPipe?: PipeSource;
  private env?: Record<string, string>;

  private constructor(targetFilePath: string) {
    this.targetFilePath = targetFilePath;
  }

  static wrap(targetFilePath: string) {
    return new Cli(targetFilePath);
  }

  public withArguments(args: string[]) {
    this.arguments = args;
    return this;
  }

  public withWorkingDirectory(cwd: string | undefined) {
    this.cwd = cwd;
    return this;
  }

  public withStandardOutputPipe(pipe: PipeTarget) {
    this.stdoutPipe = pipe;
    return this;
  }

  public withStandardErrorPipe(pipe: PipeTarget) {
    this.stderrPipe = pipe;
    return this;
  }

  public withStandardInputPipe(pipe: PipeSource) {
    this.stdinPipe = pipe;
    return this;
  }

  public withEnvironmentVariables(env: Record<string, string>) {
    this.env = env;
    return this;
  }

  public execute(): CliCommand {
    const proc = Deno.run({
      cmd: [this.targetFilePath, ...(this.arguments ?? [])],
      cwd: this.cwd,
      env: this.env,
      stdout: this.stdoutPipe ? "piped" : "inherit",
      stderr: this.stderrPipe ? "piped" : "inherit",
      stdin: this.stdinPipe ? "piped" : "inherit",
    });

    const tasks: Promise<void>[] = [];

    if (proc.stdout && this.stdoutPipe) {
      this.stdoutPipe.setReader(proc.stdout);
      tasks.push(this.stdoutPipe.copyFrom(proc.stdout));
    }

    if (proc.stderr && this.stderrPipe) {
      this.stderrPipe.setReader(proc.stderr);
      tasks.push(this.stderrPipe.copyFrom(proc.stderr));
    }

    if (proc.stdin && this.stdinPipe) {
      this.stdinPipe.setWriter(proc.stdin);
      tasks.push(this.stdinPipe.copyTo(proc.stdin));
    }

    return {
      waitForExit: async () => {
        await Promise.all(tasks);
        const status = await proc.status();
        if (status.code !== 0) {
          throw new Error("Command failed.");
        }

        proc.stdout?.close();
        proc.stderr?.close();
        proc.close();
        return status;
      },
    };
  }
}

interface CliCommand {
  waitForExit: () => Promise<Deno.ProcessStatus>;
}

export interface PipeTarget {
  setReader: (reader: Deno.Reader & Deno.Closer) => void;
  copyFrom: (reader: Deno.Reader & Deno.Closer) => Promise<void>;
}

export interface PipeSource {
  setWriter: (writer: Deno.Writer & Deno.Closer) => void;
  copyTo: (writer: Deno.Writer & Deno.Closer) => Promise<void>;
}
