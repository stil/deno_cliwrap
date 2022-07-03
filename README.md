# deno_cliwrap

Convenient wrapper for launching CLI applications in Deno.

Module link: https://deno.land/x/cliwrap

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

### Advanced: talk to SSH server

In this example, we'll talk to SSH server via `plink.exe`.

```ts
import {
  Cli,
  CommandResultValidation,
  createLivePipeSource,
  createRedirectedPipes,
} from "https://deno.land/x/cliwrap/mod.ts";

const target = "comet@192.168.1.110";
const password = "secretpassword";

const stdin = createLivePipeSource();
let out = "";
let loggedIn = false;
const outPipes = createRedirectedPipes("server", ({ text, eol }) => {
  out += text;
  if (eol) {
    out += "\r\n";
  }

  if (
    !loggedIn &&
    out.endsWith(
      "Store key in cache? (y/n, Return cancels connection, i for more info) "
    )
  ) {
    stdin.write("n\n");
  }

  if (!loggedIn && out.endsWith(target + "'s password: ")) {
    loggedIn = true;
    stdin.write(password + "\r\n");
  }

  if (loggedIn && out.endsWith("~]$ ")) {
    stdin.write("exit\n");
  }
});

const cmd = Cli.wrap("plink")
  .withArguments([target])
  .withStandardInputPipe(stdin)
  .withStandardOutputPipe(outPipes.stdout)
  .withStandardErrorPipe(outPipes.stderr)
  .execute();

await cmd.waitForExit();

// Example output:
// ----
// server# The host key is not cached for this server:
// server#   192.168.1.110 (port 22)
// server# You have no guarantee that the server is the computer
// server# you think it is.
// server# The server's ssh-ed25519 key fingerprint is:
// server#   ssh-ed25519 255 SHA256:XXXXXXXXXXXXXXXXXXXXXXX
// server# If you trust this host, enter "y" to add the key to
// server# PuTTY's cache and carry on connecting.
// server# If you want to carry on connecting just once, without
// server# adding the key to the cache, enter "n".
// server# If you do not trust this host, press Return to abandon the
// server# connection.
// server# Store key in cache? (y/n, Return cancels connection, i for more info) Using username "comet".
// server> comet@192.168.1.110's password:
// server> Web console: https://comet:9090/
// server>
// server> Last login: Sun Jul  3 00:00:00 2022 from 192.168.1.100
// server> [comet@comet ~]$ exit
// logout>
```
