import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { 
  LoadingSpinner, 
  PageLoader, 
  InlineLoader, 
  ButtonLoader, 
  ProgressSpinner, 
  SkeletonLoader 
} from '../LoadingSpinner';

/**
 * Test suite for LoadingSpinner components
 * 
 * Tests loading indicators, progress display, and skeleton placeholders
 * Rationale: Ensures proper loading feedback across different UI contexts
 */

describe('LoadingSpinner', () => {
  describe('basic rendering', () => {
    it('should render default spinner correctly', () => {
      render(<LoadingSpinner />);

      const spinner = document.querySelector('svg');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass('animate-spin');
    });

    it('should render with label', () => {
      render(<LoadingSpinner label="Loading data..." />);

      expect(screen.getByText('Loading data...')).toBeInTheDocument();
    });

    it('should render without label', () => {
      render(<LoadingSpinner />);

      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });
  });

  describe('size variations', () => {
    it('should render extra small size', () => {
      render(<LoadingSpinner size="xs" />);

      const spinner = document.querySelector('svg');
      expect(spinner).toHaveClass('w-3', 'h-3');
    });

    it('should render small size', () => {
      render(<LoadingSpinner size="sm" />);

      const spinner = document.querySelector('svg');
      expect(spinner).toHaveClass('w-4', 'h-4');
    });

    it('should render medium size (default)', () => {
      render(<LoadingSpinner size="md" />);

      const spinner = document.querySelector('svg');
      expect(spinner).toHaveClass('w-6', 'h-6');
    });

    it('should render large size', () => {
      render(<LoadingSpinner size="lg" />);

      const spinner = document.querySelector('svg');
      expect(spinner).toHaveClass('w-8', 'h-8');
    });

    it('should render extra large size', () => {
      render(<LoadingSpinner size="xl" />);

      const spinner = document.querySelector('svg');
      expect(spinner).toHaveClass('w-12', 'h-12');
    });
  });

  describe('color variations', () => {
    it('should render primary color (default)', () => {
      render(<LoadingSpinner color="primary" />);

      const container = document.querySelector('.text-primary');
      expect(container).toBeInTheDocument();
    });

    it('should render secondary color', () => {
      render(<LoadingSpinner color="secondary" />);

      const container = document.querySelector('.text-secondary');
      expect(container).toBeInTheDocument();
    });

    it('should render muted color', () => {
      render(<LoadingSpinner color="muted" />);

      const container = document.querySelector('.text-muted-foreground');
      expect(container).toBeInTheDocument();
    });

    it('should render white color', () => {
      render(<LoadingSpinner color="white" />);

      const container = document.querySelector('.text-white');
      expect(container).toBeInTheDocument();
    });
  });

  describe('variant styles', () => {
    it('should render spinner variant (default)', () => {
      render(<LoadingSpinner variant="spinner" />);

      const spinner = document.querySelector('svg');
      expect(spinner).toBeInTheDocument();
    });

    it('should render dots variant', () => {
      render(<LoadingSpinner variant="dots" />);

      const dots = document.querySelectorAll('.animate-bounce');
      expect(dots).toHaveLength(3);
    });

    it('should render pulse variant', () => {
      render(<LoadingSpinner variant="pulse" />);

      const pulse = document.querySelector('.animate-pulse');
      expect(pulse).toBeInTheDocument();
    });

    it('should render bars variant', () => {
      render(<LoadingSpinner variant="bars" />);

      const bars = document.querySelectorAll('.animate-pulse');
      expect(bars).toHaveLength(4);
    });

    it('should render ring variant', () => {
      render(<LoadingSpinner variant="ring" />);

      const ring = document.querySelector('.border-t-transparent');
      expect(ring).toBeInTheDocument();
      expect(ring).toHaveClass('animate-spin');
    });

    it('should render bounce variant', () => {
      render(<LoadingSpinner variant="bounce" />);

      const bounce = document.querySelector('.animate-bounce');
      expect(bounce).toBeInTheDocument();
    });
  });

  describe('speed variations', () => {
    it('should render normal speed (default)', () => {
      render(<LoadingSpinner speed="normal" />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should render slow speed', () => {
      render(<LoadingSpinner speed="slow" />);

      const spinner = document.querySelector('[class*="animate-[spin_2s_linear_infinite]"]');
      expect(spinner).toBeInTheDocument();
    });

    it('should render fast speed', () => {
      render(<LoadingSpinner speed="fast" />);

      const spinner = document.querySelector('[class*="animate-[spin_0.5s_linear_infinite]"]');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('overlay functionality', () => {
    it('should render as overlay when specified', () => {
      render(<LoadingSpinner overlay={true} />);

      const overlay = document.querySelector('.fixed.inset-0');
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveClass('bg-background/80', 'backdrop-blur-sm', 'z-50');
    });

    it('should not render as overlay by default', () => {
      render(<LoadingSpinner />);

      const overlay = document.querySelector('.fixed.inset-0');
      expect(overlay).not.toBeInTheDocument();
    });
  });
});

describe('PageLoader', () => {
  it('should render with default label', () => {
    render(<PageLoader />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render with custom label', () => {
    render(<PageLoader label="Please wait..." />);

    expect(screen.getByText('Please wait...')).toBeInTheDocument();
  });

  it('should render with description', () => {
    render(<PageLoader label="Loading" description="Fetching your data" />);

    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.getByText('Fetching your data')).toBeInTheDocument();
  });

  it('should render with full screen layout', () => {
    render(<PageLoader />);

    const container = screen.getByText('Loading...').closest('div');
    expect(container).toHaveClass('min-h-screen', 'flex', 'items-center', 'justify-center');
  });

  it('should render extra large spinner', () => {
    render(<PageLoader />);

    const spinner = document.querySelector('svg');
    expect(spinner).toHaveClass('w-12', 'h-12');
  });
});

describe('InlineLoader', () => {
  it('should render with default text', () => {
    render(<InlineLoader />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render with custom text', () => {
    render(<InlineLoader text="Processing..." />);

    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('should render small size by default', () => {
    render(<InlineLoader />);

    const spinner = document.querySelector('svg');
    expect(spinner).toHaveClass('w-4', 'h-4');
  });

  it('should render extra small size when specified', () => {
    render(<InlineLoader size="xs" />);

    const spinner = document.querySelector('svg');
    expect(spinner).toHaveClass('w-3', 'h-3');
  });

  it('should render spinner variant by default', () => {
    render(<InlineLoader />);

    const spinner = document.querySelector('svg');
    expect(spinner).toBeInTheDocument();
  });

  it('should render dots variant when specified', () => {
    render(<InlineLoader variant="dots" />);

    const dots = document.querySelectorAll('.animate-bounce');
    expect(dots).toHaveLength(3);
  });
});

describe('ButtonLoader', () => {
  const mockOnClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render children when not loading', () => {
    render(
      <ButtonLoader isLoading={false} onClick={mockOnClick}>
        <span>Submit</span>
      </ButtonLoader>
    );

    expect(screen.getByText('Submit')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('should render loading state when loading', () => {
    render(
      <ButtonLoader isLoading={true} onClick={mockOnClick}>
        <span>Submit</span>
      </ButtonLoader>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Submit')).not.toBeInTheDocument();
  });

  it('should render custom loading text', () => {
    render(
      <ButtonLoader isLoading={true} loadingText="Submitting..." onClick={mockOnClick}>
        <span>Submit</span>
      </ButtonLoader>
    );

    expect(screen.getByText('Submitting...')).toBeInTheDocument();
  });

  it('should be disabled when loading', () => {
    render(
      <ButtonLoader isLoading={true} onClick={mockOnClick}>
        <span>Submit</span>
      </ButtonLoader>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should be disabled when explicitly disabled', () => {
    render(
      <ButtonLoader isLoading={false} disabled={true} onClick={mockOnClick}>
        <span>Submit</span>
      </ButtonLoader>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should call onClick when clicked and not loading', () => {
    render(
      <ButtonLoader isLoading={false} onClick={mockOnClick}>
        <span>Submit</span>
      </ButtonLoader>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when loading', () => {
    render(
      <ButtonLoader isLoading={true} onClick={mockOnClick}>
        <span>Submit</span>
      </ButtonLoader>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('should render small spinner by default', () => {
    render(
      <ButtonLoader isLoading={true} onClick={mockOnClick}>
        <span>Submit</span>
      </ButtonLoader>
    );

    const spinner = document.querySelector('svg');
    expect(spinner).toHaveClass('w-4', 'h-4');
  });

  it('should render extra small spinner when specified', () => {
    render(
      <ButtonLoader isLoading={true} size="xs" onClick={mockOnClick}>
        <span>Submit</span>
      </ButtonLoader>
    );

    const spinner = document.querySelector('svg');
    expect(spinner).toHaveClass('w-3', 'h-3');
  });
});

describe('ProgressSpinner', () => {
  it('should render with progress value', () => {
    render(<ProgressSpinner progress={75} />);

    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('should hide percentage when disabled', () => {
    render(<ProgressSpinner progress={50} showPercentage={false} />);

    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });

  it('should render medium size by default', () => {
    render(<ProgressSpinner progress={50} />);

    const container = document.querySelector('.w-16.h-16');
    expect(container).toBeInTheDocument();
  });

  it('should render small size when specified', () => {
    render(<ProgressSpinner progress={50} size="sm" />);

    const container = document.querySelector('.w-12.h-12');
    expect(container).toBeInTheDocument();
  });

  it('should render large size when specified', () => {
    render(<ProgressSpinner progress={50} size="lg" />);

    const container = document.querySelector('.w-20.h-20');
    expect(container).toBeInTheDocument();
  });

  it('should handle progress value clamping', () => {
    render(<ProgressSpinner progress={150} />);

    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('should handle negative progress values', () => {
    render(<ProgressSpinner progress={-10} />);

    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should render primary color by default', () => {
    render(<ProgressSpinner progress={50} />);

    const progressCircle = document.querySelector('.text-primary');
    expect(progressCircle).toBeInTheDocument();
  });

  it('should render secondary color when specified', () => {
    render(<ProgressSpinner progress={50} color="secondary" />);

    const progressCircle = document.querySelector('.text-secondary');
    expect(progressCircle).toBeInTheDocument();
  });
});

describe('SkeletonLoader', () => {
  it('should render text skeleton by default', () => {
    render(<SkeletonLoader />);

    const skeleton = document.querySelector('.bg-muted.animate-pulse.rounded.h-4');
    expect(skeleton).toBeInTheDocument();
  });

  it('should render rectangular skeleton', () => {
    render(<SkeletonLoader variant="rectangular" />);

    const skeleton = document.querySelector('.rounded-md');
    expect(skeleton).toBeInTheDocument();
  });

  it('should render circular skeleton', () => {
    render(<SkeletonLoader variant="circular" />);

    const skeleton = document.querySelector('.rounded-full');
    expect(skeleton).toBeInTheDocument();
  });

  it('should render avatar skeleton with fixed size', () => {
    render(<SkeletonLoader variant="avatar" />);

    const skeleton = document.querySelector('.rounded-full.w-10.h-10');
    expect(skeleton).toBeInTheDocument();
  });

  it('should render multiple text lines', () => {
    render(<SkeletonLoader variant="text" lines={3} />);

    const skeletons = document.querySelectorAll('.bg-muted.animate-pulse');
    expect(skeletons).toHaveLength(3);
  });

  it('should render with custom width', () => {
    render(<SkeletonLoader width="200px" />);

    const skeleton = document.querySelector('[style*="width: 200px"]');
    expect(skeleton).toBeInTheDocument();
  });

  it('should render with custom height', () => {
    render(<SkeletonLoader height="100px" />);

    const skeleton = document.querySelector('[style*="height: 100px"]');
    expect(skeleton).toBeInTheDocument();
  });

  it('should render last line shorter for multi-line text', () => {
    render(<SkeletonLoader variant="text" lines={2} />);

    const skeletons = document.querySelectorAll('.bg-muted.animate-pulse');
    expect(skeletons).toHaveLength(2);
    
    // Last line should have 60% width
    const lastLine = skeletons[skeletons.length - 1] as HTMLElement;
    expect(lastLine.style.width).toBe('60%');
  });
});