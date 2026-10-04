---
name: pennant-flag-a-feature
description: Put new or changed behaviour behind a Pennant feature flag. Use when the user asks to ship something dark, gate a feature, add a kill switch, run an experiment with variants, or roll a change out gradually with Pennant.
---

# Put a feature behind a Pennant flag

Goal: the new code ships switched off, the old path stays the default, and turning the flag on or off needs no deploy.

## 1. Check the SDK is set up

Look for an existing Pennant client or `PennantProvider`. If there is none, follow the `pennant-add-sdk` skill first.

## 2. Name the flag

- Lowercase words joined by hyphens, describing the feature, not the ticket: `new-checkout`, `search-v2`, `orders-backfill`.
- Reuse an existing key if the team already created one. If the MCP server is connected, check with `list_flags`.
- Pick the type: `release` for shipping a feature, `experiment` for variants, `operational` for system behaviour, `kill-switch` for turning something off fast, `permission` for long-lived access.

## 3. Write both paths

- The flag being **off** must be the safe, current behaviour. Unknown flags and Pennant outages read as off.
- Branch once, as close to the entry point of the feature as you can: a route, a component, a service method. Avoid scattering the same check across many files.
- Keep the old path intact and working. Do not delete it in the same change.
- For experiments, branch on the variant name (`useVariant` in React and Vue, `getVariant` elsewhere) and treat an unknown variant as the control.
- For a kill switch on a feature that is already live, **on** keeps the feature running and **off** disables it. New flags start off, so switch the flag on in every environment before deploying the gated code, or the feature disappears on deploy.

## 4. Test both states

Add or update tests so both the on and off paths run. Mock the flag at the SDK boundary the codebase already uses, rather than calling a real console from tests.

## 5. Create the flag

If the MCP server is connected and the user agrees:

1. `create_flag` with the key, a readable name, the type, and a one-line description. It starts off everywhere.
2. `set_flag_enabled` in `development` so the team can try it.
3. Leave production to the user. If they ask, propose a small `gradual` rollout with `update_targeting`. When the project needs approval, the tool opens a change request; tell the user an admin must approve it.

Without the MCP server, tell the user to create the flag in the console with the same key before deploying.

## 6. Hand over

Summarise for the user: the flag key, where the check lives, what on and off do, and how to roll it out. Mention that the flag should be removed once it is fully on, with the `pennant-remove-flag` skill.
