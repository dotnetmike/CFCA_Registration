import { useEffect, useState } from "react"

/** True after the first client paint — use to skip SSR for DOM that extensions may mutate before hydration. */
export const useClientMounted = () => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return mounted
}
