// The few icons, drawn inline. Each one always sits next to a word.
const paths = {
  undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  again: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  send: 'M5 12h14M13 6l6 6-6 6',
  share: 'M12 3v12M7 8l5-5 5 5M5 14v5h14v-5',
  check: 'M5 12.5 10 17 19 7',
  cloud: 'M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 18z',
  plus: 'M12 5v14M5 12h14',
}

export type IconName = keyof typeof paths

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}
