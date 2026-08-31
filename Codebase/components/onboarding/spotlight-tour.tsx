'use client'

import { useEffect, useState } from 'react'
import { Sparkles, X, ChevronRight } from 'lucide-react'
import { PillButton } from '@/components/ui/pill-button'

export interface TourStep {
  target: string
  title: string
  description: string
  placement?: 'bottom' | 'top' | 'left' | 'right'
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="library-panel"]',
    title: '12-Layer Component Library',
    description: 'Browse over 36 modular blocks spanning data collection, alpha signals, multi-agent debates, risk filters, and broker execution.',
    placement: 'right',
  },
  {
    target: '[data-tour="canvas"]',
    title: 'Interactive Visual Canvas',
    description: 'Connect typed input and output ports with Bézier curves to assemble powerful visual trading systems without boilerplate code.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="run-backtest"]',
    title: 'Multi-Engine Backtesting',
    description: 'Run instant Monte Carlo simulations, walk-forward optimizations, and A/B tests against high-frequency NSE market data.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="save-graph"]',
    title: 'Save & Strategy Snapshots',
    description: 'Save your strategy progress, version history, or package sub-graphs as reusable marketplace presets.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="credits-badge"]',
    title: 'Simulation Credits',
    description: 'Track simulation gas for heavy quant compute, Monte Carlo iterations, and paid block unlocks.',
    placement: 'bottom',
  },
]

export function SpotlightTour({
  onComplete,
  onSkip,
}: {
  onComplete: () => void
  onSkip: () => void
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null)

  const currentStep = TOUR_STEPS[stepIndex]

  useEffect(() => {
    const updateRect = () => {
      if (!currentStep) return
      const el = document.querySelector(currentStep.target)
      if (el) {
        const r = el.getBoundingClientRect()
        setRect({
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
        })
      } else {
        // fallback
        setRect({
          top: window.innerHeight / 2 - 100,
          left: window.innerWidth / 2 - 150,
          width: 300,
          height: 200,
        })
      }
    }

    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    const t = setTimeout(updateRect, 100)

    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
      clearTimeout(t)
    }
  }, [stepIndex, currentStep])

  const handleNext = () => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex((i) => i + 1)
    } else {
      onComplete()
    }
  }

  // Calculate tooltip position relative to target rect
  const tooltipStyle = (() => {
    if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }

    const pad = 12
    if (currentStep.placement === 'right') {
      return {
        top: Math.min(window.innerHeight - 240, Math.max(20, rect.top + 40)),
        left: rect.left + rect.width + pad,
      }
    }

    if (currentStep.placement === 'top') {
      return {
        top: Math.max(20, rect.top - 200),
        left: Math.min(window.innerWidth - 380, Math.max(20, rect.left)),
      }
    }

    // Default 'bottom'
    return {
      top: Math.min(window.innerHeight - 220, rect.top + rect.height + pad),
      left: Math.min(window.innerWidth - 380, Math.max(20, rect.left + (rect.width / 2) - 180)),
    }
  })()

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto">
      {/* Dark overlay with cutout spotlight */}
      <svg className="absolute inset-0 size-full pointer-events-none" width="100%" height="100%">
        <defs>
          <mask id="spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={Math.max(0, rect.left - 6)}
                y={Math.max(0, rect.top - 6)}
                width={rect.width + 12}
                height={rect.height + 12}
                rx="14"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.72)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Pulsing border highlight around target */}
      {rect && (
        <div
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
          className="absolute rounded-[14px] border-2 border-brand shadow-[0_0_24px_rgba(41,151,255,0.4)] pointer-events-none animate-pulse transition-all duration-300"
        />
      )}

      {/* Floating Tooltip Card */}
      <div
        style={tooltipStyle}
        className="fixed z-50 w-88 max-w-[calc(100vw-32px)] rounded-2xl border border-brand/40 bg-card/95 p-5 shadow-2xl backdrop-blur-2xl transition-all duration-300 animate-in fade-in zoom-in-95"
      >
        <div className="flex items-center justify-between gap-2 pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
            <Sparkles className="size-3.5" /> Step {stepIndex + 1} of {TOUR_STEPS.length}
          </div>
          <button
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            title="Skip tour"
          >
            <X className="size-4" />
          </button>
        </div>

        <h3 className="text-base font-bold text-foreground">{currentStep.title}</h3>
        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
          {currentStep.description}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip tour
          </button>

          <PillButton size="sm" onClick={handleNext} className="gap-1.5 shadow-md shadow-brand/20">
            <span>{stepIndex === TOUR_STEPS.length - 1 ? 'Finish Tour' : 'Next'}</span>
            <ChevronRight className="size-3.5" />
          </PillButton>
        </div>
      </div>
    </div>
  )
}
