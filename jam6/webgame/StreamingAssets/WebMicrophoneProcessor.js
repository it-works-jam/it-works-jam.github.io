class WebMicrophoneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._chunkSize = 1024;
    this._chunk = new Float32Array(this._chunkSize);
    this._offset = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const mono = input[0];
    let sourceOffset = 0;
    while (sourceOffset < mono.length) {
      const count = Math.min(mono.length - sourceOffset, this._chunkSize - this._offset);
      this._chunk.set(mono.subarray(sourceOffset, sourceOffset + count), this._offset);
      this._offset += count;
      sourceOffset += count;

      if (this._offset === this._chunkSize) {
        this.port.postMessage(this._chunk, [this._chunk.buffer]);
        this._chunk = new Float32Array(this._chunkSize);
        this._offset = 0;
      }
    }

    return true;
  }
}

registerProcessor('web-microphone-processor', WebMicrophoneProcessor);
