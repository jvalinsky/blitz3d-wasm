import { join } from "std/path/mod.ts";

function normalizeStdout(s: string): string {
  // Keep intentional blank lines, but normalize newline style and trim trailing whitespace/newlines.
  return s.replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").replace(
    /\n+$/g,
    "\n",
  );
}

type Case = {
  name: string;
  bbRelPath: string;
  expectedStdout: string;
  expectNonZero?: boolean;
  expectStderrIncludes?: string;
  timeoutMs?: number;
};

const cases: Case[] = [
  {
    name: "print literals",
    bbRelPath: "Tests/deno_smoke/01_print_literals.bb",
    expectedStdout: ["Hello", "123", "1.5", ""].join("\n") + "\n",
  },
  {
    name: "arithmetic + if",
    bbRelPath: "Tests/deno_smoke/02_arithmetic_if.bb",
    expectedStdout: ["ok", "b>1"].join("\n") + "\n",
  },
  {
    name: "loops",
    bbRelPath: "Tests/deno_smoke/03_loops.bb",
    expectedStdout: ["i=1", "i=2", "i=3", "s=3"].join("\n") + "\n",
  },
  {
    name: "functions + defaults",
    bbRelPath: "Tests/deno_smoke/04_functions_defaults.bb",
    expectedStdout: ["Add(3)=5", "Add(3,4)=7"].join("\n") + "\n",
  },
  {
    name: "arrays",
    bbRelPath: "Tests/deno_smoke/05_arrays.bb",
    expectedStdout: "arr3=6\n",
  },
  {
    name: "types + foreach + delete",
    bbRelPath: "Tests/deno_smoke/06_types_foreach_delete.bb",
    expectedStdout:
      ["Iterating:", "Node ID: 1", "Node ID: 2", "Done"].join("\n") + "\n",
  },
  {
    name: "data/read/restore",
    bbRelPath: "Tests/deno_smoke/07_data_read_restore.bb",
    expectedStdout:
      ["a=10", "b=20", "c=30", "s1=Hello", "s2=World", "Restored a=10"].join(
        "\n",
      ) + "\n",
  },
  {
    name: "data restore label",
    bbRelPath: "Tests/deno_smoke/08_data_restore_label.bb",
    expectedStdout: "a=99\n",
  },
  {
    name: "goto",
    bbRelPath: "Tests/deno_smoke/09_goto.bb",
    expectedStdout: ["i=1", "i=2", "i=3", "Done"].join("\n") + "\n",
  },
  {
    name: "string concat chain",
    bbRelPath: "Tests/deno_smoke/10_string_concat_chain.bb",
    expectedStdout: "a=1,b=2,c=3\n",
  },
  {
    name: "repeat/until + repeat/forever + exit",
    bbRelPath: "Tests/deno_smoke/11_repeat_exit.bb",
    expectedStdout: ["i=2", "j=3"].join("\n") + "\n",
  },
  {
    name: "select/case/default + range",
    bbRelPath: "Tests/deno_smoke/12_select_case.bb",
    expectedStdout: ["B", "other", "range"].join("\n") + "\n",
  },
  {
    name: "gosub/return",
    bbRelPath: "Tests/deno_smoke/13_gosub_return.bb",
    expectedStdout: ["before", "in", "after", "done"].join("\n") + "\n",
  },
  {
    name: "dim multi-dimensional array",
    bbRelPath: "Tests/deno_smoke/14_dim_multi.bb",
    expectedStdout: "sum=10\n",
  },
  {
    name: "include preprocessor",
    bbRelPath: "Tests/deno_smoke/15_include.bb",
    expectedStdout: "v=7\n",
  },
  {
    name: "insert before (linked list reorder)",
    bbRelPath: "Tests/deno_smoke/16_insert_before_after.bb",
    expectedStdout: ["id=1", "id=3", "id=2"].join("\n") + "\n",
  },
  {
    name: "if / elseif chain",
    bbRelPath: "Tests/deno_smoke/17_else_if.bb",
    expectedStdout: "two\n",
  },
  {
    name: "delete each (expanded to while+delete)",
    bbRelPath: "Tests/deno_smoke/18_delete_each.bb",
    expectedStdout: "first=0\n",
  },
  {
    name: "infinite loop times out",
    bbRelPath: "Tests/deno_smoke/99_infinite_loop.bb",
    expectedStdout: "",
    expectNonZero: true,
    expectStderrIncludes: "timed out",
    timeoutMs: 150,
  },
  {
    name: "interpreter hello example",
    bbRelPath: "Tests/deno_smoke/19_interpreter_hello.bb",
    expectedStdout: [
      "Hello from Blitz3D WASM!",
      "This code is compiled and runs in your browser.",
    ].join("\n") + "\n",
  },
  {
    name: "string builtins",
    bbRelPath: "Tests/deno_smoke/20_string_builtins.bb",
    expectedStdout: [
      "len=10",
      "trim=[AbcDef]",
      "upper=[  ABCDEF  ]",
      "lower=[  abcdef  ]",
      "left=[  A]",
      "right=[f  ]",
      "mid=[Abc]",
      "instr=5",
      "replace=[  XYZDef  ]",
      "chr=A",
      "asc=65",
      "string=xxx",
    ].join("\n") + "\n",
  },
  {
    name: "parser: comments + whitespace + parens",
    bbRelPath: "Tests/deno_smoke/21_parser_comments_whitespace.bb",
    expectedStdout: ["sum=5", "sum2=5"].join("\n") + "\n",
  },
];

for (const tc of cases) {
  Deno.test(`bb_deno_compile_and_run: ${tc.name}`, async () => {
    const repoRoot = Deno.cwd();
    const bbPath = join(repoRoot, tc.bbRelPath);

    const cmd = new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", "Tools/bb_deno_compile_and_run.ts", bbPath],
      env: {
        BB_DENO_VERBOSE: "0",
        BB_DENO_TIMEOUT_MS: String(tc.timeoutMs ?? 2000),
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await cmd.output();
    const stdoutText = new TextDecoder().decode(stdout);
    const stderrText = new TextDecoder().decode(stderr);
    if (tc.expectNonZero) {
      if (code === 0) {
        throw new Error(
          `expected non-zero exit\n--- stdout ---\n${stdoutText}\n--- stderr ---\n${stderrText}`,
        );
      }
      if (
        tc.expectStderrIncludes &&
        !stderrText.toLowerCase().includes(
          tc.expectStderrIncludes.toLowerCase(),
        )
      ) {
        throw new Error(
          `stderr missing expected substring: ${tc.expectStderrIncludes}\n--- stderr ---\n${stderrText}`,
        );
      }
      return;
    }

    if (code !== 0) {
      throw new Error(
        `non-zero exit: ${code}\n--- stdout ---\n${stdoutText}\n--- stderr ---\n${stderrText}`,
      );
    }

    const actual = normalizeStdout(stdoutText);
    const expected = normalizeStdout(tc.expectedStdout);
    if (actual !== expected) {
      throw new Error(
        `stdout mismatch\n--- expected ---\n${expected}\n--- actual ---\n${actual}\n--- raw stderr ---\n${stderrText}`,
      );
    }
  });
}
