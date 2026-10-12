import { createFileRoute } from '@tanstack/react-router'
import { getToday } from '../functions/getToday'

export const Route = createFileRoute('/')({
  loader: () => getToday(),
  component: Home,
})

function Home() {
  const p = Route.useLoaderData()
  return (
    <h1>
      #{p.number}: {p.tiles.join(' ')} → {p.target}
    </h1>
  )
}
