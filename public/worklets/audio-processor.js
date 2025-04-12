class AudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sampleRate = options.processorOptions.sampleRate;
    this.bufferSize = options.processorOptions.bufferSize;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channel = input[0];
    let sum = 0;

    // Process audio data
    for (let i = 0; i < channel.length; i++) {
      // Fill buffer
      this.buffer[this.bufferIndex] = channel[i];
      this.bufferIndex = (this.bufferIndex + 1) % this.bufferSize;

      // Calculate audio level
      sum += Math.abs(channel[i]);
    }

    // Calculate average level
    const level = Math.min((sum / channel.length) * 100 * 5, 100);

    // When buffer is full, send it
    if (this.bufferIndex === 0) {
      // Convert float32 to int16
      const pcmData = new Int16Array(this.buffer.length);
      for (let i = 0; i < this.buffer.length; i++) {
        pcmData[i] = Math.max(-1, Math.min(1, this.buffer[i])) * 0x7FFF;
      }

      // Send data to main thread
      this.port.postMessage({
        pcmData: pcmData.buffer,
        level: level
      }, [pcmData.buffer]);
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor); 