import { createFileRoute } from '@tanstack/react-router'
import { getToday } from '../functions/getToday'
import { Game } from '../client/Game'

export const Route = createFileRoute('/')({
  loader: () => getToday(),
  component: Home,
})

function Home() {
  const puzzle = Route.useLoaderData()
  return <Game key={puzzle.date} puzzle={puzzle} />
}
