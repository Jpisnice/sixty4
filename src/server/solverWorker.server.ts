import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { makePuzzle } from './makePuzzle.server'
import type { MadePuzzle } from './makePuzzle.server'

const JOB = 'make-the-number:make-puzzle'

// In the built server this chunk is also the worker's entry: the worker loads
// this same file and answers with the puzzle.
if (!isMainThread && workerData?.job === JOB) {
  parentPort?.postMessage(makePuzzle(workerData.date))
}

/** Makes a puzzle on a worker thread so solving never blocks requests. */
export function makePuzzleOffThread(date: string): Promise<MadePuzzle> {
  // Dev and tests run this module from .ts source, which a worker can't load.
  if (!/\.m?js$/.test(import.meta.url)) return Promise.resolve(makePuzzle(date))
  return new Promise((resolve) => {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { job: JOB, date },
      execArgv: [],
    })
    worker.once('message', (made: MadePuzzle) => {
      resolve(made)
      void worker.terminate()
    })
    worker.once('error', (err) => {
      console.error('Solver worker failed, solving inline', err)
      resolve(makePuzzle(date))
    })
  })
}
