export type Task = {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  difficulty: number | null
  /** Tokens the model used while this task was in progress (absent in lists stored before 0.2.0). */
  tokens?: number
}

/** The weekly limit split into a daily budget, all in percent of the weekly limit. */
export type Week = {
  /** Weekly limit used so far. */
  used: number
  /** Used today, since the first reading of the day. */
  today: number
  /** Today's fair share: what was left at the day's start over the days left. */
  budget: number
  /** When the weekly limit resets (ISO 8601). */
  resetsAt: string
}

declare module 'claude-code' {
  interface PluginState {
    'task-meter': { tasks: Task[]; isHidden: boolean; week: Week | null; weekNote: string | null; lang: 'ru' | 'en' }
  }
}
