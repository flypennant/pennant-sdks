//! Pennant evaluate client for Rust.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;

/// Client or transport failure.
#[derive(Debug)]
pub enum PennantError {
    Http(String),
    Message(String),
}

impl fmt::Display for PennantError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Http(msg) | Self::Message(msg) => write!(f, "{msg}"),
        }
    }
}

impl std::error::Error for PennantError {}

/// Evaluation context fields accepted by POST /api/client/evaluate.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationContext {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub properties: Option<HashMap<String, String>>,
}

/// One flag evaluation result.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct FlagEvaluation {
    pub enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variant: Option<String>,
}

pub type FlagMap = HashMap<String, FlagEvaluation>;

/// Options for [`Client`].
#[derive(Debug, Clone)]
pub struct ClientOptions {
    pub api_url: String,
    pub client_key: String,
    pub environment: String,
    pub project: Option<String>,
    pub context: EvaluationContext,
}

impl Default for ClientOptions {
    fn default() -> Self {
        Self {
            api_url: String::new(),
            client_key: String::new(),
            environment: "development".into(),
            project: None,
            context: EvaluationContext::default(),
        }
    }
}

#[derive(Serialize)]
struct EvaluateRequest<'a> {
    context: &'a EvaluationContext,
    environment: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    project: Option<&'a str>,
}

#[derive(Deserialize)]
struct EvaluateResponse {
    #[serde(default)]
    flags: FlagMap,
    #[serde(default)]
    error: Option<String>,
}

/// Pennant evaluate client.
#[derive(Debug, Clone)]
pub struct Client {
    api_url: String,
    client_key: String,
    environment: String,
    project: Option<String>,
    context: EvaluationContext,
    flags: FlagMap,
}

impl Client {
    pub fn new(options: ClientOptions) -> Self {
        let environment = if options.environment.is_empty() {
            "development".into()
        } else {
            options.environment
        };
        Self {
            api_url: options.api_url.trim_end_matches('/').to_string(),
            client_key: options.client_key,
            environment,
            project: options.project,
            context: options.context,
            flags: FlagMap::new(),
        }
    }

    pub fn evaluate(
        &mut self,
        context: Option<&EvaluationContext>,
    ) -> Result<FlagMap, PennantError> {
        let context = context.unwrap_or(&self.context);
        let payload = EvaluateRequest {
            context,
            environment: &self.environment,
            project: self.project.as_deref(),
        };
        let url = format!("{}/api/client/evaluate", self.api_url);
        let response = ureq::post(&url)
            .set("Content-Type", "application/json")
            .set("Authorization", &format!("Bearer {}", self.client_key))
            .send_json(&payload)
            .map_err(|err| match err {
                ureq::Error::Status(code, resp) => {
                    let message = resp
                        .into_json::<EvaluateResponse>()
                        .ok()
                        .and_then(|body| body.error)
                        .unwrap_or_else(|| format!("Evaluation failed ({code})."));
                    PennantError::Message(message)
                }
                other => PennantError::Http(other.to_string()),
            })?;

        let parsed: EvaluateResponse = response
            .into_json()
            .map_err(|err| PennantError::Http(err.to_string()))?;
        self.flags = parsed.flags;
        Ok(self.flags.clone())
    }

    pub fn flags(&self) -> &FlagMap {
        &self.flags
    }

    pub fn is_enabled(&self, key: &str) -> bool {
        self.flags
            .get(key)
            .map(|flag| flag.enabled)
            .unwrap_or(false)
    }

    pub fn get_variant(&self, key: &str) -> Option<&str> {
        self.flags
            .get(key)
            .and_then(|flag| flag.variant.as_deref())
    }
}

pub fn is_enabled(flags: &FlagMap, key: &str) -> bool {
    flags.get(key).map(|flag| flag.enabled).unwrap_or(false)
}

pub fn get_variant<'a>(flags: &'a FlagMap, key: &str) -> Option<&'a str> {
    flags.get(key).and_then(|flag| flag.variant.as_deref())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread;

    fn spawn_mock(status_line: &str, body: &str) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let addr = listener.local_addr().expect("addr");
        let status = status_line.to_string();
        let body = body.to_string();
        thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept");
            let mut buf = [0_u8; 8192];
            let n = stream.read(&mut buf).unwrap_or(0);
            let request = String::from_utf8_lossy(&buf[..n]);
            assert!(request.starts_with("POST /api/client/evaluate"));
            assert!(request.contains("Authorization: Bearer pennant-client-demo"));
            assert!(request.contains("\"userId\":\"ada\""));
            assert!(request.contains("\"remoteAddress\":\"127.0.0.1\""));
            assert!(request.contains("\"hostname\":\"app.local\""));
            assert!(request.contains("\"environment\":\"production\""));
            let response = format!(
                "{status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            let _ = stream.write_all(response.as_bytes());
        });
        format!("http://{addr}")
    }

    #[test]
    fn evaluate_posts_bearer_and_returns_variant() {
        let api_url = spawn_mock(
            "HTTP/1.1 200 OK",
            r#"{"flags":{"checkout-v2":{"enabled":true,"variant":"treatment"}}}"#,
        );
        let mut client = Client::new(ClientOptions {
            api_url,
            client_key: "pennant-client-demo".into(),
            environment: "production".into(),
            project: Some("default".into()),
            context: EvaluationContext {
                user_id: Some("ada".into()),
                remote_address: Some("127.0.0.1".into()),
                hostname: Some("app.local".into()),
                ..EvaluationContext::default()
            },
        });
        let flags = client.evaluate(None).expect("evaluate");
        assert!(client.is_enabled("checkout-v2"));
        assert_eq!(client.get_variant("checkout-v2"), Some("treatment"));
        assert!(is_enabled(&flags, "checkout-v2"));
        assert_eq!(get_variant(&flags, "checkout-v2"), Some("treatment"));
    }

    #[test]
    fn evaluate_maps_unauthorized() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let addr = listener.local_addr().expect("addr");
        thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept");
            let mut buf = [0_u8; 4096];
            let _ = stream.read(&mut buf);
            let body = r#"{"error":"Invalid client key."}"#;
            let response = format!(
                "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            let _ = stream.write_all(response.as_bytes());
        });
        let mut client = Client::new(ClientOptions {
            api_url: format!("http://{addr}"),
            client_key: "bad-key".into(),
            ..ClientOptions::default()
        });
        let err = client.evaluate(None).expect_err("should fail");
        assert!(err.to_string().contains("Invalid client key"));
    }
}
