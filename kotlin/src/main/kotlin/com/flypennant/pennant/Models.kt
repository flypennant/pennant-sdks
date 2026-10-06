package com.flypennant.pennant

/** Evaluation context fields accepted by POST /api/client/evaluate. */
data class EvaluationContext(
    val userId: String? = null,
    val sessionId: String? = null,
    val remoteAddress: String? = null,
    val hostname: String? = null,
    val properties: Map<String, String>? = null,
)

/** One flag evaluation result. */
data class FlagEvaluation(
    val enabled: Boolean,
    val variant: String? = null,
)

typealias FlagMap = Map<String, FlagEvaluation>

/** Options for [PennantClient]. */
data class ClientOptions(
    val apiUrl: String,
    val clientKey: String,
    val environment: String = "development",
    val project: String? = null,
    val context: EvaluationContext = EvaluationContext(),
)

/** Raised when evaluate fails. */
class PennantException(message: String, cause: Throwable? = null) : RuntimeException(message, cause)
