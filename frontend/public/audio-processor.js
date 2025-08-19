/**
 * AudioWorklet processor for low-latency audio capture
 * 
 * This worklet runs on the audio thread for minimal latency
 * and sends audio chunks to the main thread for WebSocket transmission
 */
class AudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    
    // Configuration from main thread
    this.bufferSize = options.processorOptions?.bufferSize || 2048;
    this.sampleRate = options.processorOptions?.sampleRate || 16000;
    
    // Internal buffer for accumulating samples
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    
    // VAD (Voice Activity Detection) parameters
    this.vadThreshold = 0.01;
    this.isActive = false;
    this.isStarted = false;
    
    // Handle commands from main thread
    this.port.onmessage = (event) => {
      const { command } = event.data;
      console.log('AudioProcessor received command:', command);
      if (command === 'start') {
        this.isStarted = true;
        console.log('AudioProcessor started processing');
      } else if (command === 'stop') {
        this.isStarted = false;
        console.log('AudioProcessor stopped processing');
      }
    };
    
    console.log('AudioProcessor initialized:', {
      bufferSize: this.bufferSize,
      sampleRate: this.sampleRate
    });
  }

  process(inputs, outputs, parameters) {
    // Only process if started
    if (!this.isStarted) {
      return true;
    }
    
    const input = inputs[0];
    const output = outputs[0];
    
    // Handle case where no input is available
    if (!input || !input[0]) {
      return true;
    }
    
    const inputChannel = input[0]; // First channel (mono)
    
    // Pass through audio (required for worklet to keep processing)
    if (output && output[0]) {
      output[0].set(inputChannel);
    }
    
    // Process each sample
    for (let i = 0; i < inputChannel.length; i++) {
      this.buffer[this.bufferIndex] = inputChannel[i];
      this.bufferIndex++;
      
      // When buffer is full, send to main thread
      if (this.bufferIndex >= this.bufferSize) {
        // Calculate RMS energy for VAD
        const energy = this.calculateRMS(this.buffer);
        const hasVoice = energy > this.vadThreshold;
        
        // Debug: log every 10th chunk to avoid console spam
        if (this.chunkCount === undefined) this.chunkCount = 0;
        if (this.chunkCount++ % 10 === 0) {
          console.log('AudioProcessor sending chunk:', this.bufferSize, 'samples, energy:', energy.toFixed(4));
        }
        
        // Send audio data and VAD info to main thread
        this.port.postMessage({
          audioData: this.buffer.slice(), // Copy the buffer
          timestamp: performance.now(),
          energy: energy,
          hasVoice: hasVoice
        });
        
        // Reset buffer
        this.bufferIndex = 0;
        this.isActive = hasVoice;
      }
    }
    
    return true; // Keep processor alive
  }
  
  /**
   * Calculate RMS energy for voice activity detection
   */
  calculateRMS(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }
}

registerProcessor('audio-processor', AudioProcessor);