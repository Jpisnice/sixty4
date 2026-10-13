import { createFileRoute } from '@tanstack/react-router'
import { healthCheck } from '../../server/health.server'

export const Route = createFileRoute('/api/health')({
  server: { handlers: { GET: () => healthCheck() } },
})
