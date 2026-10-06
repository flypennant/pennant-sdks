package com.flypennant.pennant;

import java.util.Objects;
import java.util.Optional;

/** One flag evaluation result. */
public final class FlagEvaluation {
  private final boolean enabled;
  private final String variant;

  public FlagEvaluation(boolean enabled, String variant) {
    this.enabled = enabled;
    this.variant = variant;
  }

  public boolean enabled() {
    return enabled;
  }

  public Optional<String> variant() {
    return Optional.ofNullable(variant);
  }

  @Override
  public boolean equals(Object other) {
    if (this == other) {
      return true;
    }
    if (!(other instanceof FlagEvaluation that)) {
      return false;
    }
    return enabled == that.enabled && Objects.equals(variant, that.variant);
  }

  @Override
  public int hashCode() {
    return Objects.hash(enabled, variant);
  }
}
