class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunkSize = 1600; // 100ms at 16kHz
    this.buffer = [];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    if (input.length > 0) {
      const inputChannel = input[0];
      
      // Add samples to buffer
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer.push(inputChannel[i]);
        
        // When buffer reaches chunk size, send it
        if (this.buffer.length >= this.chunkSize) {
          const audioData = new Float32Array(this.buffer);
          this.port.postMessage({
            type: 'audio-data',
            audioData: audioData
          });
          
          this.buffer = [];
        }
      }
    }
    
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);