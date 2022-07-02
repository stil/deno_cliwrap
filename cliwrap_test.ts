import { assertEquals } from "https://deno.land/std@0.146.0/testing/asserts.ts";
import { Cli, createPipeTargetToDelegate } from "./cliwrap.ts";

// Compact form: name and function
Deno.test("Basic stdout/stderr tests", async () => {
  let stdout = "";
  let stderr = "";
  const cmd = Cli.wrap("deno")
    .withArguments(["-V"])
    .withStandardOutputPipe(
      createPipeTargetToDelegate((data) => {
        stdout += data.line;
        if (data.isFullLine) {
          stdout += "\r\n";
        }
      })
    )
    .withStandardErrorPipe(
      createPipeTargetToDelegate((data) => {
        stderr += data.line;
        if (data.isFullLine) {
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
