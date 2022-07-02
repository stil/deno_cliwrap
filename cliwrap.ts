import { colors, ioUtil } from "./deps.ts";

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

interface PipeTarget {
  setReader: (reader: Deno.Reader & Deno.Closer) => void;
  copyFrom: (reader: Deno.Reader & Deno.Closer) => Promise<void>;
}

interface PipeSource {
  setWriter: (writer: Deno.Writer & Deno.Closer) => void;
  copyTo: (writer: Deno.Writer & Deno.Closer) => Promise<void>;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

interface PipeTargetDriver {
  readLine(): Promise<string | null>;
  readRegex(regex: RegExp): Promise<string | null>;
}

export function createPipeTargetToDelegate(
  func: (props: { line: string; isFullLine: boolean }) => void
): PipeTarget {
  return {
    setReader: () => {},
    copyFrom: async (reader) => {
      let partial: number[] = [];

      const flush = (isFullLine: boolean) => {
        if (partial.length > 0) {
          let line = textDecoder.decode(new Uint8Array(partial));
          if (isFullLine) {
            line = line.slice(0, -2);
          }
          func({ line, isFullLine });
          partial = [];
        }
      };

      const buffer = new Uint8Array(1024);
      while (true) {
        const bytesRead = await reader.read(buffer);
        if (bytesRead === null) {
          break;
        }
        //console.log({ bytesRead });

        for (let i = 0; i < bytesRead; i++) {
          const char = buffer[i];
          partial.push(char);
          if (
            partial.length >= 2 &&
            partial[partial.length - 2] === 13 &&
            partial[partial.length - 1] === 10
          ) {
            flush(true);
          }
        }

        flush(false);
      }
    },
  };
}

export function createPipeSourceFromString(value: string): PipeSource {
  return {
    setWriter: () => {},
    copyTo: async (writer) => {
      const lines = value.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        await writer.write(textEncoder.encode(line));
      }
      writer.close();
    },
  };
}

interface LivePipeSource extends PipeSource {
  write(line: string): Promise<void>;
  close(): void;
}

export function createLivePipeSource(): LivePipeSource {
  let writerSaved: Deno.Writer & Deno.Closer;

  return {
    setWriter: (writer) => {
      writerSaved = writer;
    },
    copyTo: async () => {},
    write: async (line: string) => {
      await writerSaved.write(textEncoder.encode(line));
    },
    close: () => {
      writerSaved.close();
    },
  };
}

export function sleep(timeout: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

function consoleWriteLine(message: string) {
  console.log(message);
}

function consoleWrite(message: string) {
  ioUtil.writeAllSync(Deno.stdout, textEncoder.encode(message));
}

export function createRedirectedPipes(
  cmdPrefix: string,
  handleLine?: (props: {
    line: string;
    isFullLine: boolean;
    pipe: "stdout" | "stderr";
  }) => void
) {
  let previousPartial = false;

  const pipe = (pipe: "stdout" | "stderr") => {
    return createPipeTargetToDelegate(({ line, isFullLine }) => {
      const prefix = previousPartial
        ? ""
        : pipe === "stdout"
        ? colors.green(cmdPrefix + "> ")
        : colors.yellow(cmdPrefix + "# ");

      if (isFullLine) consoleWriteLine(prefix + line);
      else consoleWrite(prefix + line);
      previousPartial = !isFullLine;

      if (handleLine) {
        handleLine({ line, isFullLine, pipe });
      }
    });
  };

  return {
    stdout: pipe("stdout"),
    stderr: pipe("stderr"),
  };
}
