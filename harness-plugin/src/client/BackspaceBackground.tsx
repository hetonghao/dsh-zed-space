/** Native background renderer registered into the layout-owned background slot. */
import { useEffect, useRef } from 'react'
import type { PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { createBackspaceStore, BackspaceState } from './store.ts'
import css from './BackspaceBackground.module.css'

const FRAME_ID = '__dsh-backspace__'

function source(state: BackspaceState): string {
  const query = new URLSearchParams({
    skin: '1',
    sea: String(state.sea),
    t: String(state.time),
    auto: state.autoCycle ? '1' : '0',
    quality: state.quality,
    parentOrigin: location.origin,
  })
  return `/dsh-zed-space/skin.html?${query}`
}

/** Props derived from the layout slot and shared Backspace store. */
export type BackspaceBackgroundProps =
  PropsRuntime<'shell.background'> & PropsStore<ReturnType<typeof createBackspaceStore>>

/**
 * Render the same-origin Backspace scene beneath the Harness columns.
 * @param props - composed slot props.
 * @returns the background iframe or null while disabled/duplicated.
 */
export function BackspaceBackground({ useStore }: BackspaceBackgroundProps) {
  const state = useStore(snapshot => snapshot)
  const frame = useRef<HTMLIFrameElement | null>(null)
  const ownsSurface = useRef(document.getElementById(FRAME_ID) === null)
  const initialSrc = useRef<string | null>(null)
  const lastQuality = useRef(state.quality)

  if (state.ready && initialSrc.current === null) {
    initialSrc.current = source(state)
  }

  useEffect(() => {
    if (!state.ready || !state.enabled) return
    frame.current?.contentWindow?.postMessage({
      type: 'bs-set',
      sea: state.sea,
      t: state.time,
      auto: state.autoCycle,
    }, location.origin)
  }, [state.autoCycle, state.enabled, state.ready, state.sea, state.time])

  useEffect(() => {
    if (!state.ready || state.quality === lastQuality.current) return
    lastQuality.current = state.quality
    initialSrc.current = source(state)
    if (frame.current) frame.current.src = initialSrc.current
  }, [state])

  if (!ownsSurface.current || !state.ready || !state.enabled || initialSrc.current === null) return null
  return (
    <div className={css.background} aria-hidden="true">
      <iframe
        ref={frame}
        id={FRAME_ID}
        className={css.frame}
        src={initialSrc.current}
        tabIndex={-1}
        title=""
      />
    </div>
  )
}
