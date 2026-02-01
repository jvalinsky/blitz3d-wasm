/**
 * Video playback runtime for Blitz3D WASM engine
 * 
 * Implements BlitzMovie_* functions using HTML5 video elements.
 * Maps WASM video handles to actual <video> elements in the DOM.
 */

interface MovieHandle {
  video: HTMLVideoElement;
  path: string;
  container?: HTMLElement;
}

export class VideoRuntime {
  private movies: Map<number, MovieHandle> = new Map();
  private nextHandle = 1;
  private defaultContainer: HTMLElement | null = null;

  constructor(containerElement?: HTMLElement) {
    this.defaultContainer = containerElement || document.body;
  }

  /**
   * Open a video file for playback
   * 
   * @param path - Path to video file (relative to dist/)
   * @returns Movie handle, or 0 on failure
   */
  openMovie(path: string): number {
    try {
      const video = document.createElement('video');
      video.src = path;
      video.style.display = 'none'; // Hidden by default
      video.preload = 'metadata';
      
      // Auto-remove on error
      video.onerror = () => {
        console.error(`[VideoRuntime] Failed to load: ${path}`);
        this.closeMovie(handle);
      };

      const handle = this.nextHandle++;
      this.movies.set(handle, { video, path });

      console.log(`[VideoRuntime] Opened movie: ${path} (handle=${handle})`);
      return handle;
    } catch (error) {
      console.error(`[VideoRuntime] Error opening movie:`, error);
      return 0;
    }
  }

  /**
   * Close an open movie
   */
  closeMovie(handle: number): boolean {
    const movie = this.movies.get(handle);
    if (!movie) return false;

    // Stop playback and cleanup
    movie.video.pause();
    movie.video.src = '';
    movie.video.remove();

    this.movies.delete(handle);
    console.log(`[VideoRuntime] Closed movie (handle=${handle})`);
    return true;
  }

  /**
   * Get video width in pixels
   */
  getWidth(handle: number): number {
    const movie = this.movies.get(handle);
    return movie?.video.videoWidth || 640;
  }

  /**
   * Get video height in pixels
   */
  getHeight(handle: number): number {
    const movie = this.movies.get(handle);
    return movie?.video.videoHeight || 480;
  }

  /**
   * Start video playback
   */
  async play(handle: number): Promise<boolean> {
    const movie = this.movies.get(handle);
    if (!movie) return false;

    try {
      // Add to DOM if not already
      if (!movie.video.parentElement && this.defaultContainer) {
        this.defaultContainer.appendChild(movie.video);
      }

      // Show video
      movie.video.style.display = 'block';

      await movie.video.play();
      console.log(`[VideoRuntime] Playing (handle=${handle})`);
      return true;
    } catch (error) {
      console.error(`[VideoRuntime] Play failed:`, error);
      return false;
    }
  }

  /**
   * Stop video playback
   */
  stop(handle: number): boolean {
    const movie = this.movies.get(handle);
    if (!movie) return false;

    movie.video.pause();
    movie.video.currentTime = 0;
    movie.video.style.display = 'none';

    console.log(`[VideoRuntime] Stopped (handle=${handle})`);
    return true;
  }

  /**
   * Pause video playback
   */
  pause(handle: number): boolean {
    const movie = this.movies.get(handle);
    if (!movie) return false;

    movie.video.pause();
    return true;
  }

  /**
   * Resume video playback
   */
  resume(handle: number): boolean {
    const movie = this.movies.get(handle);
    if (!movie) return false;

    movie.video.play();
    return true;
  }

  /**
   * Check if video is playing
   */
  isPlaying(handle: number): boolean {
    const movie = this.movies.get(handle);
    return movie ? !movie.video.paused : false;
  }

  /**
   * Get current playback position in seconds
   */
  getCurrentTime(handle: number): number {
    const movie = this.movies.get(handle);
    return movie?.video.currentTime || 0;
  }

  /**
   * Get total duration in seconds
   */
  getDuration(handle: number): number {
    const movie = this.movies.get(handle);
    return movie?.video.duration || 0;
  }

  /**
   * Set playback position
   */
  seek(handle: number, timeSeconds: number): boolean {
    const movie = this.movies.get(handle);
    if (!movie) return false;

    movie.video.currentTime = timeSeconds;
    return true;
  }

  /**
   * Set video volume (0.0 to 1.0)
   */
  setVolume(handle: number, volume: number): boolean {
    const movie = this.movies.get(handle);
    if (!movie) return false;

    movie.video.volume = Math.max(0, Math.min(1, volume));
    return true;
  }

  /**
   * Enable/disable video looping
   */
  setLooping(handle: number, loop: boolean): boolean {
    const movie = this.movies.get(handle);
    if (!movie) return false;

    movie.video.loop = loop;
    return true;
  }

  /**
   * Cleanup all movies
   */
  cleanup() {
    for (const [handle, _] of this.movies) {
      this.closeMovie(handle);
    }
  }
}

// Global singleton instance
let globalVideoRuntime: VideoRuntime | null = null;

/**
 * Get or create global video runtime instance
 */
export function getVideoRuntime(container?: HTMLElement): VideoRuntime {
  if (!globalVideoRuntime) {
    globalVideoRuntime = new VideoRuntime(container);
  }
  return globalVideoRuntime;
}

/**
 * WASM-compatible exports
 * These match the signatures in PlatformStubs.swift
 */
export function createVideoWasmExports(runtime?: VideoRuntime) {
  const vr = runtime || getVideoRuntime();

  return {
    BlitzMovie_Open: (pathPtr: number): number => {
      // TODO: Read string from WASM linear memory at pathPtr
      const path = "unknown.avi"; // Placeholder
      return vr.openMovie(path);
    },

    BlitzMovie_Close: (handle: number): number => {
      return vr.closeMovie(handle) ? 1 : 0;
    },

    BlitzMovie_GetWidth: (handle: number): number => {
      return vr.getWidth(handle);
    },

    BlitzMovie_GetHeight: (handle: number): number => {
      return vr.getHeight(handle);
    },

    BlitzMovie_Play: (handle: number): number => {
      vr.play(handle);
      return 1; // Async, return success immediately
    },

    BlitzMovie_Stop: (handle: number): number => {
      return vr.stop(handle) ? 1 : 0;
    },

    BlitzMovie_OpenDecodeToImage: (handle: number, imagePtr: number): number => {
      // TODO: Implement frame capture to image buffer
      console.log(`[VideoRuntime] OpenDecodeToImage not implemented`);
      return 0;
    },
  };
}
