import { createFileRoute } from '@tanstack/react-router'
import { handleAnswer, handleReset } from '../../server/answers.server'

export const Route = createFileRoute('/api/answer')({
  server: {
    handlers: {
      POST: ({ request }) => handleAnswer(request),
      DELETE: ({ request }) => handleReset(request),
    },
  },
})
