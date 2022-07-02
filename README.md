# deno_cliwrap

Convenient wrapper for launching CLI applications in Deno.

# Usage

In the following examples, we'll use `deno` executable as it's safe to assume you're familiar with it and you have it already installed.

### Detect deno executable version

We'll call `deno -V` and capture standard output.

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
      stdout += data.text;
      if (data.eol) {
        stdout += "\r\n";
      }
    })
  )
  .execute();

await cmd.waitForExit();
console.log(stdout); // deno 1.23.2
```

### Evaluate any code in Deno runtime

We'll call `deno run -`, where '-' means that script will be read from stdin.

```ts
import {
  Cli,
  createPipeSourceFromString,
  createPipeTargetToDelegate,
} from "https://deno.land/x/cliwrap/mod.ts";

const fnText = `console.log('Hello World'.replace('o', ''));`;

let stdout = "";
const cmd = Cli.wrap("deno")
  .withArguments(["run", "-"])
  .withStandardInputPipe(createPipeSourceFromString(fnText))
  .withStandardOutputPipe(
    createPipeTargetToDelegate((data) => {
      stdout += data.text;
      if (data.eol) {
        stdout += "\r\n";
      }
    })
  )
  .execute();

const cmdResult = await cmd.waitForExit();

console.log(cmdResult.code); // 0 - success
console.log(stdout); // "Hell World"
```

### Capture stderr

We'll call `deno run` but with a script that contains syntax error. Our goal is to capture error message.

```ts
import {
  Cli,
  CommandResultValidation,
  createPipeSourceFromString,
  createPipeTargetToDelegate,
} from "https://deno.land/x/cliwrap/mod.ts";

const fnText = `console.log('Hello World'.eplace('o', ''));`;

let stderr = "";
const cmd = Cli.wrap("deno")
  .withArguments(["run", "-"])
  .withStandardInputPipe(createPipeSourceFromString(fnText))
  .withStandardErrorPipe(
    createPipeTargetToDelegate((data) => {
      stderr += data.text;
      if (data.eol) {
        stderr += "\r\n";
      }
    })
  )
  .withValidation(CommandResultValidation.None) // Required to prevent throwing Error
  .execute();

const cmdResult = await cmd.waitForExit();

console.log(cmdResult.code); // 1 - error
console.log(stderr); // error: Uncaught TypeError: "Hello World".eplace is not a function
```
