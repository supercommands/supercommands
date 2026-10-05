/** Optional capture feedback. Audio failures must never affect screenshot capture/save. */
export class WebsitePopupScreenshotSound {
  #context: AudioContext | null = null;
  #disposed = false;

  /** Call synchronously from the capture/confirmation gesture to unlock browser audio. */
  prepare(): void {
    if (this.#disposed) return;
    try {
      this.#context ??= new AudioContext();
      if (this.#context.state === 'suspended') void this.#context.resume().catch(() => {});
    } catch { /* Audio may be unavailable or blocked by the browser. */ }
  }

  play(): void {
    const context = this.#context;
    if (this.#disposed || !context || context.state !== 'running') return;
    try {
      // Two brief, filtered noise clicks create an original mechanical shutter sound.
      const duration = 0.14;
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let index = 0; index < samples.length; index++) {
        const time = index / context.sampleRate;
        const first = Math.exp(-time * 160);
        const second = time >= 0.055 ? Math.exp(-(time - 0.055) * 100) * 0.7 : 0;
        samples[index] = (Math.random() * 2 - 1) * (first + second) * 0.16;
      }
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2200;
      filter.Q.value = 0.7;
      source.buffer = buffer;
      source.connect(filter);
      filter.connect(context.destination);
      source.onended = () => { source.disconnect(); filter.disconnect(); };
      source.start();
    } catch { /* Capture remains successful even when feedback cannot play. */ }
  }

  dispose(): void {
    this.#disposed = true;
    const context = this.#context;
    this.#context = null;
    if (context) void context.close().catch(() => {});
  }
}
