import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Task } from '../types'

// The task list as the model last set it through update_plan.
const tasks = atom({ plugin: 'task-meter', key: 'tasks' } as const, [] as Task[])

const PLAN_TOOL = 'mcp__ccd_turn__update_plan'

// Asks the model to rate each task's difficulty inside update_plan items.
const GUIDE = [
  'Task difficulty: whenever you call mcp__ccd_turn__update_plan with "items",',
  'give every item a "difficulty" field: 1 = easy (a quick edit or one command),',
  '2 = medium (a few files or steps), 3 = hard (design work, debugging, many files).',
].join(' ')

const toDifficulty = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? Math.min(3, Math.max(1, Math.round(n))) : null
}

const toStatus = (v: unknown): Task['status'] =>
  v === 'completed' || v === 'in_progress' ? v : 'pending'

// Applies one update_plan call to the list, the way the app reads it.
const apply = (list: Task[], e: Record<string, unknown>): Task[] => {
  if (Array.isArray(e.items)) {
    // Keep the tokens already counted for a task that keeps its name.
    const spent = new Map(list.map(t => [t.content, t.tokens ?? 0]))
    return e.items.map(raw => {
      const item = (raw ?? {}) as Record<string, unknown>
      const content = String(item.content ?? '')
      return {
        content,
        status: toStatus(item.status),
        difficulty: toDifficulty(item.difficulty),
        tokens: spent.get(content) ?? 0,
      }
    })
  }

  let next = list.map(t => ({ ...t }))

  if (e.advance === true) {
    const cur = next.find(t => t.status === 'in_progress')
    if (cur) cur.status = 'completed'
    const nxt = next.find(t => t.status === 'pending')
    if (nxt) nxt.status = 'in_progress'
  }

  if (Array.isArray(e.done)) {
    for (const n of e.done) {
      const t = next[Number(n) - 1]
      if (t) t.status = 'completed'
    }
  }

  if (typeof e.start === 'number') {
    next = next.map(t => (t.status === 'in_progress' ? { ...t, status: 'pending' } : t))
    const t = next[e.start - 1]
    if (t) t.status = 'in_progress'
  }

  return next
}

const DOTS = ['', '●○○', '●●○', '●●●']
const LEVEL = ['', 'лёгкая', 'средняя', 'сложная']
const COLOR = ['', 'green', 'yellow', 'red'] as const

// 1234 -> "1.2k", 2500000 -> "2.5M"
const fmt = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n)

const bar = (pct: number) => {
  const filled = Math.round(pct / 10)
  return '█'.repeat(filled) + '░'.repeat(10 - filled)
}

export const register: Register = on => {
  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    return {
      sections: [...result.sections, { id: 'task-meter:guide', text: GUIDE, scope: 'session' }],
    }
  })

  on('tool.call', async ($, e, next) => {
    if (e.tool === PLAN_TOOL) {
      const input = e as unknown as Record<string, unknown>
      await update($, tasks, list => apply(list, input))
    }
    return next(e)
  }).catch(($, e, next) => next(e))

  // Each model request: add its tokens to the task that is in progress.
  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    const u = r.usage
    if (u) {
      const used =
        u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens + u.output_tokens
      await update($, tasks, list => {
        const i = list.findIndex(t => t.status === 'in_progress')
        return i < 0 ? list : list.map((t, j) => (j === i ? { ...t, tokens: (t.tokens ?? 0) + used } : t))
      })
    }
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, tasks)

    if (e.props.hasSurvey || list.length === 0) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    const done = list.filter(t => t.status === 'completed').length
    const pct = Math.round((done / list.length) * 100)

    const rated = list.filter(t => t.difficulty !== null)
    const avg = rated.length
      ? Math.round(rated.reduce((s, t) => s + (t.difficulty ?? 0), 0) / rated.length)
      : 0

    const total = list.reduce((s, t) => s + (t.tokens ?? 0), 0)

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold>Задачи {done}/{list.length} · {pct}% </Text>
          <Text color="green">{bar(pct)}</Text>
          {avg > 0 ? <Text color={COLOR[avg]}>  сложность: {LEVEL[avg]} {DOTS[avg]}</Text> : null}
          {total > 0 ? <Text dimColor>  токены: {fmt(total)}</Text> : null}
        </Box>
        {list.map((t, i) => (
          <Box key={`t${i}`}>
            <Text dimColor={t.status === 'completed'}>
              {t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '▶' : '·'} {t.content}{' '}
            </Text>
            {t.difficulty ? <Text color={COLOR[t.difficulty]}>{DOTS[t.difficulty]}</Text> : null}
            {t.tokens ? <Text dimColor>  {fmt(t.tokens)}</Text> : null}
          </Box>
        ))}
      </Box>
    )
  })
}
