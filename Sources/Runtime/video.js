/**
 * Video Playback System
 *
 * HTML5 video wrapper for BlitzMovie compatibility.
 */

const VideoSystem = {
  videos: new Map(),
  nextVideoId: 1,

  Open(url) {
    const videoId = this.nextVideoId++;

    const video = document.createElement("video");
    video.style.display = "none";
    video.loop = false;
    video.preload = "auto";

    video.addEventListener("loadeddata", () => {
      console.log(
        `Video ${url} loaded: ${video.videoWidth}x${video.videoHeight}`,
      );
    });

    video.addEventListener("error", (e) => {
      console.error(`Video error:`, video.error);
    });

    this.videos.set(videoId, {
      video: video,
      url: url,
      width: 0,
      height: 0,
      playing: false,
    });

    video.src = url;

    return videoId;
  },

  Close(videoId) {
    const videoInfo = this.videos.get(videoId);
    if (videoInfo) {
      videoInfo.video.pause();
      videoInfo.video.src = "";
      this.videos.delete(videoId);
    }
  },

  Play(videoId) {
    const videoInfo = this.videos.get(videoId);
    if (videoInfo) {
      videoInfo.video.currentTime = 0;
      videoInfo.video.play();
      videoInfo.playing = true;
    }
  },

  Stop(videoId) {
    const videoInfo = this.videos.get(videoId);
    if (videoInfo) {
      videoInfo.video.pause();
      videoInfo.video.currentTime = 0;
      videoInfo.playing = false;
    }
  },

  GetWidth(videoId) {
    const videoInfo = this.videos.get(videoId);
    return videoInfo ? videoInfo.video.videoWidth : 0;
  },

  GetHeight(videoId) {
    const videoInfo = this.videos.get(videoId);
    return videoInfo ? videoInfo.video.videoHeight : 0;
  },

  IsPlaying(videoId) {
    const videoInfo = this.videos.get(videoId);
    return videoInfo && !videoInfo.video.paused && !videoInfo.video.ended;
  },

  Pause(videoId) {
    const videoInfo = this.videos.get(videoId);
    if (videoInfo) {
      videoInfo.video.pause();
      videoInfo.playing = false;
    }
  },

  SetVolume(videoId, volume) {
    const videoInfo = this.videos.get(videoId);
    if (videoInfo) {
      videoInfo.video.volume = Math.max(0, Math.min(1, volume / 255));
    }
  },

  MuteAudio(videoId, muted) {
    const videoInfo = this.videos.get(videoId);
    if (videoInfo) {
      videoInfo.video.muted = muted;
    }
  },

  DrawToCanvas(videoId, canvas, x, y, width, height) {
    const videoInfo = this.videos.get(videoId);
    if (!videoInfo || videoInfo.video.readyState < 2) return;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoInfo.video, x, y, width, height);
    }
  },

  UpdateAll() {
    for (const [videoId, videoInfo] of this.videos) {
      if (videoInfo.playing && videoInfo.video.ended) {
        videoInfo.playing = false;
      }
    }
  },

  OpenDecodeToImage(videoId) {
    const videoInfo = this.videos.get(videoId);
    if (!videoInfo) return 0;

    const canvas = document.createElement("canvas");
    canvas.width = videoInfo.video.videoWidth;
    canvas.height = videoInfo.video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoInfo.video, 0, 0);
    }

    const imageId = Blitz3D.nextEntityId++;
    const texture = new THREE.CanvasTexture(canvas);
    Blitz3D.textures[imageId] = texture;

    return imageId;
  },
};

window.VideoSystem = VideoSystem;
