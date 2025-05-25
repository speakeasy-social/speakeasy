export const DEFAULT_LEAVE_OPTIONS = [
  {title: 'Read a Book', link: 'https://bookshop.org/'},
  {
    title: 'Message a Friend',
    link: 'chat',
  },
  {title: 'Take a Walk', link: 'close'},
]

export type LeaveOption = (typeof DEFAULT_LEAVE_OPTIONS)[number]
