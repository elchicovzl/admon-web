"use client"

import { Component, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { HeroSceneFallback } from './hero-scene-fallback'

const HeroScene = dynamic(() => import('./hero-scene'), {
  ssr: false,
  loading: () => <HeroSceneFallback />,
})

/** Shows the static fallback when the scene (or its dynamic import) throws. */
class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.warn('[hero-3d] scene failed, using static fallback', error)
  }

  render() {
    return this.state.failed ? <HeroSceneFallback /> : this.props.children
  }
}

/** Client-only 3D hero scene with a fixed-size box and a static fallback. */
export function HeroSceneLazy() {
  return (
    <div className="h-[420px] w-full sm:h-[480px] lg:h-[560px]" aria-hidden="true">
      <SceneErrorBoundary>
        <HeroScene />
      </SceneErrorBoundary>
    </div>
  )
}
