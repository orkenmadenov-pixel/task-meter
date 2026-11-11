export type Task = { content: string; status: 'pending' | 'in_progress' | 'completed'; difficulty: number | null }

declare module 'claude-code' {
  interface PluginState {
    'task-meter': { tasks: Task[] }
  }
}
