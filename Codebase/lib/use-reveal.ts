'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

let registered = false
function ensureGsap() {
  if (!registered && typeof window !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger)
    registered = true
  }
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Staggered fade + rise for children matching `selector`, fired once when the
 * container reaches 80% of the viewport. With reduced motion we skip the
 * transform and just resolve opacity so nothing is left invisible.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  selector = '[data-reveal]',
  opts: { stagger?: number; y?: number; start?: string; duration?: number } = {},
) {
  const ref = useRef<T | null>(null)
  const { stagger = 0.07, y = 28, start = 'top 80%', duration = 0.8 } = opts

  useEffect(() => {
    const el = ref.current
    if (!el) return
    ensureGsap()

    const targets = el.querySelectorAll(selector)
    if (!targets.length) return

    if (prefersReducedMotion()) {
      gsap.set(targets, { opacity: 1, y: 0 })
      return
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y, filter: 'blur(6px)' },
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration,
          stagger,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start, once: true },
        },
      )
    }, el)

    return () => ctx.revert()
  }, [selector, stagger, y, start, duration])

  return ref
}

/** Counts a number up from 0 when it scrolls into view. */
export function useCountUp(target: number, duration = 1.8) {
  const ref = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    ensureGsap()

    const write = (v: number) => {
      el.textContent = Math.round(v).toLocaleString('en-IN')
    }

    if (prefersReducedMotion()) {
      write(target)
      return
    }

    const obj = { v: 0 }
    const ctx = gsap.context(() => {
      gsap.to(obj, {
        v: target,
        duration,
        ease: 'power2.out',
        onUpdate: () => write(obj.v),
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      })
    }, el)

    return () => ctx.revert()
  }, [target, duration])

  return ref
}

export { gsap, ScrollTrigger, ensureGsap }
