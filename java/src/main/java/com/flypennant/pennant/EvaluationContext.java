package com.flypennant.pennant;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/** Evaluation context fields accepted by POST /api/client/evaluate. */
public final class EvaluationContext {
  private final String userId;
  private final String sessionId;
  private final String remoteAddress;
  private final String hostname;
  private final Map<String, String> properties;

  private EvaluationContext(Builder builder) {
    this.userId = builder.userId;
    this.sessionId = builder.sessionId;
    this.remoteAddress = builder.remoteAddress;
    this.hostname = builder.hostname;
    this.properties =
        builder.properties == null
            ? Map.of()
            : Collections.unmodifiableMap(new LinkedHashMap<>(builder.properties));
  }

  public static Builder builder() {
    return new Builder();
  }

  public String userId() {
    return userId;
  }

  public String sessionId() {
    return sessionId;
  }

  public String remoteAddress() {
    return remoteAddress;
  }

  public String hostname() {
    return hostname;
  }

  public Map<String, String> properties() {
    return properties;
  }

  Map<String, Object> toJsonMap() {
    Map<String, Object> map = new LinkedHashMap<>();
    if (userId != null) {
      map.put("userId", userId);
    }
    if (sessionId != null) {
      map.put("sessionId", sessionId);
    }
    if (remoteAddress != null) {
      map.put("remoteAddress", remoteAddress);
    }
    if (hostname != null) {
      map.put("hostname", hostname);
    }
    if (!properties.isEmpty()) {
      map.put("properties", properties);
    }
    return map;
  }

  public static final class Builder {
    private String userId;
    private String sessionId;
    private String remoteAddress;
    private String hostname;
    private Map<String, String> properties;

    public Builder userId(String userId) {
      this.userId = userId;
      return this;
    }

    public Builder sessionId(String sessionId) {
      this.sessionId = sessionId;
      return this;
    }

    public Builder remoteAddress(String remoteAddress) {
      this.remoteAddress = remoteAddress;
      return this;
    }

    public Builder hostname(String hostname) {
      this.hostname = hostname;
      return this;
    }

    public Builder properties(Map<String, String> properties) {
      this.properties = properties == null ? null : new LinkedHashMap<>(properties);
      return this;
    }

    public EvaluationContext build() {
      return new EvaluationContext(this);
    }
  }

  @Override
  public boolean equals(Object other) {
    if (this == other) {
      return true;
    }
    if (!(other instanceof EvaluationContext that)) {
      return false;
    }
    return Objects.equals(userId, that.userId)
        && Objects.equals(sessionId, that.sessionId)
        && Objects.equals(remoteAddress, that.remoteAddress)
        && Objects.equals(hostname, that.hostname)
        && Objects.equals(properties, that.properties);
  }

  @Override
  public int hashCode() {
    return Objects.hash(userId, sessionId, remoteAddress, hostname, properties);
  }
}
