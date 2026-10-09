package com.flypennant.pennant.android

/** Evaluation context fields accepted by POST /api/client/evaluate. */
data class EvaluationContext
    @JvmOverloads
    constructor(
        val userId: String? = null,
        val sessionId: String? = null,
        val remoteAddress: String? = null,
        val hostname: String? = null,
        val properties: Map<String, String>? = null,
    )

/** One flag evaluation result. */
data class FlagEvaluation
    @JvmOverloads
    constructor(
        val enabled: Boolean,
        val variant: String? = null,
    )

typealias FlagMap = Map<String, FlagEvaluation>

/** Options for [PennantClient]. */
data class ClientOptions
    @JvmOverloads
    constructor(
        val apiUrl: String,
        val clientKey: String,
        val environment: String = "development",
        val project: String? = null,
        val context: EvaluationContext = EvaluationContext(),
        val connectTimeoutMs: Int = 10_000,
        val readTimeoutMs: Int = 10_000,
    )

/** Raised when evaluate fails. [statusCode] is set when the server answered. */
class PennantException
    @JvmOverloads
    constructor(
        message: String,
        cause: Throwable? = null,
        val statusCode: Int? = null,
    ) : RuntimeException(message, cause)

/** Result of [PennantClient.evaluateAsync], delivered on the callback executor. */
interface EvaluateCallback {
    fun onSuccess(flags: FlagMap)

    fun onError(error: PennantException)
}
