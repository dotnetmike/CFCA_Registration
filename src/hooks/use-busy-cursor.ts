"use client"

import { useEffect } from "react"

let busyCount = 0
let savedCursor = ""

const acquireBusyCursor = () => {
  if (busyCount === 0) {
    savedCursor = document.body.style.cursor
    document.body.style.cursor = "wait"
  }
  busyCount++
}

const releaseBusyCursor = () => {
  busyCount = Math.max(0, busyCount - 1)
  if (busyCount === 0) {
    document.body.style.cursor = savedCursor
  }
}

export const useBusyCursor = (busy: boolean) => {
  useEffect(() => {
    if (!busy) return
    acquireBusyCursor()
    return () => {
      releaseBusyCursor()
    }
  }, [busy])
}
