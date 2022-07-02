import { PipeTarget } from "./cliwrap.ts";
import { colors, ioUtil } from "./deps.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

interface IncomingTextChunk {
  text: string;

  /** Whether the text is terminated with EOL sequence. */
  eol: boolean;
}

export function createPipeTargetToDelegate(
  func: (props: IncomingTextChunk) => void
): PipeTarget {
  return {
    setReader: () => {},
    copyFrom: async (reader) => {
      let partial: number[] = [];

      const flush = (eol: boolean) => {
        if (partial.length > 0) {
          let text = textDecoder.decode(new Uint8Array(partial));
          if (eol) {
            text = text.slice(0, -2);
          }
          func({ text, eol });
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
    text: string;
    eol: boolean;
    pipe: "stdout" | "stderr";
  }) => void
) {
  let previousPartial = false;

  const pipe = (pipe: "stdout" | "stderr") => {
    return createPipeTargetToDelegate(({ text, eol }) => {
      const prefix = previousPartial
        ? ""
        : pipe === "stdout"
        ? colors.green(cmdPrefix + "> ")
        : colors.yellow(cmdPrefix + "# ");

      if (eol) consoleWriteLine(prefix + text);
      else consoleWrite(prefix + text);
      previousPartial = !eol;

      if (handleLine) {
        handleLine({ text, eol, pipe });
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
