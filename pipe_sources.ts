import { PipeSource } from "./cliwrap.ts";

const textEncoder = new TextEncoder();

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
