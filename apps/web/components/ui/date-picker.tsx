'use client'

import { useState, useRef, useEffect } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value: string // YYYY-MM-DD
  onChange: (date: string) => void
  minDate?: string // YYYY-MM-DD
  maxDate?: string // YYYY-MM-DD
  label?: string
}

export function DatePicker({ value, onChange, minDate, maxDate, label }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Parse initial view date
  const parsedDate = value ? new Date(value + 'T00:00:00') : new Date()
  const [viewYear, setViewYear] = useState(parsedDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsedDate.getMonth())

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00')
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear())
        setViewMonth(d.getMonth())
      }
    }
  }, [value])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const isDateDisabled = (day: number) => {
    const dStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    if (minDate && dStr < minDate) return true
    if (maxDate && dStr > maxDate) return true
    return false
  }

  const handleSelectDay = (day: number) => {
    if (isDateDisabled(day)) return
    const dStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onChange(dStr)
    setIsOpen(false)
  }

  const formatDisplay = (dStr: string) => {
    if (!dStr) return 'Select date'
    const d = new Date(dStr + 'T00:00:00')
    if (isNaN(d.getTime())) return dStr
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="relative w-full" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 text-xs text-foreground transition-all hover:bg-secondary/70 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand',
          isOpen && 'border-brand ring-1 ring-brand'
        )}
      >
        <span className="flex items-center gap-2 font-medium">
          <CalendarIcon className="size-3.5 text-brand" />
          {formatDisplay(value)}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">{value}</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-border bg-card p-3 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-border mb-2">
            <span className="text-xs font-semibold text-foreground">
              {monthNames[viewMonth]} {viewYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground mb-1">
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Empty offset padding */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="size-7" />
            ))}

            {/* Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isSelected = value === dStr
              const disabled = isDateDisabled(day)

              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleSelectDay(day)}
                  className={cn(
                    'size-7 rounded-md text-xs font-medium transition-all flex items-center justify-center',
                    disabled && 'text-muted-foreground/30 cursor-not-allowed opacity-30',
                    !disabled && !isSelected && 'text-foreground hover:bg-brand/20 hover:text-brand',
                    isSelected && 'bg-brand text-black font-semibold shadow-sm'
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
