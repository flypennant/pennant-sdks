import 'package:flutter/foundation.dart';

/// Evaluation context fields accepted by POST /api/client/evaluate.
@immutable
class EvaluationContext {
  /// Creates a context. Every field is optional.
  const EvaluationContext({
    this.userId,
    this.sessionId,
    this.remoteAddress,
    this.hostname,
    this.properties = const {},
  });

  /// Sticky id for gradual rollout and variants.
  final String? userId;

  /// Fallback sticky id when [userId] is missing.
  final String? sessionId;

  /// Used by the remoteAddress strategy.
  final String? remoteAddress;

  /// Used by the hostname strategy.
  final String? hostname;

  /// Custom string map for constraints and segments.
  final Map<String, String> properties;

  /// The JSON body for the `context` field. Unset fields are left out.
  Map<String, Object> toJson() => {
        if (userId != null) 'userId': userId!,
        if (sessionId != null) 'sessionId': sessionId!,
        if (remoteAddress != null) 'remoteAddress': remoteAddress!,
        if (hostname != null) 'hostname': hostname!,
        if (properties.isNotEmpty) 'properties': properties,
      };

  @override
  bool operator ==(Object other) =>
      other is EvaluationContext &&
      other.userId == userId &&
      other.sessionId == sessionId &&
      other.remoteAddress == remoteAddress &&
      other.hostname == hostname &&
      mapEquals(other.properties, properties);

  @override
  int get hashCode => Object.hash(
        userId,
        sessionId,
        remoteAddress,
        hostname,
        Object.hashAllUnordered(properties.entries.map((e) => Object.hash(e.key, e.value))),
      );
}

/// One flag evaluation result.
@immutable
class FlagEvaluation {
  /// Creates a result.
  const FlagEvaluation({required this.enabled, this.variant});

  /// Whether the flag is on.
  final bool enabled;

  /// The sticky variant, when the flag is on and defines variants.
  final String? variant;

  @override
  bool operator ==(Object other) =>
      other is FlagEvaluation && other.enabled == enabled && other.variant == variant;

  @override
  int get hashCode => Object.hash(enabled, variant);
}

/// Flag keys mapped to evaluations. Unknown flags read as off.
@immutable
class FlagMap {
  /// Wraps an unmodifiable copy of [flags].
  FlagMap(Map<String, FlagEvaluation> flags) : _flags = Map.unmodifiable(flags);

  const FlagMap._empty() : _flags = const {};

  /// A map with no flags.
  static const FlagMap empty = FlagMap._empty();

  final Map<String, FlagEvaluation> _flags;

  /// Whether [key] is on. Unknown flags are off.
  bool isEnabled(String key) => _flags[key]?.enabled ?? false;

  /// The sticky variant for [key], or null.
  String? getVariant(String key) => _flags[key]?.variant;

  /// The evaluation for [key], or null when the server did not return it.
  FlagEvaluation? operator [](String key) => _flags[key];

  /// Every flag, unmodifiable.
  Map<String, FlagEvaluation> get all => _flags;

  /// Whether no flags were returned.
  bool get isEmpty => _flags.isEmpty;

  @override
  bool operator ==(Object other) => other is FlagMap && mapEquals(other._flags, _flags);

  @override
  int get hashCode =>
      Object.hashAllUnordered(_flags.entries.map((e) => Object.hash(e.key, e.value)));
}

/// Raised when evaluate fails. [statusCode] is set when the server answered.
class PennantException implements Exception {
  /// Creates the exception.
  const PennantException(this.message, {this.statusCode});

  /// What went wrong.
  final String message;

  /// The HTTP status, when the server answered.
  final int? statusCode;

  @override
  String toString() => 'PennantException: $message';
}
