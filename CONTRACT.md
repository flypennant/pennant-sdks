# Shared client evaluation contract

Frontend and server SDKs call the same evaluate endpoint so auth, context, and variants stay aligned.

## Endpoint

`POST /api/client/evaluate`

Authenticate with the project client key:

```http
Authorization: Bearer <project client key>
Content-Type: application/json
```

The server maps the bearer token to a project. An invalid key returns 401.

## Request body

| Field         | Required | Notes                                                                                               |
| ------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `context`     | no       | Evaluation context object. Omitted or null becomes `{}`.                                            |
| `environment` | no       | Non-empty string. Defaults to `development`. Must be a known environment on the project.            |
| `project`     | no       | Project id. When set, it must match the project that owns the bearer key or the server returns 403. |

### Context fields

| Field           | Type                     | Notes                                           |
| --------------- | ------------------------ | ----------------------------------------------- |
| `userId`        | string                   | Sticky id for gradual rollout and variants.     |
| `sessionId`     | string                   | Fallback sticky id when `userId` is missing.    |
| `remoteAddress` | string                   | Used by the remoteAddress strategy.             |
| `hostname`      | string                   | Used by the hostname strategy.                  |
| `properties`    | `Record<string, string>` | Custom string map for constraints and segments. |

Empty strings after trim are dropped. Unknown context keys are ignored.

## Response body

```json
{
  "flags": {
    "<flag-key>": {
      "enabled": true,
      "variant": "treatment"
    }
  }
}
```

- `flags` maps each active (non-archived) flag key to an evaluation.
- `enabled` is always a boolean.
- `variant` is an optional sticky variant name. It is present only when the flag is on, the environment defines weighted variants, and the context has a stickiness id.

## Variant stickiness

Server evaluation picks stickiness in this order:

1. `context.userId` when present
2. otherwise `context.sessionId`

If neither is set, the flag can still be enabled, but no variant is returned. The same stickiness value and flag key always hash to the same variant.

## Behavioural baseline

The React SDK at `sdk/react` (`@pennant/react`) is the behavioural baseline for this contract. New SDKs should match its request shape, response shape, and stickiness rules. Do not rewrite that package for this contract story.
