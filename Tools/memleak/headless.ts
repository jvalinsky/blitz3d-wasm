type EventHandler = (ev: any) => void;

type ListenerKey = `${string}:${string}`;

const makeEventKey = (type: string, listener: EventHandler): string => {
  return `${type}:${String((listener as any).__id ?? listener.name ?? "anon")}`;
};

const assignListenerId = (listener: EventHandler) => {
  if (!(listener as any).__id) {
    (listener as any).__id = crypto.randomUUID();
  }
};

export type HeadlessCounters = {
  listenersActive: number;
  rafActive: number;
  rafScheduledTotal: number;
};

export type HeadlessEnv = {
  counters: HeadlessCounters;
  reset: () => void;
  getActiveListenerCount: () => number;
  getActiveRafCount: () => number;
};

export const installHeadlessEnv = (): HeadlessEnv => {
  const listeners = new Map<ListenerKey, EventHandler>();
  const rafTimers = new Map<number, number>();

  const counters: HeadlessCounters = {
    listenersActive: 0,
    rafActive: 0,
    rafScheduledTotal: 0,
  };

  const addListener = (type: string, listener: EventHandler) => {
    assignListenerId(listener);
    const key = makeEventKey(type, listener) as ListenerKey;
    if (listeners.has(key)) return;
    listeners.set(key, listener);
    counters.listenersActive = listeners.size;
  };

  const removeListener = (type: string, listener: EventHandler) => {
    assignListenerId(listener);
    const key = makeEventKey(type, listener) as ListenerKey;
    listeners.delete(key);
    counters.listenersActive = listeners.size;
  };

  const requestAnimationFrame = (cb: (t: number) => void): number => {
    counters.rafScheduledTotal++;
    const id = counters.rafScheduledTotal;
    const timer = setTimeout(() => {
      rafTimers.delete(id);
      counters.rafActive = rafTimers.size;
      cb(performance.now());
    }, 0) as unknown as number;
    rafTimers.set(id, timer);
    counters.rafActive = rafTimers.size;
    return id;
  };

  const cancelAnimationFrame = (id: number) => {
    const timer = rafTimers.get(id);
    if (timer == null) return;
    clearTimeout(timer);
    rafTimers.delete(id);
    counters.rafActive = rafTimers.size;
  };

  // Minimal element/node model for the runtime.
  class HeadlessElement {
    tagName: string;
    id = "";
    style: Record<string, string> = {};
    parentElement: HeadlessElement | null = null;
    children: HeadlessElement[] = [];
    #listeners = new Map<string, Set<EventHandler>>();

    constructor(tagName: string) {
      this.tagName = tagName.toUpperCase();
    }

    addEventListener(type: string, listener: EventHandler) {
      const set = this.#listeners.get(type) ?? new Set<EventHandler>();
      set.add(listener);
      this.#listeners.set(type, set);
    }

    removeEventListener(type: string, listener: EventHandler) {
      const set = this.#listeners.get(type);
      if (!set) return;
      set.delete(listener);
      if (set.size === 0) this.#listeners.delete(type);
    }

    dispatchEvent(type: string, ev: any = {}) {
      const set = this.#listeners.get(type);
      if (!set) return;
      for (const fn of set) {
        try {
          fn(ev);
        } catch {
          // ignore
        }
      }
    }

    appendChild(child: any) {
      if (child?.parentElement) {
        child.parentElement.removeChild(child);
      }
      child.parentElement = this;
      this.children.push(child);
      return child;
    }

    removeChild(child: any) {
      const idx = this.children.indexOf(child);
      if (idx >= 0) this.children.splice(idx, 1);
      child.parentElement = null;
      return child;
    }

    replaceChild(newChild: any, oldChild: any) {
      const idx = this.children.indexOf(oldChild);
      if (idx >= 0) {
        this.children[idx] = newChild;
        oldChild.parentElement = null;
        newChild.parentElement = this;
      } else {
        this.appendChild(newChild);
      }
      return oldChild;
    }
  }

  class HTMLCanvasElement extends HeadlessElement {
    width = 800;
    height = 600;

    constructor() {
      super("canvas");
    }

    getContext(type: string) {
      if (type !== "2d") return null;
      const ctx = {
        fillStyle: "",
        strokeStyle: "",
        globalCompositeOperation: "source-over",
        font: "12px arial",
        beginPath: () => {},
        closePath: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        clearRect: () => {},
        drawImage: () => {},
        createPattern: () => null,
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        save: () => {},
        restore: () => {},
        measureText: (txt: string) => ({
          width: txt.length * 7,
          actualBoundingBoxAscent: 10,
          actualBoundingBoxDescent: 2,
        }),
        getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }),
        putImageData: () => {},
        fillText: () => {},
        strokeText: () => {},
      };
      return ctx;
    }
  }

  class HTMLImageElement extends HeadlessElement {
    #src = "";
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    width = 1;
    height = 1;

    constructor() {
      super("img");
    }

    get src() {
      return this.#src;
    }

    set src(value: string) {
      this.#src = value ?? "";

      // Simulate an async successful load so loaders (e.g. Three.js) can complete.
      setTimeout(() => {
        try {
          this.width = this.width || 1;
          this.height = this.height || 1;
          this.onload?.();
          this.dispatchEvent("load", { target: this });
        } catch {
          // ignore
        }
      }, 0);
    }
  }

  class HTMLVideoElement extends HeadlessElement {
    src = "";
    muted = false;
    playsInline = false;
    crossOrigin: string | null = null;
    onended: null | (() => void) = null;

    constructor() {
      super("video");
    }

    pause() {}
    load() {}
    removeAttribute(name: string) {
      if (name === "src") this.src = "";
    }
    play() {
      return Promise.resolve();
    }
  }

  class HTMLAudioElement extends HeadlessElement {
    src = "";
    loop = false;
    currentTime = 0;
    onended: null | (() => void) = null;

    constructor() {
      super("audio");
    }

    pause() {}
    load() {}
    play() {
      return Promise.resolve();
    }
  }

  const root = new HeadlessElement("div");

  const elementsById = new Map<string, any>();

  const document = {
    body: root,
    getElementById: (id: string) => elementsById.get(id) ?? null,
    createElement: (tag: string) => {
      const t = tag.toLowerCase();
      if (t === "canvas") return new HTMLCanvasElement();
      if (t === "img") return new HTMLImageElement();
      if (t === "video") return new HTMLVideoElement();
      if (t === "audio") return new HTMLAudioElement();
      return new HeadlessElement(t);
    },
    createElementNS: (_ns: string, tag: string) => document.createElement(tag),
  };

  const windowObj: any = globalThis;
  windowObj.window = windowObj;
  windowObj.document = document;
  windowObj.performance = windowObj.performance ?? { now: () => Date.now() };
  windowObj.devicePixelRatio = windowObj.devicePixelRatio ?? 1;
  windowObj.__BLITZ3D_HEADLESS = true;

  windowObj.addEventListener = (type: string, listener: EventHandler) =>
    addListener(type, listener);
  windowObj.removeEventListener = (type: string, listener: EventHandler) =>
    removeListener(type, listener);

  windowObj.requestAnimationFrame = requestAnimationFrame;
  windowObj.cancelAnimationFrame = cancelAnimationFrame;

  // Needed for `instanceof` checks and for Three.js / loaders that may assume globals exist.
  windowObj.HTMLCanvasElement = HTMLCanvasElement;
  windowObj.HTMLImageElement = HTMLImageElement;
  windowObj.HTMLVideoElement = HTMLVideoElement;
  windowObj.HTMLAudioElement = HTMLAudioElement;
  // In browsers, `new Image()` / `new Audio()` are valid.
  windowObj.Image = HTMLImageElement as any;
  windowObj.Audio = HTMLAudioElement as any;

  // Provide a default canvas element for `core.init("canvas")`.
  const canvas = new HTMLCanvasElement();
  canvas.id = "canvas";
  canvas.parentElement = root;
  root.children.push(canvas);
  elementsById.set("canvas", canvas);

  const reset = () => {
    listeners.clear();
    rafTimers.forEach((t) => clearTimeout(t));
    rafTimers.clear();
    counters.listenersActive = 0;
    counters.rafActive = 0;
    counters.rafScheduledTotal = 0;
  };

  return {
    counters,
    reset,
    getActiveListenerCount: () => listeners.size,
    getActiveRafCount: () => rafTimers.size,
  };
};
