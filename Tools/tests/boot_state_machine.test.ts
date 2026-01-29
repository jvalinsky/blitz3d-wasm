import { BootStateMachine } from "../../web/src/shared/boot_state_machine.ts";
import { assert, assertEquals } from "./assert.ts";

Deno.test("BootStateMachine basics: phase/progress + no-progress watchdog", () => {
  let now = 0;
  const boot = new BootStateMachine({ nowMs: () => now, noProgressMs: 1000 });

  let snap = boot.getSnapshot();
  assertEquals(snap.phase, "IDLE");
  assertEquals(snap.progress, null);

  boot.setPhase("LOAD_WASM", "connecting");
  snap = boot.getSnapshot();
  assertEquals(snap.phase, "LOAD_WASM");
  assertEquals(snap.message, "connecting");

  boot.setProgress("wasm", 10, 100, "10%");
  snap = boot.getSnapshot();
  assertEquals(snap.progress?.kind, "wasm");
  assertEquals(snap.progress?.loaded, 10);
  assertEquals(snap.progress?.total, 100);

  now = 999;
  assertEquals(boot.checkNoProgress(), null);

  now = 1001;
  const stall = boot.checkNoProgress();
  if (!stall) throw new Error("expected stall");
  assertEquals(Math.round(stall.msSinceProgress), 1001);

  const after = boot.getSnapshot();
  assertEquals(after.stallCount, 1);

  // Debounced: immediately calling again should not increment again.
  now = 1100;
  assertEquals(boot.checkNoProgress(), null);
});
