# pennant (Rust)

Rust client for [Pennant](../../README.md). Matches `sdk/CONTRACT.md`.

## Install

```toml
[dependencies]
pennant = { git = "https://github.com/gizmo0506/pennant", tag = "sdk/rust/v1.0.0", path = "sdk/rust" }
# local checkout:
# pennant = { path = "./sdk/rust" }
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
