import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { getToday } from '../functions/getToday'
import { Game } from '../client/Game'
import { practiceDay, progressKey, read, remove, sentKey, write } from '../client/storage'
import type { Practice } from '../client/storage'

export const Route = createFileRoute('/')({
  loader: () => getToday(),
  component: Home,
})

function Home() {
  const puzzle = Route.useLoaderData()
  const [practice, setPractice] = useState<Practice | null>(null)

  // A debug puzzle from the menu, read after hydration. It lasts only for its day.
  useEffect(() => {
    const p = read<Practice | null>('practice', null)
    setPractice(p?.date === puzzle.date ? p : null)
  }, [puzzle.date])

  function onPractice(p: Practice | null) {
    const day = practiceDay(puzzle.date)
    remove(progressKey(day))
    remove(sentKey(day))
    if (p) write('practice', p)
    else remove('practice')
    setPractice(p)
  }

  return (
    <Game
      key={practice?.id ?? puzzle.date}
      puzzle={practice ? { ...puzzle, ...practice } : puzzle}
      real={puzzle}
      practice={!!practice}
      onPractice={onPractice}
    />
  )
}
