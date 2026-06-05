// Web Audio API-based sound player mimicking the expo-av Sound API.
//
// Why: on iOS Safari, an HTMLAudioElement loaded from a blob: URL cannot seek
// reliably — setting currentTime is silently ignored or only works after the
// whole file has streamed. Web Audio with a fully-decoded AudioBuffer lets us
// seek to any position instantly. As a bonus, the gain node enables real
// volume control even on iOS (which blocks <audio>.volume).

export interface PlaybackStatus {
  isLoaded: boolean;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  didJustFinish?: boolean;
}

export type StatusCallback = (status: PlaybackStatus) => void;

interface InitialStatus {
  shouldPlay?: boolean;
  positionMillis?: number;
  rate?: number;
  volume?: number;
}

let sharedCtx: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!sharedCtx) {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    sharedCtx = new Ctor();
  }
  return sharedCtx;
}

export class WebAudioSound {
  private ctx: AudioContext;
  private gain: GainNode;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private startCtxTime = 0; // ctx.currentTime when last play() started
  private startOffset = 0; // position in seconds when last play() started
  private pausePosition = 0; // last known position when paused/seeked
  private playing = false;
  private rate = 1;
  private statusCb: StatusCallback | null = null;
  private statusTimer: any = null;
  private endedHandledFor: AudioBufferSourceNode | null = null;

  constructor() {
    this.ctx = getAudioContext();
    this.gain = this.ctx.createGain();
    this.gain.connect(this.ctx.destination);
  }

  static async createAsync(
    source: { uri: string },
    initialStatus: InitialStatus,
    onStatus: StatusCallback
  ): Promise<{ sound: WebAudioSound }> {
    const sound = new WebAudioSound();
    await sound._load(source.uri, onStatus);
    if (initialStatus.volume != null) sound.gain.gain.value = Math.max(0, Math.min(1, initialStatus.volume));
    if (initialStatus.rate != null) sound.rate = initialStatus.rate;
    if (initialStatus.positionMillis) sound.pausePosition = initialStatus.positionMillis / 1000;
    if (initialStatus.shouldPlay) await sound.playAsync();
    else sound._fireStatus();
    return { sound };
  }

  private async _load(uri: string, cb: StatusCallback): Promise<void> {
    this.statusCb = cb;
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    this.buffer = await this.ctx.decodeAudioData(arrayBuffer);
  }

  async playAsync(): Promise<void> {
    if (!this.buffer || this.playing) return;
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch {}
    }
    const start = Math.max(0, Math.min(this.pausePosition, this.buffer.duration));
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = this.rate;
    src.connect(this.gain);
    src.onended = () => {
      if (this.endedHandledFor === src) return;
      this.endedHandledFor = src;
      // Only treat as finished if it ended near the end (not from stop())
      if (this.playing && this.buffer) {
        const pos = this._computeLivePosition();
        if (pos >= this.buffer.duration - 0.2) {
          this.playing = false;
          this.pausePosition = 0;
          this.source = null;
          this._stopStatusTimer();
          this._fireStatus(true);
        }
      }
    };
    src.start(0, start);
    this.source = src;
    this.startCtxTime = this.ctx.currentTime;
    this.startOffset = start;
    this.playing = true;
    this._startStatusTimer();
    this._fireStatus();
  }

  async pauseAsync(): Promise<void> {
    if (!this.playing) return;
    this.pausePosition = this._computeLivePosition();
    if (this.source) {
      try { this.source.stop(); } catch {}
      this.source.disconnect();
      this.source = null;
    }
    this.playing = false;
    this._stopStatusTimer();
    this._fireStatus();
  }

  async setPositionAsync(positionMillis: number): Promise<void> {
    const target = Math.max(0, positionMillis / 1000);
    const wasPlaying = this.playing;
    if (this.source) {
      try { this.source.stop(); } catch {}
      this.source.disconnect();
      this.source = null;
    }
    this.playing = false;
    this.pausePosition = this.buffer ? Math.min(target, this.buffer.duration) : target;
    if (wasPlaying) {
      await this.playAsync();
    } else {
      this._fireStatus();
    }
  }

  async setRateAsync(rate: number, _shouldCorrectPitch?: boolean): Promise<void> {
    this.rate = rate;
    if (this.playing) {
      // Restart at current position with new rate to keep tracking consistent
      const pos = this._computeLivePosition();
      this.pausePosition = pos;
      if (this.source) {
        try { this.source.stop(); } catch {}
        this.source.disconnect();
        this.source = null;
      }
      this.playing = false;
      await this.playAsync();
    }
  }

  async setVolumeAsync(volume: number): Promise<void> {
    this.gain.gain.value = Math.max(0, Math.min(1, volume));
  }

  async unloadAsync(): Promise<void> {
    this._stopStatusTimer();
    if (this.source) {
      try { this.source.stop(); } catch {}
      this.source.disconnect();
      this.source = null;
    }
    this.buffer = null;
    this.playing = false;
    this.pausePosition = 0;
    this.statusCb = null;
  }

  // -- internals --

  private _computeLivePosition(): number {
    if (!this.playing) return this.pausePosition;
    const elapsed = (this.ctx.currentTime - this.startCtxTime) * this.rate;
    const pos = this.startOffset + elapsed;
    if (this.buffer && pos > this.buffer.duration) return this.buffer.duration;
    return pos;
  }

  private _fireStatus(didJustFinish: boolean = false): void {
    if (!this.statusCb) return;
    this.statusCb({
      isLoaded: !!this.buffer,
      isPlaying: this.playing,
      positionMillis: Math.round(this._computeLivePosition() * 1000),
      durationMillis: Math.round((this.buffer?.duration ?? 0) * 1000),
      didJustFinish,
    });
  }

  private _startStatusTimer(): void {
    this._stopStatusTimer();
    this.statusTimer = setInterval(() => this._fireStatus(), 500);
  }

  private _stopStatusTimer(): void {
    if (this.statusTimer) {
      clearInterval(this.statusTimer);
      this.statusTimer = null;
    }
  }
}
