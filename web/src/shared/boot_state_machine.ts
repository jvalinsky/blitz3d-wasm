export type BootPhase =
  | "IDLE"
  | "LOAD_WASM"
  | "LOAD_MANIFEST"
  | "PRELOAD_BOOT"
  | "INSTANTIATE_WASM"
  | "ATTACH_RUNTIME"
  | "READY"
  | "INIT"
  | "RUNNING"
  | "PAUSED"
  | "ERROR"
  | "DISPOSED";

export type BootProgressKind = "wasm" | "assets" | "init";

export type BootProgress = {
  kind: BootProgressKind;
  loaded: number;
  total: number | null;
  detail: string;
};

export type BootSnapshot = {
  phase: BootPhase;
  message: string;
  progress: BootProgress | null;
  lastProgressAtMs: number;
  lastPhaseAtMs: number;
  stallCount: number;
};

export type BootStall = {
  msSinceProgress: number;
  msSincePhaseChange: number;
};

export class BootStateMachine {
  #nowMs: () => number;
  #noProgressMs: number;
  #snapshot: BootSnapshot;

  constructor(options: { nowMs?: () => number; noProgressMs?: number } = {}) {
    this.#nowMs = options.nowMs ?? (() => Date.now());
    this.#noProgressMs = Math.max(250, options.noProgressMs ?? 10_000);
    const now = this.#nowMs();
    this.#snapshot = {
      phase: "IDLE",
      message: "",
      progress: null,
      lastProgressAtMs: now,
      lastPhaseAtMs: now,
      stallCount: 0,
    };
  }

  getSnapshot(): BootSnapshot {
    return {
      ...this.#snapshot,
      progress: this.#snapshot.progress ? { ...this.#snapshot.progress } : null,
    };
  }

  setPhase(phase: BootPhase, message = "") {
    const now = this.#nowMs();
    this.#snapshot = {
      ...this.#snapshot,
      phase,
      message,
      lastPhaseAtMs: now,
      lastProgressAtMs: now,
      progress: null,
    };
  }

  setProgress(
    kind: BootProgressKind,
    loaded: number,
    total: number | null,
    detail = "",
  ) {
    const now = this.#nowMs();
    this.#snapshot = {
      ...this.#snapshot,
      progress: { kind, loaded, total, detail },
      lastProgressAtMs: now,
    };
  }

  setMessage(message: string) {
    this.#snapshot = { ...this.#snapshot, message };
  }

  checkNoProgress(): BootStall | null {
    const now = this.#nowMs();
    const msSinceProgress = now - this.#snapshot.lastProgressAtMs;
    if (msSinceProgress < this.#noProgressMs) return null;
    const msSincePhaseChange = now - this.#snapshot.lastPhaseAtMs;
    this.#snapshot = {
      ...this.#snapshot,
      stallCount: this.#snapshot.stallCount + 1,
      lastProgressAtMs: now, // debounce: avoid rapid repeats
    };
    return { msSinceProgress, msSincePhaseChange };
  }
}
