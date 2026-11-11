export type Task = {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  difficulty: number | null
  /** Tokens the model used while this task was in progress (absent in lists stored before 0.2.0). */
  tokens?: number
}

declare module 'claude-code' {
  interface PluginState {
    'task-meter': { tasks: Task[] }
  }
}
