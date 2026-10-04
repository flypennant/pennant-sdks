# pennant (Rust)

Rust client for [Pennant](../README.md). Matches [`CONTRACT.md`](../CONTRACT.md).

## Install

```toml
[dependencies]
pennant = { package = "pennant-sdk", version = "1" }
# straight from GitHub:
# pennant = { package = "pennant-sdk", git = "https://github.com/gizmo0506/pennant-sdks", tag = "rust/v1.1.0" }
```

## Usage

```rust
use pennant::{Client, ClientOptions, EvaluationContext};

let mut client = Client::new(ClientOptions {
    api_url: "http://127.0.0.1:3847".into(),
    client_key: "pennant-client-demo".into(),
    environment: "development".into(),
    project: None,
    context: EvaluationContext {
        user_id: Some("ada-lovelace".into()),
        remote_address: Some("127.0.0.1".into()),
        ..EvaluationContext::default()
    },
});
let flags = client.evaluate(None)?;
```
