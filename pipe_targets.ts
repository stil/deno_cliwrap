import { PipeTarget } from "./cliwrap.ts";
import { colors, ioUtil } from "./deps.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

function consoleWriteLine(message: string) {
  console.log(message);
}

function consoleWrite(message: string) {
  ioUtil.writeAllSync(Deno.stdout, textEncoder.encode(message));
}
