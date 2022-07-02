# deno_cliwrap

Convenient wrapper for launching CLI applications in Deno.

# Usage example

Check deno executable version:

```ts
import {
  Cli,
  createPipeTargetToDelegate,
} from "https://deno.land/x/cliwrap/mod.ts";

let stdout = "";
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
  .execute();

await cmd.waitForExit();
console.log(stdout); // deno 1.23.2
```
