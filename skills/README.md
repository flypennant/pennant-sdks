# Pennant agent skills

Skills teach a coding agent how to work with Pennant in your codebase. They pair with the [Pennant MCP server](../mcp), and work without it too.

| Skill                                                       | Use it to                                                 |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| [`pennant-add-sdk`](pennant-add-sdk/SKILL.md)               | Add the right Pennant SDK to a codebase and configure it. |
| [`pennant-flag-a-feature`](pennant-flag-a-feature/SKILL.md) | Put new behaviour behind a flag, with a safe off path.    |
| [`pennant-remove-flag`](pennant-remove-flag/SKILL.md)       | Remove a flag after rollout, then archive it.             |

## Install

Copy the skill folders into the place your agent reads skills from.

```bash
# Claude Code, for one project
mkdir -p .claude/skills
curl -sL https://github.com/flypennant/pennant-sdks/archive/refs/heads/main.tar.gz \
  | tar -xz --strip-components=2 -C .claude/skills pennant-sdks-main/skills/pennant-add-sdk pennant-sdks-main/skills/pennant-flag-a-feature pennant-sdks-main/skills/pennant-remove-flag
```

For Claude Code across all projects, use `~/.claude/skills` instead. Other agents that support `SKILL.md` folders, such as Cursor, read them from their own skills directory. The files are plain Markdown, so you can also paste them into any agent's instructions.
