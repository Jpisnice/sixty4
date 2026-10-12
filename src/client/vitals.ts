import { onCLS, onINP, onLCP } from 'web-vitals/attribution'
import type { CLSMetricWithAttribution, INPMetricWithAttribution, LCPMetricWithAttribution } from 'web-vitals/attribution'

type Metric = CLSMetricWithAttribution | INPMetricWithAttribution | LCPMetricWithAttribution

/** Sends LCP, INP and CLS from real phones to the server. */
export function startVitals() {
  const send = (m: Metric) => {
    const a = m.attribution as { target?: string; largestShiftTarget?: string; interactionTarget?: string }
    const target = a.target ?? a.largestShiftTarget ?? a.interactionTarget
    navigator.sendBeacon(
      '/api/vitals',
      JSON.stringify({ name: m.name, value: m.value, rating: m.rating, target: target?.slice(0, 100) }),
    )
  }
  onLCP(send)
  onINP(send)
  onCLS(send)
}
