import {
  assertEquals,
  Cli,
  createPipeTargetToDelegate,
  CommandResultValidation,
} from "./cliwrap_test_deps.ts";
import { createPipeSourceFromString } from "./pipe_sources.ts";

Deno.test("Basic stdout/stderr tests", async () => {
  let stdout = "";
  let stderr = "";
  const cmd = Cli.wrap("deno")
    .withArguments(["-V"])
    .withStandardOutputPipe(
      createPipeTargetToDelegate((data) => {
        stdout += data.text;
        if (data.eol) {
          stdout += "\r\n";
        }
      })
    )
    .withStandardErrorPipe(
      createPipeTargetToDelegate((data) => {
        stderr += data.text;
        if (data.eol) {
          stderr += "\r\n";
        }
      })
    )
    .execute();

  const cmdResult = await cmd.waitForExit();

  assertEquals(0, cmdResult.code);
  assertEquals(true, cmdResult.success);
  assertEquals(true, /^deno \d+\.\d+\.\d+$/.test(stdout.trimEnd()));
  assertEquals("", stderr);
});

Deno.test("Stdin test", async () => {
  const fnText = `console.log('Hello World'.replace('o', ''));`;

  let stdout = "";
  let stderr = "";
  const cmd = Cli.wrap("deno")
    .withArguments(["run", "-"])
    .withStandardOutputPipe(
      createPipeTargetToDelegate((data) => {
        stdout += data.text;
        if (data.eol) {
          stdout += "\r\n";
        }
      })
    )
    .withStandardErrorPipe(
      createPipeTargetToDelegate((data) => {
        stderr += data.text;
        if (data.eol) {
          stderr += "\r\n";
        }
      })
    )
    .withValidation(CommandResultValidation.None)
    .withStandardInputPipe(createPipeSourceFromString(fnText))
    .execute();

  const cmdResult = await cmd.waitForExit();
  assertEquals(0, cmdResult.code);
  assertEquals(true, cmdResult.success);
  assertEquals("Hell World", stdout.trimEnd());
  assertEquals("", stderr.trimEnd());
});

Deno.test("Failing command with validation disabled", async () => {
  const fnText = `console.log(''Hello World');`; // Code with intentional syntax error.

  let stdout = "";
  let stderr = "";
  const cmd = Cli.wrap("deno")
    .withArguments(["run", "-"])
    .withStandardOutputPipe(
      createPipeTargetToDelegate((data) => {
        stdout += data.text;
        if (data.eol) {
          stdout += "\r\n";
        }
      })
    )
    .withStandardErrorPipe(
      createPipeTargetToDelegate((data) => {
        stderr += data.text;
        if (data.eol) {
          stderr += "\r\n";
        }
      })
    )
    .withValidation(CommandResultValidation.None)
    .withStandardInputPipe(createPipeSourceFromString(fnText))
    .execute();

  const cmdResult = await cmd.waitForExit();
  assertEquals(1, cmdResult.code);
  assertEquals(false, cmdResult.success);
  assertEquals("", stdout);
  assertEquals(
    true,
    stderr.indexOf("The module's source code could not be parsed") !== -1
  );
});

Deno.test("Failing command with default validation mode", async () => {
  const fnText = `console.log(''Hello World');`; // Code with intentional syntax error.

  let stdout = "";
  let stderr = "";
  const cmd = Cli.wrap("deno")
    .withArguments(["run", "-"])
    .withStandardOutputPipe(
      createPipeTargetToDelegate((data) => {
        stdout += data.text;
        if (data.eol) {
          stdout += "\r\n";
        }
      })
    )
    .withStandardErrorPipe(
      createPipeTargetToDelegate((data) => {
        stderr += data.text;
        if (data.eol) {
          stderr += "\r\n";
        }
      })
    )
    .withStandardInputPipe(createPipeSourceFromString(fnText))
    .execute();

  let errorThrown = false;
  try {
    await cmd.waitForExit();
  } catch {
    errorThrown = true;
  }

  assertEquals("", stdout);
  assertEquals(true, errorThrown);
  assertEquals(
    true,
    stderr.indexOf("The module's source code could not be parsed") !== -1
  );
});
