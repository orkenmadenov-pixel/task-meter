# task-meter

A Claude Code mod that shows a progress indicator above the prompt for Claude's current task list: how many tasks are done, a completion percentage with a bar, and a difficulty rating for each task and for the list overall (easy ●○○, medium ●●○, hard ●●●).

```
Задачи 2/4 · 50% █████░░░░░   сложность: средняя ●●○
✓ Read settings          ●○○
▶ Build indicator        ●●●
· Verify it works        ●●○
```

The mod watches Claude's task-list updates and asks Claude to give every task a difficulty from 1 to 3. The band hides itself when there is no task list.

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
