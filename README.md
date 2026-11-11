# task-meter

A Claude Code mod that shows a small panel above the prompt:

```
╭──────────────────────────────────────────────────────╮
│ ● Tasks    ●●●○○○○○○○  1/3 · 1.4M tok         [Hide] │
│ ● Today    ●●●●●●○○○○  on track  6.2% of 9.4% · left 3.2% · week 34% │
│   ▶ Check the layout  ●○○  120.0k                     │
╰──────────────────────────────────────────────────────╯
```

- **Tasks** — progress of Claude's current task list and the tokens spent on it. After each model response its tokens (new input, cache writes, cache reads and output) are added to the task in progress.
- **Today** — a daily budget of your weekly usage limit: what was left at the start of the day divided by the days until the limit resets. A status word says where you stand — on track, almost used (from 80%), over — with what is left for today; the dot turns yellow and red with it, and a notice says so once a day. Nothing is blocked. The row appears when your account reports a weekly limit.
- **Current task** — the task in progress with its difficulty (●○○ easy, ●●○ medium, ●●● hard), which the mod asks Claude to set.
- **Hide / Show** — collapses the panel; the choice is remembered in new chats.
- Labels follow the language you write in (Russian or English), remembered for new chats. Claude names tasks in the language you write in.

## Install

At the prompt of a terminal session:

```
/plugin install task-meter --marketplace orkenmadenov-pixel/task-meter
```

From a shell:

```bash
claude plugin install task-meter --marketplace orkenmadenov-pixel/task-meter
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `orkenmadenov-pixel/task-meter`, then Add plugin.

## License

MIT
