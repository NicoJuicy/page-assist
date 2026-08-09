import { useRef, useEffect, useState, useCallback } from "react"

export const useSmartScroll = (
  messages: any[],
  streaming: boolean,
  threshold: number = 100,
  resetKey?: string | null
) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true)
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const programmaticResetTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const lastScrollTop = useRef(0)
  const lastScrollHeight = useRef(0)
  const isScrollingProgrammatically = useRef(false)
  const isUserDragging = useRef(false)
  const previousResetKey = useRef<string | null | undefined>(resetKey)
  const pendingResetScroll = useRef(false)

  const isAtBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return false

    const { scrollTop, scrollHeight, clientHeight } = container
    return scrollHeight - scrollTop - clientHeight <= threshold
  }, [threshold])

  const scrollToBottom = useCallback((smooth: boolean = false) => {
    const container = containerRef.current
    if (!container) return

    isScrollingProgrammatically.current = true

    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? "smooth" : "auto"
    })

    lastScrollTop.current = container.scrollTop
    lastScrollHeight.current = container.scrollHeight

    if (programmaticResetTimeout.current) {
      clearTimeout(programmaticResetTimeout.current)
    }
    programmaticResetTimeout.current = setTimeout(
      () => {
        isScrollingProgrammatically.current = false
      },
      smooth ? 300 : 50
    )
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      // Programmatic scrolls must not disable auto-scroll, but scrollbar
      // drags fire the same event, so let them through while the mouse is down
      if (isScrollingProgrammatically.current && !isUserDragging.current) return

      const { scrollTop, scrollHeight } = container
      const isScrollingUp = scrollTop < lastScrollTop.current

      lastScrollTop.current = scrollTop
      lastScrollHeight.current = scrollHeight

      if (isScrollingUp) {
        setIsAutoScrollEnabled(false)
      }

      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current)
      }

      scrollTimeout.current = setTimeout(() => {
        if (isAtBottom()) {
          setIsAutoScrollEnabled(true)
        }
      }, 300)
    }

    // During streaming, programmatic scrolls fire faster than the suppression
    // flag resets, so `scroll` events alone never see the user's scroll-up.
    // Wheel/touch events are only produced by real user input, so they are a
    // reliable signal to stop following the stream.
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        setIsAutoScrollEnabled(false)
      }
    }

    let lastTouchY = 0
    const handleTouchStart = (e: TouchEvent) => {
      lastTouchY = e.touches[0]?.clientY ?? 0
    }
    const handleTouchMove = (e: TouchEvent) => {
      const touchY = e.touches[0]?.clientY ?? 0
      if (touchY > lastTouchY) {
        setIsAutoScrollEnabled(false)
      }
      lastTouchY = touchY
    }

    const handleMouseDown = () => {
      isUserDragging.current = true
    }
    const handleMouseUp = () => {
      isUserDragging.current = false
    }

    container.addEventListener("scroll", handleScroll, { passive: true })
    container.addEventListener("wheel", handleWheel, { passive: true })
    container.addEventListener("touchstart", handleTouchStart, {
      passive: true
    })
    container.addEventListener("touchmove", handleTouchMove, { passive: true })
    container.addEventListener("mousedown", handleMouseDown)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      container.removeEventListener("scroll", handleScroll)
      container.removeEventListener("wheel", handleWheel)
      container.removeEventListener("touchstart", handleTouchStart)
      container.removeEventListener("touchmove", handleTouchMove)
      container.removeEventListener("mousedown", handleMouseDown)
      window.removeEventListener("mouseup", handleMouseUp)
      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current)
      }
    }
  }, [isAtBottom])

  useEffect(() => {
    if (streaming && isAutoScrollEnabled) {
      requestAnimationFrame(() => {
        scrollToBottom(false)
      })
    }
  }, [streaming, isAutoScrollEnabled, scrollToBottom])

  useEffect(() => {
    if (previousResetKey.current !== resetKey) {
      previousResetKey.current = resetKey
      pendingResetScroll.current = true
      setIsAutoScrollEnabled(true)
    }
  }, [resetKey])

  useEffect(() => {
    if (!pendingResetScroll.current || messages.length === 0) {
      return
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToBottom(false)
        pendingResetScroll.current = false
      })
    })
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (messages.length === 0) {
      setIsAutoScrollEnabled(true)
      return
    }

    if (isAutoScrollEnabled && !isAtBottom()) {
      requestAnimationFrame(() => {
        scrollToBottom(!streaming)
      })
    }
  }, [messages, isAutoScrollEnabled, scrollToBottom, streaming, isAtBottom])

  const autoScrollToBottom = useCallback(() => {
    setIsAutoScrollEnabled(true)
    scrollToBottom(true)
  }, [scrollToBottom])

  return {
    containerRef,
    isAutoScrollToBottom: isAutoScrollEnabled && isAtBottom(),
    autoScrollToBottom
  }
}
