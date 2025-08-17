'use client';

import React from 'react';

/**
 * LoadingSpinner - Provides loading indicators and progress feedback
 * 
 * Why: Shows loading states during async operations
 * Pattern: Presentational Component - pure UI for loading states
 * Rationale: Users need visual feedback during processing and loading
 */

interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  color?: 'primary' | 'secondary' | 'muted' | 'white';
  variant?: 'spinner' | 'dots' | 'pulse' | 'bars' | 'ring' | 'bounce';
  className?: string;
  label?: string;
  speed?: 'slow' | 'normal' | 'fast';
  overlay?: boolean;
}

export function LoadingSpinner({
  size = 'md',
  color = 'primary',
  variant = 'spinner',
  className = '',
  label,
  speed = 'normal',
  overlay = false
}: LoadingSpinnerProps) {
  const getSizeConfig = () => {
    switch (size) {
      case 'xs':
        return { width: 'w-3', height: 'h-3', text: 'text-xs' };
      case 'sm':
        return { width: 'w-4', height: 'h-4', text: 'text-sm' };
      case 'lg':
        return { width: 'w-8', height: 'h-8', text: 'text-lg' };
      case 'xl':
        return { width: 'w-12', height: 'h-12', text: 'text-xl' };
      default:
        return { width: 'w-6', height: 'h-6', text: 'text-base' };
    }
  };

  const getColorClass = () => {
    switch (color) {
      case 'primary':
        return 'text-primary border-primary';
      case 'secondary':
        return 'text-secondary border-secondary';
      case 'muted':
        return 'text-muted-foreground border-muted-foreground';
      case 'white':
        return 'text-white border-white';
      default:
        return 'text-primary border-primary';
    }
  };

  const getSpeedClass = () => {
    switch (speed) {
      case 'slow':
        return 'animate-[spin_2s_linear_infinite]';
      case 'fast':
        return 'animate-[spin_0.5s_linear_infinite]';
      default:
        return 'animate-spin';
    }
  };

  const sizeConfig = getSizeConfig();
  const colorClass = getColorClass();
  const speedClass = getSpeedClass();

  const renderSpinner = () => {
    switch (variant) {
      case 'dots':
        return (
          <div className="flex items-center space-x-1">
            <div className={`${sizeConfig.width} ${sizeConfig.height} bg-current rounded-full animate-bounce`} style={{ animationDelay: '0ms' }} />
            <div className={`${sizeConfig.width} ${sizeConfig.height} bg-current rounded-full animate-bounce`} style={{ animationDelay: '150ms' }} />
            <div className={`${sizeConfig.width} ${sizeConfig.height} bg-current rounded-full animate-bounce`} style={{ animationDelay: '300ms' }} />
          </div>
        );

      case 'pulse':
        return (
          <div className={`${sizeConfig.width} ${sizeConfig.height} bg-current rounded-full animate-pulse`} />
        );

      case 'bars':
        return (
          <div className="flex items-end space-x-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-1 bg-current rounded-full animate-pulse`}
                style={{
                  height: size === 'xs' ? '8px' : size === 'sm' ? '12px' : size === 'lg' ? '24px' : size === 'xl' ? '32px' : '16px',
                  animationDelay: `${i * 150}ms`,
                  animationDuration: '1s'
                }}
              />
            ))}
          </div>
        );

      case 'ring':
        return (
          <div 
            className={`${sizeConfig.width} ${sizeConfig.height} border-2 border-t-transparent rounded-full ${speedClass}`}
            style={{ borderColor: `currentColor transparent transparent transparent` }}
          />
        );

      case 'bounce':
        return (
          <div className={`${sizeConfig.width} ${sizeConfig.height} bg-current rounded-full animate-bounce`} />
        );

      default: // spinner
        return (
          <svg 
            className={`${sizeConfig.width} ${sizeConfig.height} ${speedClass}`} 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        );
    }
  };

  const content = (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`flex flex-col items-center space-y-2 ${colorClass}`}>
        {renderSpinner()}
        {label && (
          <span className={`${sizeConfig.text} font-medium`}>
            {label}
          </span>
        )}
      </div>
    </div>
  );

  if (overlay) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  return content;
}

/**
 * PageLoader - Full page loading spinner
 */
interface PageLoaderProps {
  label?: string;
  description?: string;
}

export function PageLoader({ 
  label = 'Loading...', 
  description 
}: PageLoaderProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <LoadingSpinner size="xl" variant="spinner" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">{label}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * InlineLoader - Small inline loading indicator
 */
interface InlineLoaderProps {
  text?: string;
  size?: 'xs' | 'sm';
  variant?: 'spinner' | 'dots';
}

export function InlineLoader({ 
  text = 'Loading...', 
  size = 'sm',
  variant = 'spinner' 
}: InlineLoaderProps) {
  return (
    <div className="flex items-center space-x-2">
      <LoadingSpinner size={size} variant={variant} />
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  );
}

/**
 * ButtonLoader - Loading state for buttons
 */
interface ButtonLoaderProps {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  size?: 'xs' | 'sm';
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}

export function ButtonLoader({
  isLoading,
  children,
  loadingText = 'Loading...',
  size = 'sm',
  disabled = false,
  className = '',
  onClick
}: ButtonLoaderProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        flex items-center justify-center space-x-2 
        disabled:opacity-50 disabled:cursor-not-allowed 
        transition-all duration-200
        ${className}
      `}
    >
      {isLoading ? (
        <>
          <LoadingSpinner size={size} variant="spinner" color="white" />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * ProgressSpinner - Spinner with progress indication
 */
interface ProgressSpinnerProps {
  progress: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  color?: 'primary' | 'secondary';
  className?: string;
}

export function ProgressSpinner({
  progress,
  size = 'md',
  showPercentage = true,
  color = 'primary',
  className = ''
}: ProgressSpinnerProps) {
  const normalizedProgress = Math.min(Math.max(progress, 0), 100);
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (normalizedProgress / 100) * circumference;

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return { container: 'w-12 h-12', text: 'text-xs' };
      case 'lg':
        return { container: 'w-20 h-20', text: 'text-base' };
      default:
        return { container: 'w-16 h-16', text: 'text-sm' };
    }
  };

  const getColorClass = () => {
    return color === 'primary' ? 'text-primary' : 'text-secondary';
  };

  const sizeClasses = getSizeClasses();

  return (
    <div className={`relative ${sizeClasses.container} ${className}`}>
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          className="text-muted/20"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          className={getColorClass()}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: strokeDashoffset,
            transition: 'stroke-dashoffset 0.3s ease'
          }}
        />
      </svg>
      
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-semibold ${sizeClasses.text} ${getColorClass()}`}>
            {Math.round(normalizedProgress)}%
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * SkeletonLoader - Skeleton loading placeholders
 */
interface SkeletonLoaderProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular' | 'avatar';
  width?: string;
  height?: string;
  lines?: number;
}

export function SkeletonLoader({
  className = '',
  variant = 'text',
  width,
  height,
  lines = 1
}: SkeletonLoaderProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'rectangular':
        return 'rounded-md';
      case 'circular':
        return 'rounded-full';
      case 'avatar':
        return 'rounded-full w-10 h-10';
      default:
        return 'rounded h-4';
    }
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="bg-muted animate-pulse rounded h-4"
            style={{
              width: i === lines - 1 ? '60%' : width || '100%'
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`bg-muted animate-pulse ${getVariantClasses()} ${className}`}
      style={{
        width: width,
        height: height
      }}
    />
  );
}