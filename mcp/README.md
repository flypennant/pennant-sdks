# @pennant/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for [Pennant](https://flypennant.com). It lets an AI assistant read your flags, explain why a flag is on or off for a user, change flags, and add a Pennant SDK to a codebase.

The server calls your console with a personal access token. A token acts as the person who created it, capped at editor, so their project access and your production approvals apply to everything the assistant does. It needs a Pennant console with access tokens (v1.4.0 or later).

## Set up

1. In the Pennant console, open **Tokens** and create a token. Choose **Read only** to start, or **Read and write flags** when the assistant should change flags. Limit it to the projects it needs, and pick an expiry.
2. Copy the token. It is shown once.
3. Add the server to your client.

### Claude Code

```bash
claude mcp add pennant \
  -e PENNANT_URL=https://flags.example.com \
  -e PENNANT_TOKEN=pnt_... \
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
        "PENNANT_TOKEN": "pnt_..."
      }
    }
  }
}
```

## Configuration

| Variable             | Required | Meaning                                                                                 |
| -------------------- | -------- | --------------------------------------------------------------------------------------- |
| `PENNANT_URL`        | yes      | Public URL of your Pennant console.                                                     |
| `PENNANT_TOKEN`      | yes      | Access token (`pnt_...`) from the console's Tokens page.                                |
| `PENNANT_PROJECT`    | no       | Project used when a tool does not name one. Defaults to `default`.                      |
| `PENNANT_CLIENT_KEY` | no       | Project client key. Lets `explain_flag` confirm results, including percentage rollouts. |
| `PENNANT_READ_ONLY`  | no       | Set to `1` to leave out every tool that changes flags.                                  |

## Security

- The token acts as its owner, capped at editor. It cannot manage users, single sign-on, or client keys. Read-only tokens act as viewers.
- Production changes from the assistant open change requests when the project requires approval.
- Revoke a token on the Tokens page and it stops working at once. Tokens also expire on their own.
- The audit log records each change as `you@example.com via token "Claude laptop"`.
- Keep the token in your MCP client's configuration or a secret manager, not in source control.

## Tools

| Tool                | What it does                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `whoami`            | Which user the token acts as, its role, projects, and scope.                                                        |
| `list_projects`     | Projects the user can open.                                                                                         |
| `list_environments` | A project's environments.                                                                                           |
| `list_flags`        | Flags with type, tags, parent, and on/off per environment. Filter by tag.                                           |
| `get_flag`          | One flag's full configuration.                                                                                      |
| `list_segments`     | Saved audiences and their constraints.                                                                              |
| `explain_flag`      | Why a flag is on or off for a user, step by step, in the order the server checks.                                   |
| `detect_stack`      | Reads package manifests (npm, Python, Go, Rust, Maven, Gradle, Swift, Composer, .NET, pub) and picks the right SDK. |
| `sdk_setup`         | Install command, environment variables, and a first flag check, pointed at your console.                            |
| `create_flag`       | Creates a flag. It starts off in every environment.                                                                 |
| `set_flag_enabled`  | Switches a flag on or off in one environment.                                                                       |
| `update_targeting`  | Changes strategy, constraints, variants, or segments in one environment.                                            |
| `archive_flag`      | Archives or restores a flag.                                                                                        |

When a project requires approval for production, `set_flag_enabled` and `update_targeting` open a change request instead of applying the change. An admin approves it in the console.

## Try it

- "Add Pennant to this app and put the new search page behind a flag called `new-search`."
- "Why is `checkout-v2` off for user `u-123` in production?"
- "Roll `new-search` out to 10% of users in development."
- "Which flags tagged `checkout` are still off in production?"

## Skills

The [`skills/`](../skills) folder has agent skills that pair with this server: adding the SDK, wrapping a feature in a flag, and cleaning up a flag after rollout.
