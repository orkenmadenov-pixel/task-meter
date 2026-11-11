import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Task, Week } from '../types'

// The task list as the model last set it through update_plan.
const tasks = atom({ plugin: 'task-meter', key: 'tasks' } as const, [] as Task[])

// Whether the person collapsed the band; remembered across chats in $.store.
const isHidden = atom({ plugin: 'task-meter', key: 'isHidden' } as const, false)

// The weekly limit as a daily budget, refreshed after each model response.
const week = atom({ plugin: 'task-meter', key: 'week' } as const, null as Week | null)

// Why there is no weekly line (no reading yet, an error), shown dim in its place.
const weekNote = atom({ plugin: 'task-meter', key: 'weekNote' } as const, null as string | null)

const note = ($: EngineInterface, text: string | null) => update($, weekNote, () => text)

const DAY = 24 * 60 * 60 * 1000

// Local calendar day, e.g. "2026-11-11".
const dayOf = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

type DayRecord = { date: string; resetsAt: string; startPct: number; budget: number; warned: number }

const isDayRecord = (v: unknown): v is DayRecord =>
  typeof v === 'object' && v !== null && typeof (v as DayRecord).date === 'string' &&
  typeof (v as DayRecord).startPct === 'number' && typeof (v as DayRecord).budget === 'number'

// 6.24 -> "6.2%", 34.4 -> "34%"
const pc = (n: number) => `${n >= 10 ? Math.round(n) : Math.round(n * 10) / 10}%`

// Reads the seven-day limit, keeps today's starting point in $.store (shared by
// every chat), and warns once at 80% of today's budget and once past it.
async function refreshWeek($: EngineInterface) {
  const { rateLimits } = await $.session.usage()
  const limit = rateLimits.find(r => r.kind === 'seven_day')
  if (!limit || !limit.resetsAt) {
    const kinds = rateLimits.map(r => r.kind).join(', ') || '—'
    await note($, TEXT[await read($, lang)].noData(kinds))
    return
  }
  await note($, null)

  const now = await $.clock.now()
  const date = dayOf(now)
  const saved = await $.store.get('day')
  let rec = isDayRecord(saved) ? saved : null

  // A new day, a new week window, or a reset since the morning: start over.
  if (!rec || rec.date !== date || rec.resetsAt !== limit.resetsAt || limit.percentUsed < rec.startPct) {
    const daysLeft = Math.max(1, (Date.parse(limit.resetsAt) - now) / DAY)
    rec = {
      date,
      resetsAt: limit.resetsAt,
      startPct: limit.percentUsed,
      budget: Math.max(0, 100 - limit.percentUsed) / daysLeft,
      warned: 0,
    }
  }

  const today = Math.max(0, limit.percentUsed - rec.startPct)

  if (rec.budget > 0 && today > rec.budget && rec.warned < 2) {
    $.ui.toast(TEXT[await read($, lang)].over(pc(today), pc(rec.budget)))
    rec = { ...rec, warned: 2 }
  } else if (rec.budget > 0 && today >= rec.budget * 0.8 && rec.warned < 1) {
    $.ui.toast(TEXT[await read($, lang)].near(pc(today), pc(rec.budget)))
    rec = { ...rec, warned: 1 }
  }

  await $.store.set('day', rec)
  const next: Week = { used: limit.percentUsed, today, budget: rec.budget, resetsAt: limit.resetsAt }
  await update($, week, () => next)
}

async function setHidden($: EngineInterface, value: boolean) {
  await update($, isHidden, () => value)
  await $.store.set('hidden', value)
}

// Labels in the app's language: Claude's `language` setting when set, else the system locale.
type Lang = 'ru' | 'en'
const lang = atom({ plugin: 'task-meter', key: 'lang' } as const, 'en' as Lang)

const TEXT = {
  ru: {
    tasks: 'Задачи', today: 'Сегодня', none: 'нет', tok: 'ток.', of: 'из', week: 'неделя',
    left: 'осталось', ok: 'в норме', near80: 'почти исчерпано', overShort: 'превышено',
    hide: 'Скрыть', show: 'Показать',
    noData: (k: string) => `Недельный лимит: нет данных (окна: ${k})`,
    error: (m: string) => `Недельный лимит: ошибка ${m}`,
    over: (t: string, b: string) => `Дневная норма превышена: сегодня ${t} недельного лимита при норме ${b}. В таком темпе лимит закончится раньше сброса.`,
    near: (t: string, b: string) => `Израсходовано 80% дневной нормы: ${t} из ${b} недельного лимита.`,
  },
  en: {
    tasks: 'Tasks', today: 'Today', none: 'none', tok: 'tok', of: 'of', week: 'week',
    left: 'left', ok: 'on track', near80: 'almost used', overShort: 'over',
    hide: 'Hide', show: 'Show',
    noData: (k: string) => `Weekly limit: no data (windows: ${k})`,
    error: (m: string) => `Weekly limit: error ${m}`,
    over: (t: string, b: string) => `Daily budget exceeded: ${t} of the weekly limit today against a budget of ${b}. At this pace the limit runs out before it resets.`,
    near: (t: string, b: string) => `80% of today's budget used: ${t} of ${b} of the weekly limit.`,
  },
} as const

const toLang = (v: unknown): Lang | null => {
  const s = typeof v === 'string' ? v.toLowerCase() : ''
  if (!s) return null
  return s.startsWith('ru') || s.startsWith('рус') ? 'ru' : 'en'
}

// The language the person writes in: Cyrillic text means Russian.
const langOfText = (text: string): Lang | null =>
  /[а-яё]/i.test(text) ? 'ru' : /[a-z]/i.test(text) ? 'en' : null

async function detectLang($: EngineInterface): Promise<Lang> {
  const saved = toLang(await $.store.get('lang'))
  if (saved) return saved
  const row = (await $.config.list()).find(r => r.key === 'language')
  const fromSetting = toLang(row?.value)
  if (fromSetting) return fromSetting
  const locale = new Intl.DateTimeFormat().resolvedOptions().locale
  return toLang(locale) ?? 'en'
}

const PLAN_TOOL = 'mcp__ccd_turn__update_plan'

// Asks the model to rate each task's difficulty inside update_plan items.
const GUIDE = [
  'Task difficulty: whenever you call mcp__ccd_turn__update_plan with "items",',
  'give every item a "difficulty" field: 1 = easy (a quick edit or one command),',
  '2 = medium (a few files or steps), 3 = hard (design work, debugging, many files).',
  'Write each item\'s "content" in the language the user writes in.',
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
const COLOR = ['', 'green', 'yellow', 'red'] as const

// 1234 -> "1.2k", 2500000 -> "2.5M"
const fmt = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n)

// A round progress bar: 40 -> "●●●●○○○○○○"
const dots = (pct: number) => {
  const filled = Math.max(0, Math.min(10, Math.round(pct / 10)))
  return '●'.repeat(filled) + '○'.repeat(10 - filled)
}

export const register: Register = on => {
  // A new chat starts the way the person last left the band.
  on('session.start', async ($, e, next) => {
    const saved = await $.store.get('hidden')
    await update($, isHidden, () => saved === true)
    const detected = await detectLang($).catch(() => 'en' as Lang)
    await update($, lang, () => detected)
    const result = await next(e)
    await refreshWeek($).catch((err: unknown) => note($, `! ${String(err).slice(0, 120)}`))
    return result
  })

  // Follow the language of what the person types, and remember it for new chats.
  on('prompt.submit', async ($, e, next) => {
    const found = e.isMeta ? null : langOfText(e.text)
    if (found && found !== (await read($, lang))) {
      await update($, lang, () => found)
      await $.store.set('lang', found)
    }
    return next(e)
  }).catch(($, e, next) => next(e))

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
      await refreshWeek($).catch((err: unknown) => note($, `! ${String(err).slice(0, 120)}`))
    }
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const list = await read($, tasks)
    const hidden = await read($, isHidden)
    const w = await read($, week)
    const wNote = await read($, weekNote)
    const L = TEXT[await read($, lang)]
    const { Box, Text, Button } = $.ui.resolve(e)

    if (hidden) {
      return (
        <Box>
          <Button key="show" label={`◉ ${L.show}`} onPress={() => setHidden($, false)} />
        </Box>
      )
    }

    const done = list.filter(t => t.status === 'completed').length
    const share = list.length ? Math.round((done / list.length) * 100) : 0
    const total = list.reduce((s, t) => s + (t.tokens ?? 0), 0)

    // Today's state colours the dot and the bar: green, yellow from 80%, red past the budget.
    const state = w ? (w.today > w.budget ? 'red' : w.today >= w.budget * 0.8 ? 'yellow' : 'green') : 'gray'
    const dayFill = w ? (w.budget > 0 ? Math.min(100, (w.today / w.budget) * 100) : 100) : 0

    const cur = list.find(t => t.status === 'in_progress') ?? list.find(t => t.status === 'pending')

    // ╭─────────────────────────────────────────────╮
    // │ ● Задачи   ●●●○○○○○○○  1/3 · 1.4M ток.  [Скрыть] │
    // │ ● Сегодня  ●●●●●●○○○○  6.2% из 9.4% · неделя 34% │
    // │   ▶ Текущая задача  ●○○  120.0k                  │
    // ╰─────────────────────────────────────────────╯
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
        <Box justifyContent="space-between">
          <Box>
            <Text color="cyan">● </Text>
            <Text bold>{L.tasks.padEnd(8)}</Text>
            {list.length ? <Text color="cyan">{dots(share)}</Text> : <Text dimColor>{L.none}</Text>}
            {list.length ? <Text>  {done}/{list.length}</Text> : null}
            {total > 0 ? <Text dimColor>  · {fmt(total)} {L.tok}</Text> : null}
          </Box>
          <Button key="hide" label={L.hide} onPress={() => setHidden($, true)} />
        </Box>

        {w ? (
          <Box>
            <Text color={state}>● </Text>
            <Text bold>{L.today.padEnd(8)}</Text>
            <Text color={state}>{dots(dayFill)}</Text>
            <Text color={state} bold>  {state === 'red' ? L.overShort : state === 'yellow' ? L.near80 : L.ok}</Text>
            <Text>  {pc(w.today)} {L.of} {pc(w.budget)}</Text>
            <Text dimColor>  · {L.left} {pc(Math.max(0, w.budget - w.today))} · {L.week} {pc(w.used)}</Text>
          </Box>
        ) : wNote ? (
          <Box>
            <Text color="gray">○ </Text>
            <Text dimColor>{wNote}</Text>
          </Box>
        ) : null}

        {cur ? (
          <Box>
            <Text dimColor>{cur.status === 'in_progress' ? '  ▶ ' : '  ○ '}</Text>
            <Text>{cur.content}</Text>
            {cur.difficulty ? <Text color={COLOR[cur.difficulty]}>  {DOTS[cur.difficulty]}</Text> : null}
            {cur.tokens ? <Text dimColor>  {fmt(cur.tokens)}</Text> : null}
          </Box>
        ) : null}
      </Box>
    )
  })
}
