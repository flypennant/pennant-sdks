package com.flypennant.pennant;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/** POST /api/client/evaluate with a project client key. */
public final class PennantClient {
  private final String apiUrl;
  private final String clientKey;
  private final String environment;
  private final String project;
  private final EvaluationContext context;
  private final HttpClient httpClient;
  private volatile Map<String, FlagEvaluation> flags = Map.of();

  private PennantClient(Builder builder) {
    if (builder.apiUrl == null || builder.apiUrl.isBlank()) {
      throw new IllegalArgumentException("apiUrl is required");
    }
    if (builder.clientKey == null || builder.clientKey.isBlank()) {
      throw new IllegalArgumentException("clientKey is required");
    }
    this.apiUrl = trimTrailingSlash(builder.apiUrl);
    this.clientKey = builder.clientKey;
    this.environment =
        builder.environment == null || builder.environment.isBlank()
            ? "development"
            : builder.environment;
    this.project = builder.project;
    this.context = builder.context == null ? EvaluationContext.builder().build() : builder.context;
    this.httpClient =
        builder.httpClient == null
            ? HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()
            : builder.httpClient;
  }

  public static Builder builder() {
    return new Builder();
  }

  /** POSTs to /api/client/evaluate with the client default context. */
  public Map<String, FlagEvaluation> evaluate() {
    return evaluate(null);
  }

  /** POSTs to /api/client/evaluate. Pass null to use the client default context. */
  public Map<String, FlagEvaluation> evaluate(EvaluationContext override) {
    EvaluationContext active = override == null ? context : override;
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("context", active.toJsonMap());
    payload.put("environment", environment);
    if (project != null && !project.isBlank()) {
      payload.put("project", project);
    }

    HttpRequest request =
        HttpRequest.newBuilder(URI.create(apiUrl + "/api/client/evaluate"))
            .timeout(Duration.ofSeconds(30))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + clientKey)
            .POST(HttpRequest.BodyPublishers.ofString(Json.stringify(payload)))
            .build();

    HttpResponse<String> response;
    try {
      response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    } catch (IOException | InterruptedException ex) {
      if (ex instanceof InterruptedException) {
        Thread.currentThread().interrupt();
      }
      throw new PennantException(ex.getMessage() == null ? "evaluate failed" : ex.getMessage(), ex);
    }

    String body = response.body() == null ? "" : response.body();
    if (response.statusCode() >= 400) {
      throw new PennantException(errorMessage(body, response.statusCode()));
    }
    Map<String, Object> parsed = body.isBlank() ? Map.of() : Json.parseObject(body);

    Object flagsValue = parsed.get("flags");
    Map<String, FlagEvaluation> next = parseFlags(flagsValue);
    this.flags = next;
    return next;
  }

  public Map<String, FlagEvaluation> flags() {
    return flags;
  }

  public boolean isEnabled(String key) {
    FlagEvaluation flag = flags.get(key);
    return flag != null && flag.enabled();
  }

  public Optional<String> getVariant(String key) {
    FlagEvaluation flag = flags.get(key);
    return flag == null ? Optional.empty() : flag.variant();
  }

  public static boolean isEnabled(Map<String, FlagEvaluation> flags, String key) {
    FlagEvaluation flag = flags.get(key);
    return flag != null && flag.enabled();
  }

  public static Optional<String> getVariant(Map<String, FlagEvaluation> flags, String key) {
    FlagEvaluation flag = flags.get(key);
    return flag == null ? Optional.empty() : flag.variant();
  }

  @SuppressWarnings("unchecked")
  private static Map<String, FlagEvaluation> parseFlags(Object flagsValue) {
    if (flagsValue == null) {
      return Map.of();
    }
    if (!(flagsValue instanceof Map<?, ?> raw)) {
      throw new PennantException("Response flags must be an object.");
    }
    Map<String, FlagEvaluation> parsed = new LinkedHashMap<>();
    for (Map.Entry<?, ?> entry : raw.entrySet()) {
      String key = Objects.toString(entry.getKey(), null);
      if (key == null) {
        continue;
      }
      if (!(entry.getValue() instanceof Map<?, ?> flagMap)) {
        throw new PennantException("Flag evaluation must be an object.");
      }
      Object enabledValue = ((Map<String, Object>) flagMap).get("enabled");
      boolean enabled = enabledValue instanceof Boolean bool && bool;
      Object variantValue = ((Map<String, Object>) flagMap).get("variant");
      String variant = variantValue instanceof String text ? text : null;
      parsed.put(key, new FlagEvaluation(enabled, variant));
    }
    return Collections.unmodifiableMap(parsed);
  }

  // A proxy can answer with HTML, so a body that is not JSON falls back to the status.
  private static String errorMessage(String body, int status) {
    try {
      Object error = body.isBlank() ? null : Json.parseObject(body).get("error");
      if (error instanceof String message && !message.isBlank()) {
        return message;
      }
    } catch (PennantException ignored) {
      // Not JSON.
    }
    return "Evaluation failed (" + status + ").";
  }

  private static String trimTrailingSlash(String value) {
    int end = value.length();
    while (end > 0 && value.charAt(end - 1) == '/') {
      end--;
    }
    return value.substring(0, end);
  }

  public static final class Builder {
    private String apiUrl;
    private String clientKey;
    private String environment = "development";
    private String project;
    private EvaluationContext context;
    private HttpClient httpClient;

    public Builder apiUrl(String apiUrl) {
      this.apiUrl = apiUrl;
      return this;
    }

    public Builder clientKey(String clientKey) {
      this.clientKey = clientKey;
      return this;
    }

    public Builder environment(String environment) {
      this.environment = environment;
      return this;
    }

    public Builder project(String project) {
      this.project = project;
      return this;
    }

    public Builder context(EvaluationContext context) {
      this.context = context;
      return this;
    }

    public Builder httpClient(HttpClient httpClient) {
      this.httpClient = httpClient;
      return this;
    }

    public PennantClient build() {
      return new PennantClient(this);
    }
  }
}
