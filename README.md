# task-meter

A Claude Code mod that shows a progress indicator above the prompt for Claude's current task list: how many tasks are done, a completion percentage with a bar, and a difficulty rating for each task and for the list overall (easy ●○○, medium ●●○, hard ●●●).

```
Задачи 2/4 · 50% █████░░░░░   сложность: средняя ●●○   токены: 1.4M
✓ Read settings          ●○○  120.0k
✓ Write code             ●●●  900.0k
▶ Build indicator        ●●●  380.0k
· Verify it works        ●●○
```

The mod watches Claude's task-list updates and asks Claude to give every task a difficulty from 1 to 3. The band hides itself when there is no task list.

Token counting: after each model response, its tokens (new input, cache writes, cache reads and output) are added to the task currently in progress (▶); the header shows the sum. Renaming a task resets its count.

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
