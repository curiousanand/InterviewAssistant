'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * MicrophoneVisualizer - Displays audio waveform visualization
 * 
 * Why: Provides visual feedback for audio recording and levels
 * Pattern: Presentational Component - renders audio data visually
 * Rationale: Users need visual confirmation that audio is being captured
 */

interface MicrophoneVisualizerProps {
  isRecording: boolean;
  audioLevel: number; // 0-1 range
  className?: string;
  style?: 'bars' | 'waveform' | 'circle' | 'pulse';
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  sensitivity?: number;
  showLevel?: boolean;
  animated?: boolean;
}

export function MicrophoneVisualizer({
  isRecording,
  audioLevel,
  className = '',
  style = 'bars',
  size = 'md',
  color = 'primary',
  sensitivity = 1,
  showLevel = false,
  animated = true
}: MicrophoneVisualizerProps) {
  const [animationFrame, setAnimationFrame] = useState(0);
  const [levelHistory, setLevelHistory] = useState<number[]>([]);
  const animationRef = useRef<number>();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Update level history for waveform
  useEffect(() => {
    if (isRecording) {
      setLevelHistory(prev => {
        const newHistory = [...prev, Math.min(audioLevel * sensitivity, 1)];
        return newHistory.slice(-50); // Keep last 50 samples
      });
    } else {
      setLevelHistory([]);
    }
  }, [audioLevel, isRecording, sensitivity]);

  // Animation loop
  useEffect(() => {
    if (animated && isRecording) {
      const animate = () => {
        setAnimationFrame(prev => prev + 1);
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animated, isRecording]);

  const getSizeConfig = () => {
    switch (size) {
      case 'sm':
        return { width: 120, height: 32, barCount: 8 };
      case 'lg':
        return { width: 300, height: 80, barCount: 20 };
      default:
        return { width: 200, height: 48, barCount: 12 };
    }
  };

  const getColorClass = () => {
    switch (color) {
      case 'primary':
        return isRecording ? 'fill-primary' : 'fill-muted-foreground/30';
      case 'green':
        return isRecording ? 'fill-green-500' : 'fill-muted-foreground/30';
      case 'red':
        return isRecording ? 'fill-red-500' : 'fill-muted-foreground/30';
      case 'blue':
        return isRecording ? 'fill-blue-500' : 'fill-muted-foreground/30';
      default:
        return isRecording ? 'fill-primary' : 'fill-muted-foreground/30';
    }
  };

  const { width, height, barCount } = getSizeConfig();
  const adjustedLevel = Math.min(audioLevel * sensitivity, 1);

  if (style === 'bars') {
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        <div className="flex items-end space-x-1" style={{ width, height }}>
          {Array.from({ length: barCount }).map((_, i) => {
            const barHeight = isRecording 
              ? Math.max(2, (adjustedLevel + Math.sin((animationFrame + i * 10) * 0.1) * 0.3) * height)
              : Math.max(2, Math.random() * height * 0.3);
            
            return (
              <div
                key={i}
                className={`
                  w-2 rounded-t transition-all duration-100
                  ${getColorClass().replace('fill-', 'bg-')}
                  ${isRecording ? 'opacity-100' : 'opacity-30'}
                `}
                style={{
                  height: Math.max(2, Math.min(barHeight, height)),
                  animationDelay: `${i * 50}ms`
                }}
              />
            );
          })}
        </div>
        
        {showLevel && (
          <div className="ml-3 text-sm text-muted-foreground">
            {Math.round(adjustedLevel * 100)}%
          </div>
        )}
      </div>
    );
  }

  if (style === 'waveform') {
    return (
      <div className={`flex items-center ${className}`}>
        <svg width={width} height={height} className="overflow-visible">
          <path
            d={generateWaveformPath(levelHistory, width, height)}
            className={`${getColorClass()} stroke-current stroke-2 fill-none`}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        
        {showLevel && (
          <div className="ml-3 text-sm text-muted-foreground">
            {Math.round(adjustedLevel * 100)}%
          </div>
        )}
      </div>
    );
  }

  if (style === 'circle') {
    const radius = Math.min(width, height) / 2 - 4;
    const centerX = width / 2;
    const centerY = height / 2;
    const levelRadius = radius * adjustedLevel;

    return (
      <div className={`flex items-center ${className}`}>
        <svg width={width} height={height}>
          {/* Outer circle */}
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            className="fill-none stroke-muted-foreground/30 stroke-2"
          />
          
          {/* Level circle */}
          <circle
            cx={centerX}
            cy={centerY}
            r={levelRadius}
            className={`${getColorClass()} transition-all duration-100`}
            opacity={isRecording ? 0.8 : 0.3}
          />
          
          {/* Animated rings */}
          {isRecording && animated && (
            <>
              <circle
                cx={centerX}
                cy={centerY}
                r={radius * 0.7}
                className={`fill-none stroke-current opacity-50`}
                strokeWidth="1"
                style={{
                  animation: 'pulse 2s ease-in-out infinite',
                  color: getColorClass().includes('primary') ? 'hsl(var(--primary))' : color
                }}
              />
              <circle
                cx={centerX}
                cy={centerY}
                r={radius * 0.4}
                className={`fill-none stroke-current opacity-30`}
                strokeWidth="1"
                style={{
                  animation: 'pulse 2s ease-in-out infinite 0.5s',
                  color: getColorClass().includes('primary') ? 'hsl(var(--primary))' : color
                }}
              />
            </>
          )}
        </svg>
        
        {showLevel && (
          <div className="ml-3 text-sm text-muted-foreground">
            {Math.round(adjustedLevel * 100)}%
          </div>
        )}
      </div>
    );
  }

  if (style === 'pulse') {
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <div 
          className="relative flex items-center justify-center"
          style={{ width, height }}
        >
          {/* Main pulse */}
          <div
            className={`
              rounded-full transition-all duration-200
              ${getColorClass().replace('fill-', 'bg-')}
              ${isRecording ? 'opacity-100' : 'opacity-30'}
            `}
            style={{
              width: 16 + (adjustedLevel * 32),
              height: 16 + (adjustedLevel * 32)
            }}
          />
          
          {/* Animated rings */}
          {isRecording && animated && (
            <>
              <div
                className={`
                  absolute rounded-full border-2
                  ${getColorClass().replace('fill-', 'border-')}
                  animate-ping opacity-40
                `}
                style={{
                  width: 24 + (adjustedLevel * 48),
                  height: 24 + (adjustedLevel * 48)
                }}
              />
              <div
                className={`
                  absolute rounded-full border
                  ${getColorClass().replace('fill-', 'border-')}
                  animate-pulse opacity-20
                `}
                style={{
                  width: 32 + (adjustedLevel * 64),
                  height: 32 + (adjustedLevel * 64)
                }}
              />
            </>
          )}
        </div>
        
        {showLevel && (
          <div className="text-sm text-muted-foreground">
            {Math.round(adjustedLevel * 100)}%
          </div>
        )}
      </div>
    );
  }

  return null;
}

/**
 * WaveformCanvas - Advanced canvas-based waveform visualization
 */
interface WaveformCanvasProps {
  audioData: Float32Array | null;
  isRecording: boolean;
  className?: string;
  width?: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
}

export function WaveformCanvas({
  audioData,
  isRecording,
  className = '',
  width = 300,
  height = 100,
  color = '#3b82f6',
  backgroundColor = '#f1f5f9'
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw waveform
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const sliceWidth = width / audioData.length;
    let x = 0;

    for (let i = 0; i < audioData.length; i++) {
      const v = audioData[i] * 0.5; // Scale down
      const y = (v * height / 2) + (height / 2);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();

    // Add center line
    ctx.strokeStyle = isRecording ? color : '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [audioData, isRecording, width, height, color, backgroundColor]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`border border-border rounded ${className}`}
    />
  );
}

/**
 * VoiceActivityIndicator - Shows voice activity detection
 */
interface VoiceActivityIndicatorProps {
  isVoiceActive: boolean;
  confidence: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function VoiceActivityIndicator({
  isVoiceActive,
  confidence,
  className = '',
  size = 'md'
}: VoiceActivityIndicatorProps) {
  const getSizeClass = () => {
    switch (size) {
      case 'sm':
        return 'w-6 h-6 text-xs';
      case 'lg':
        return 'w-12 h-12 text-lg';
      default:
        return 'w-8 h-8 text-sm';
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div
        className={`
          ${getSizeClass()} rounded-full flex items-center justify-center font-medium transition-colors
          ${isVoiceActive 
            ? 'bg-green-500 text-white' 
            : 'bg-gray-200 text-gray-500'
          }
        `}
        title={`Voice Activity: ${isVoiceActive ? 'Active' : 'Inactive'} (${Math.round(confidence * 100)}%)`}
      >
        {isVoiceActive ? '🗣️' : '🤫'}
      </div>
      
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">
          {isVoiceActive ? 'Voice Active' : 'No Voice'}
        </span>
        <span className="text-xs text-muted-foreground">
          {Math.round(confidence * 100)}%
        </span>
      </div>
    </div>
  );
}

/**
 * AudioLevelMeter - Simple audio level meter
 */
interface AudioLevelMeterProps {
  level: number;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  showValue?: boolean;
  threshold?: number;
}

export function AudioLevelMeter({
  level,
  className = '',
  orientation = 'horizontal',
  showValue = true,
  threshold = 0.7
}: AudioLevelMeterProps) {
  const isVertical = orientation === 'vertical';
  const normalizedLevel = Math.min(Math.max(level, 0), 1);
  const isOverThreshold = normalizedLevel > threshold;

  return (
    <div className={`flex ${isVertical ? 'flex-col items-center' : 'items-center space-x-3'} ${className}`}>
      <div 
        className={`
          bg-gray-200 rounded-full relative overflow-hidden
          ${isVertical ? 'w-4 h-24' : 'w-24 h-4'}
        `}
      >
        <div
          className={`
            absolute transition-all duration-100 rounded-full
            ${isOverThreshold ? 'bg-red-500' : 'bg-green-500'}
            ${isVertical ? 'bottom-0 left-0 right-0' : 'top-0 left-0 bottom-0'}
          `}
          style={{
            [isVertical ? 'height' : 'width']: `${normalizedLevel * 100}%`
          }}
        />
      </div>
      
      {showValue && (
        <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
          {Math.round(normalizedLevel * 100)}%
        </span>
      )}
    </div>
  );
}

// Utility function to generate waveform path
function generateWaveformPath(data: number[], width: number, height: number): string {
  if (data.length === 0) return `M 0 ${height / 2}`;

  const step = width / Math.max(data.length - 1, 1);
  const centerY = height / 2;

  let path = `M 0 ${centerY - data[0] * centerY}`;

  for (let i = 1; i < data.length; i++) {
    const x = i * step;
    const y = centerY - data[i] * centerY;
    path += ` L ${x} ${y}`;
  }

  return path;
}