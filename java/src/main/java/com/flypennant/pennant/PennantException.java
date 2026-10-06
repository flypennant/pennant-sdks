package com.flypennant.pennant;

/** Raised when evaluate fails. */
public final class PennantException extends RuntimeException {
  public PennantException(String message) {
    super(message);
  }

  public PennantException(String message, Throwable cause) {
    super(message, cause);
  }
}
