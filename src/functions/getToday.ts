import { createServerFn } from '@tanstack/react-start'
import { loadToday } from '../server/today.server'

/** Today's puzzle for India time. Never returns the solutions. */
export const getToday = createServerFn({ method: 'GET' }).handler(() => loadToday())
