import { createFileRoute } from '@tanstack/react-router'
import { handleVitals } from '../../server/vitals.server'

export const Route = createFileRoute('/api/vitals')({
  server: { handlers: { POST: ({ request }) => handleVitals(request) } },
})
