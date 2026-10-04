# @pennant/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for [Pennant](https://flypennant.com). It lets an AI assistant read your flags, explain why a flag is on or off for a user, change flags, and add a Pennant SDK to a codebase.

The server signs in to your console as a Pennant user, so that user's role, project access, and production approvals apply to everything the assistant does.

## Set up

Create a Pennant user for the assistant. Give it the **viewer** role to start, or **editor** if it should change flags. Then add the server to your client.

### Claude Code

```bash
claude mcp add pennant \
  -e PENNANT_URL=https://flags.example.com \
  -e PENNANT_EMAIL=assistant@example.com \
  -e PENNANT_PASSWORD=... \
  -- npx -y @pennant/mcp
```

### Claude Desktop, Cursor, VS Code, and other clients

```json
{
  "mcpServers": {
    "pennant": {
      "command": "npx",
      "args": ["-y", "@pennant/mcp"],
      "env": {
        "PENNANT_URL": "https://flags.example.com",
        "PENNANT_EMAIL": "assistant@example.com",
        "PENNANT_PASSWORD": "..."
      }
    }
  }
}
```

## Configuration

| Variable             | Required | Meaning                                                                                 |
| -------------------- | -------- | --------------------------------------------------------------------------------------- |
| `PENNANT_URL`        | yes      | Public URL of your Pennant console.                                                     |
| `PENNANT_EMAIL`      | yes      | Pennant user the server signs in as.                                                    |
| `PENNANT_PASSWORD`   | yes      | That user's password. Single sign-on accounts need a local password for the server.     |
| `PENNANT_PROJECT`    | no       | Project used when a tool does not name one. Defaults to `default`.                      |
| `PENNANT_CLIENT_KEY` | no       | Project client key. Lets `explain_flag` confirm results, including percentage rollouts. |
| `PENNANT_READ_ONLY`  | no       | Set to `1` to leave out every tool that changes flags.                                  |

## Tools

| Tool                | What it does                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `list_projects`     | Projects the user can open.                                                                |
| `list_environments` | A project's environments.                                                                  |
| `list_flags`        | Flags with type, tags, parent, and on/off per environment. Filter by tag.                  |
| `get_flag`          | One flag's full configuration.                                                             |
| `list_segments`     | Saved audiences and their constraints.                                                     |
| `explain_flag`      | Why a flag is on or off for a user, step by step, in the order the server checks.          |
| `detect_stack`      | Reads `package.json`, `pyproject.toml`, `go.mod`, or `Cargo.toml` and picks the right SDK. |
| `sdk_setup`         | Install command, environment variables, and a first flag check, pointed at your console.   |
| `create_flag`       | Creates a flag. It starts off in every environment.                                        |
| `set_flag_enabled`  | Switches a flag on or off in one environment.                                              |
| `update_targeting`  | Changes strategy, constraints, variants, or segments in one environment.                   |
| `archive_flag`      | Archives or restores a flag.                                                               |

When a project requires approval for production, `set_flag_enabled` and `update_targeting` open a change request instead of applying the change. An admin approves it in the console.

## Try it

- "Add Pennant to this app and put the new search page behind a flag called `new-search`."
- "Why is `checkout-v2` off for user `u-123` in production?"
- "Roll `new-search` out to 10% of users in development."
- "Which flags tagged `checkout` are still off in production?"

## Skills

The [`skills/`](../skills) folder has agent skills that pair with this server: adding the SDK, wrapping a feature in a flag, and cleaning up a flag after rollout.
