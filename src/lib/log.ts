export function taxLog(message: string, context?: Record<string, unknown>) {
  try {
    const flag = process.env.TAX_DEBUG || process.env.NEXT_PUBLIC_TAX_DEBUG
    const enabled = flag && (flag === '1' || flag.toLowerCase() === 'true')
    if (!enabled) return
    if (context) {
      // Use JSON-safe stringify fallback
      const safe = JSON.parse(JSON.stringify(context, (_k, v) => (v && v.toFixed ? v.toString() : v)))
      console.log(`[TAX] ${message}`, safe)
    } else {
      console.log(`[TAX] ${message}`)
    }
  } catch {
    // Never let logging break execution
  }
}

