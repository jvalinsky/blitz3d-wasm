/**
 * Blitz3D Runtime Audio Module
 * WebAudio integration for 2D/3D sound playback
 *
 * No Three.js dependency — uses entity IDs and world matrices from EngineBridge.
 */

import type { EngineBridge } from "../engine/bridge.ts";

interface SoundMetadata {
  loop?: boolean;
  volume?: number;
  pan?: number;
  rate?: number;
  position?: { x: number; y: number; z: number };
}

type SourceKind = "sound" | "stream";
type ChannelState = "pending" | "playing" | "paused";

interface SoundEntry {
  id: number;
  buffer: AudioBuffer | null;
  loading: boolean;
  error?: string;
  meta: SoundMetadata;
  pending: Set<number>;
}

interface ChannelEntry {
  id: number;
  source?: AudioBufferSourceNode;
  gain: GainNode;
  panner: StereoPannerNode | PannerNode;
  sourceKind: SourceKind;
  sourceId: number;
  startedAt: number;
  offset: number;
  volume: number;
  pan: number;
  rate: number;
  loop: boolean;
  is3D: boolean;
  entityId?: number;
  position?: { x: number; y: number; z: number };
  state: ChannelState;
}

export class Blitz3DAudio {
  context: AudioContext | null = null;
  sounds: Map<number, SoundEntry> = new Map();
  streams: Map<number, SoundEntry> = new Map();
  channels: Map<number, ChannelEntry> = new Map();
  nextSoundId = 1;
  nextStreamId = 1;
  nextChannelId = 1;
  masterGain: GainNode | null = null;
  bridge: EngineBridge | null = null;
  private createContext: () => AudioContext | null;

  constructor(
    private core: any,
    opts?: {
      context?: AudioContext;
      createContext?: () => AudioContext | null;
    },
  ) {
    this.createContext = opts?.createContext ?? (() => {
      if (typeof window === "undefined") return null;
      const AudioContext = window.AudioContext ||
        (window as any).webkitAudioContext;
      return AudioContext ? new AudioContext() : null;
    });

    if (opts?.context) {
      this.context = opts.context;
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
    }
  }

  ensureContext(): boolean {
    if (this.context) return true;
    const ctx = this.createContext();
    if (!ctx) {
      console.warn("WebAudio not supported");
      return false;
    }
    this.context = ctx;
    this.masterGain = ctx.createGain();
    this.masterGain.connect(ctx.destination);
    return true;
  }

  resume() {
    if (!this.ensureContext()) return;
    if (this.context && this.context.state === "suspended") {
      this.context.resume().catch((e) =>
        console.warn("Audio resume failed:", e)
      );
    }
  }

  dispose() {
    try {
      for (const entry of this.channels.values()) {
        try {
          entry.source?.stop?.();
        } catch {}
        try {
          entry.source?.disconnect?.();
        } catch {}
        try {
          entry.panner?.disconnect?.();
        } catch {}
        try {
          entry.gain?.disconnect?.();
        } catch {}
      }
      this.channels.clear();
      this.sounds.clear();
      this.streams.clear();
    } catch {}

    try {
      this.masterGain?.disconnect?.();
    } catch {}
    this.masterGain = null;

    if (this.context) {
      try {
        this.context.close();
      } catch {}
      this.context = null;
    }
  }

  private readSoundBytes(path: string): Uint8Array | null {
    const fileIO = this.core?.fileIO;
    if (!fileIO?.openFile) return null;

    const tryOpen = (p: string) => {
      const handle = fileIO.openFile(p);
      if (!handle) return null;
      try {
        const data = fileIO.readRemaining(handle);
        fileIO.closeFile(handle);
        return data ?? null;
      } catch {
        try {
          fileIO.closeFile(handle);
        } catch {}
        return null;
      }
    };

    let data = tryOpen(path);
    if (!data && path.toLowerCase().endsWith(".wav")) {
      data = tryOpen(path.replace(/\.wav$/i, ".ogg"));
    }
    return data;
  }

  private decodeIntoEntry(entry: SoundEntry, data: Uint8Array) {
    if (!this.context) return;
    const buf = data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer;
    this.context.decodeAudioData(buf).then((audioBuf) => {
      entry.buffer = audioBuf;
      entry.loading = false;
      this.flushPending(entry);
    }).catch((e) => {
      entry.loading = false;
      entry.error = String(e);
      this.failPending(entry);
    });
  }

  private createEntry(id: number, meta?: SoundMetadata): SoundEntry {
    return {
      id,
      buffer: null,
      loading: true,
      error: undefined,
      meta: meta ?? {},
      pending: new Set(),
    };
  }

  loadSound(path: string, _flags: number): number {
    if (!this.ensureContext()) return 0;
    const data = this.readSoundBytes(path);
    if (!data) return 0;

    const id = this.nextSoundId++;
    const entry = this.createEntry(id);
    this.sounds.set(id, entry);
    this.decodeIntoEntry(entry, data);
    return id;
  }

  openStream(path: string, mode = 0): number {
    if (!this.ensureContext()) return 0;
    const data = this.readSoundBytes(path);
    if (!data) return 0;

    const id = this.nextStreamId++;
    const meta: SoundMetadata = { loop: (mode & 2) !== 0 };
    const entry = this.createEntry(id, meta);
    this.streams.set(id, entry);
    this.decodeIntoEntry(entry, data);
    return id;
  }

  playStream(
    streamId: number,
    volume?: number,
    pan?: number,
    rate?: number,
    loopOverride?: boolean,
  ): number {
    return this._playFromEntry(
      "stream",
      streamId,
      volume,
      pan,
      rate,
      loopOverride,
      false,
    );
  }

  stopStream(streamId: number) {
    this.stopChannelsForSource("stream", streamId);
  }

  closeStream(streamId: number) {
    if (this.streams.has(streamId)) {
      this.stopChannelsForSource("stream", streamId);
      this.streams.delete(streamId);
    }
  }

  freeSound(soundId: number) {
    if (this.sounds.has(soundId)) {
      this.stopChannelsForSource("sound", soundId);
      this.sounds.delete(soundId);
    }
  }

  loopSound(soundId: number, loop: boolean) {
    const entry = this.sounds.get(soundId);
    if (entry) entry.meta.loop = loop;
  }

  setSoundVolume(soundId: number, volume: number) {
    const entry = this.sounds.get(soundId);
    if (entry) entry.meta.volume = volume;
  }

  setSoundPan(soundId: number, pan: number) {
    const entry = this.sounds.get(soundId);
    if (entry) entry.meta.pan = pan;
  }

  setSoundPitch(soundId: number, rate: number) {
    const entry = this.sounds.get(soundId);
    if (entry) entry.meta.rate = rate;
  }

  setSoundPosition(soundId: number, x: number, y: number, z: number) {
    const entry = this.sounds.get(soundId);
    if (entry) entry.meta.position = { x, y, z };
  }

  private createChannelEntry(
    sourceKind: SourceKind,
    sourceId: number,
    volume: number,
    pan: number,
    rate: number,
    loop: boolean,
    is3D: boolean,
    entityId?: number,
    position?: { x: number; y: number; z: number },
  ): ChannelEntry | null {
    if (!this.ensureContext() || !this.context || !this.masterGain) return null;

    let panner: StereoPannerNode | PannerNode;
    if (is3D) {
      const p = this.context.createPanner();
      p.panningModel = "HRTF";
      p.distanceModel = "inverse";
      p.refDistance = 1;
      p.maxDistance = 10000;
      p.rolloffFactor = 1;
      panner = p;
    } else {
      panner = this.context.createStereoPanner();
      (panner as StereoPannerNode).pan.value = pan;
    }

    const gain = this.context.createGain();
    gain.gain.value = volume;

    panner.connect(gain);
    gain.connect(this.masterGain);

    const chanId = this.nextChannelId++;
    const entry: ChannelEntry = {
      id: chanId,
      sourceKind,
      sourceId,
      gain,
      panner,
      startedAt: 0,
      offset: 0,
      volume,
      pan,
      rate,
      loop,
      is3D,
      entityId,
      position,
      state: "pending",
    };
    this.channels.set(chanId, entry);
    return entry;
  }

  private startChannel(entry: ChannelEntry, buffer: AudioBuffer) {
    if (!this.context) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = entry.loop;
    source.playbackRate.value = entry.rate;
    source.connect(entry.panner);
    entry.source = source;
    entry.startedAt = this.context.currentTime - entry.offset;
    entry.state = "playing";

    if (entry.is3D && entry.panner instanceof PannerNode) {
      const pos = entry.position;
      if (pos) {
        entry.panner.positionX.setTargetAtTime(
          pos.x,
          this.context.currentTime,
          0.02,
        );
        entry.panner.positionY.setTargetAtTime(
          pos.y,
          this.context.currentTime,
          0.02,
        );
        entry.panner.positionZ.setTargetAtTime(
          pos.z,
          this.context.currentTime,
          0.02,
        );
      }
    }

    source.onended = () => {
      const active = this.channels.get(entry.id);
      if (active?.source === source) {
        this.channels.delete(entry.id);
      }
    };

    source.start(0, entry.offset);
  }

  private flushPending(entry: SoundEntry) {
    if (!entry.buffer) return;
    for (const chanId of entry.pending) {
      const chan = this.channels.get(chanId);
      if (!chan) continue;
      if (chan.state === "paused") continue;
      this.startChannel(chan, entry.buffer);
    }
    entry.pending.clear();
  }

  private failPending(entry: SoundEntry) {
    for (const chanId of entry.pending) {
      this.channels.delete(chanId);
    }
    entry.pending.clear();
  }

  private queuePending(entry: SoundEntry, channel: ChannelEntry) {
    entry.pending.add(channel.id);
  }

  playSound(
    soundId: number,
    volume?: number,
    pan?: number,
    rate?: number,
    loopOverride?: boolean,
  ): number {
    return this._playFromEntry(
      "sound",
      soundId,
      volume,
      pan,
      rate,
      loopOverride,
      false,
    );
  }

  playSound3D(
    soundId: number,
    x: number,
    y: number,
    z: number,
    volume?: number,
    rate?: number,
    loopOverride?: boolean,
    entityId?: number,
  ): number {
    return this._playFromEntry(
      "sound",
      soundId,
      volume,
      0,
      rate,
      loopOverride,
      true,
      entityId,
      { x, y, z },
    );
  }

  private _playFromEntry(
    kind: SourceKind,
    sourceId: number,
    volume?: number,
    pan?: number,
    rate?: number,
    loopOverride?: boolean,
    is3D?: boolean,
    entityId?: number,
    position?: { x: number; y: number; z: number },
  ): number {
    const entry = kind === "sound"
      ? this.sounds.get(sourceId)
      : this.streams.get(sourceId);
    if (!entry) return 0;
    if (!entry.buffer && !entry.loading) return 0;

    const meta = entry.meta;
    const finalVolume = volume ?? meta.volume ?? 1.0;
    const finalPan = pan ?? meta.pan ?? 0.0;
    const finalRate = rate ?? meta.rate ?? 1.0;
    const loop = loopOverride ?? meta.loop ?? false;
    const chan = this.createChannelEntry(
      kind,
      sourceId,
      finalVolume,
      finalPan,
      finalRate,
      loop,
      !!is3D,
      entityId,
      position ?? meta.position,
    );
    if (!chan) return 0;

    if (entry.buffer) {
      this.startChannel(chan, entry.buffer);
    } else if (entry.loading) {
      this.queuePending(entry, chan);
    }

    return chan.id;
  }

  stopChannel(chanId: number) {
    const entry = this.channels.get(chanId);
    if (!entry) return;
    const source = entry.source;
    entry.state = "paused";
    entry.source = undefined;
    try {
      source?.stop();
    } catch {}
    this.channels.delete(chanId);
    const sourceEntry = entry.sourceKind === "sound"
      ? this.sounds.get(entry.sourceId)
      : this.streams.get(entry.sourceId);
    sourceEntry?.pending.delete(chanId);
  }

  pauseChannel(chanId: number) {
    const entry = this.channels.get(chanId);
    if (!entry || !this.context) return;
    const source = entry.source;
    entry.state = "paused";
    entry.offset = Math.max(0, this.context.currentTime - entry.startedAt);
    entry.source = undefined;
    try {
      source?.stop();
    } catch {}
    const sourceEntry = entry.sourceKind === "sound"
      ? this.sounds.get(entry.sourceId)
      : this.streams.get(entry.sourceId);
    sourceEntry?.pending.delete(chanId);
  }

  resumeChannel(chanId: number): number {
    const entry = this.channels.get(chanId);
    if (!entry) return 0;
    if (entry.state === "playing") return chanId;
    const sourceEntry = entry.sourceKind === "sound"
      ? this.sounds.get(entry.sourceId)
      : this.streams.get(entry.sourceId);
    if (!sourceEntry) return 0;
    if (sourceEntry.buffer) {
      this.startChannel(entry, sourceEntry.buffer);
    } else if (sourceEntry.loading) {
      entry.state = "pending";
      this.queuePending(sourceEntry, entry);
    }
    return chanId;
  }

  setChannelVolume(chanId: number, vol: number) {
    const entry = this.channels.get(chanId);
    if (!entry || !this.context) return;
    entry.gain.gain.setTargetAtTime(vol, this.context.currentTime, 0.02);
    entry.volume = vol;
  }

  setChannelPan(chanId: number, pan: number) {
    const entry = this.channels.get(chanId);
    if (!entry || !this.context) return;
    if (entry.panner instanceof StereoPannerNode) {
      entry.panner.pan.setTargetAtTime(pan, this.context.currentTime, 0.02);
      entry.pan = pan;
    }
  }

  setChannelPitch(chanId: number, pitch: number) {
    const entry = this.channels.get(chanId);
    if (!entry || !this.context) return;
    if (entry.source) {
      entry.source.playbackRate.setTargetAtTime(
        pitch,
        this.context.currentTime,
        0.02,
      );
    }
    entry.rate = pitch;
  }

  isChannelPlaying(chanId: number): boolean {
    const entry = this.channels.get(chanId);
    return !!entry && (entry.state === "playing" || entry.state === "pending");
  }

  private stopChannelsForSource(kind: SourceKind, sourceId: number) {
    for (const [chanId, entry] of this.channels.entries()) {
      if (entry.sourceKind === kind && entry.sourceId === sourceId) {
        this.stopChannel(chanId);
      }
    }
  }

  /**
   * Update audio listener from camera entity ID via bridge world matrix readback.
   * Also updates positions of 3D sound emitters.
   */
  updateListenerFromBridge(camId: number) {
    if (!this.context || !this.bridge) return;
    const l = this.context.listener;

    // Read camera world matrix
    const m = this.bridge.getWorldMatrix(camId);
    if (!m) return;

    // Position = column 3
    const px = m[12], py = m[13], pz = m[14];
    // Forward = column 2 (Blitz3D convention, Z axis)
    const fx = m[8], fy = m[9], fz = m[10];
    // Up = column 1
    const ux = m[4], uy = m[5], uz = m[6];

    const t = this.context.currentTime;
    if (l.positionX) {
      l.positionX.setTargetAtTime(px, t, 0.02);
      l.positionY.setTargetAtTime(py, t, 0.02);
      l.positionZ.setTargetAtTime(pz, t, 0.02);
      l.forwardX.setTargetAtTime(fx, t, 0.02);
      l.forwardY.setTargetAtTime(fy, t, 0.02);
      l.forwardZ.setTargetAtTime(fz, t, 0.02);
      l.upX.setTargetAtTime(ux, t, 0.02);
      l.upY.setTargetAtTime(uy, t, 0.02);
      l.upZ.setTargetAtTime(uz, t, 0.02);
    } else {
      l.setPosition(px, py, pz);
      l.setOrientation(fx, fy, fz, ux, uy, uz);
    }

    // Update 3D emitter positions
    for (const entry of this.channels.values()) {
      if (!entry.is3D || !(entry.panner instanceof PannerNode)) continue;
      if (entry.entityId) {
        const em = this.bridge.getWorldMatrix(entry.entityId);
        if (em) {
          entry.panner.positionX.setTargetAtTime(em[12], t, 0.02);
          entry.panner.positionY.setTargetAtTime(em[13], t, 0.02);
          entry.panner.positionZ.setTargetAtTime(em[14], t, 0.02);
        }
      } else if (entry.position) {
        entry.panner.positionX.setTargetAtTime(entry.position.x, t, 0.02);
        entry.panner.positionY.setTargetAtTime(entry.position.y, t, 0.02);
        entry.panner.positionZ.setTargetAtTime(entry.position.z, t, 0.02);
      }
    }
  }

  /**
   * Update listener from a Three.js camera (legacy path).
   *
   * The SCPCB loader uses the legacy Three.js renderer path today; in that
   * mode we can update the listener directly from camera transforms.
   */
  updateListener(camera: any) {
    if (!this.context || !camera) return;
    const l = this.context.listener;
    const t = this.context.currentTime;

    const px = camera.position?.x ?? 0;
    const py = camera.position?.y ?? 0;
    const pz = camera.position?.z ?? 0;

    // Forward vector
    let fx = 0, fy = 0, fz = -1;
    try {
      if (typeof camera.getWorldDirection === "function") {
        const dir = camera.getWorldDirection({ x: 0, y: 0, z: -1 });
        fx = dir?.x ?? fx;
        fy = dir?.y ?? fy;
        fz = dir?.z ?? fz;
      } else if (camera.quaternion) {
        // Best-effort: derive forward from quaternion if present.
        // Forward = (0,0,-1) rotated by quaternion.
        const q = camera.quaternion;
        const x = q.x ?? 0, y = q.y ?? 0, z = q.z ?? 0, w = q.w ?? 1;
        // v' = q * v * q^-1 (expanded for v=(0,0,-1))
        const ix = -w * 0 + y * (-1) - z * 0;
        const iy = -w * 0 + z * 0 - x * (-1);
        const iz = -w * (-1) + x * 0 - y * 0;
        const iw = x * 0 + y * 0 + z * (-1);
        fx = ix * w + iw * -x + iy * -z - iz * -y;
        fy = iy * w + iw * -y + iz * -x - ix * -z;
        fz = iz * w + iw * -z + ix * -y - iy * -x;
      }
    } catch {
      // ignore
    }

    // Up vector
    const ux = camera.up?.x ?? 0;
    const uy = camera.up?.y ?? 1;
    const uz = camera.up?.z ?? 0;

    if ((l as any).positionX) {
      (l as any).positionX.setTargetAtTime(px, t, 0.02);
      (l as any).positionY.setTargetAtTime(py, t, 0.02);
      (l as any).positionZ.setTargetAtTime(pz, t, 0.02);
      (l as any).forwardX.setTargetAtTime(fx, t, 0.02);
      (l as any).forwardY.setTargetAtTime(fy, t, 0.02);
      (l as any).forwardZ.setTargetAtTime(fz, t, 0.02);
      (l as any).upX.setTargetAtTime(ux, t, 0.02);
      (l as any).upY.setTargetAtTime(uy, t, 0.02);
      (l as any).upZ.setTargetAtTime(uz, t, 0.02);
    } else if (typeof (l as any).setPosition === "function") {
      (l as any).setPosition(px, py, pz);
      (l as any).setOrientation(fx, fy, fz, ux, uy, uz);
    }
  }
}
