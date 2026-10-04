---
name: pennant-remove-flag
description: Remove a Pennant feature flag from code after it is fully rolled out or abandoned, then archive it. Use when the user asks to clean up, retire, or delete a flag, or when Pennant's flag health suggests a flag is ready to remove.
---

# Remove a finished Pennant flag

Goal: one code path remains, no references to the flag key are left, and the flag is archived only after the code without it has shipped.

## 1. Confirm the flag is done

If the MCP server is connected, call `get_flag`. A flag is ready to remove when it is either:

- **Kept:** on in production with the `everyone` strategy, no constraints or segments, and no other flag names it as a parent; or
- **Abandoned:** off in production and the user confirms the feature is not coming back.

Check that no other flag uses it as a parent (`list_flags` shows `parentKey`). If one does, stop and ask the user. Removing the parent first would turn the child off.

Without the MCP server, ask the user which outcome applies.

## 2. Find every reference

Search the whole repository for the exact key, including tests, config, and docs. Also search for the camelCase or constant forms a codebase may use. Check every service that shares the project.

## 3. Remove the branch

- **Kept:** delete the flag check and the old path. Keep the new path as plain code.
- **Abandoned:** delete the flag check and the new path. Keep the old path.

Remove tests that only covered the deleted path, and update tests that set the flag. Delete helpers, variants, or config that only existed for this flag. Leave the SDK setup in place if other flags still use it.

## 4. Verify

Run the build and the tests. Search once more for the key; there should be no matches.

## 5. Archive after deploy

Archive the flag only after the change without it is deployed everywhere. Archived flags stop being sent to apps, so archiving first would flip any still-running code to the off path.

If the MCP server is connected and the user confirms the deploy is done, call `archive_flag`. Archived flags can be restored. Otherwise, tell the user to archive it in the console after the deploy.
