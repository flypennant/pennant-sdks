package com.flypennant.pennant

import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

/** POST /api/client/evaluate with a project client key. */
class PennantClient(
    options: ClientOptions,
    private val httpClient: HttpClient =
        HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build(),
) {
    private val apiUrl = options.apiUrl.trimEnd('/')
    private val clientKey = options.clientKey
    private val environment = options.environment.ifBlank { "development" }
    private val project = options.project
    private val context = options.context
    @Volatile private var flags: FlagMap = emptyMap()

    init {
        require(apiUrl.isNotBlank()) { "apiUrl is required" }
        require(clientKey.isNotBlank()) { "clientKey is required" }
    }

    /** POSTs to /api/client/evaluate. Pass null to use the client default context. */
    fun evaluate(override: EvaluationContext? = null): FlagMap {
        val active = override ?: context
        val payload =
            buildMap<String, Any?> {
                put("context", active.toJsonMap())
                put("environment", environment)
                if (!project.isNullOrBlank()) put("project", project)
            }

        val request =
            HttpRequest.newBuilder(URI.create("$apiUrl/api/client/evaluate"))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer $clientKey")
                .POST(HttpRequest.BodyPublishers.ofString(Json.stringify(payload)))
                .build()

        val response =
            try {
                httpClient.send(request, HttpResponse.BodyHandlers.ofString())
            } catch (ex: Exception) {
                if (ex is InterruptedException) Thread.currentThread().interrupt()
                throw PennantException(ex.message ?: "evaluate failed", ex)
            }

        val body = response.body().orEmpty()
        if (response.statusCode() >= 400) {
            throw PennantException(errorMessage(body, response.statusCode()))
        }
        val parsed = if (body.isBlank()) emptyMap() else Json.parseObject(body)

        val next = parseFlags(parsed["flags"])
        flags = next
        return next
    }

    fun flags(): FlagMap = flags

    fun isEnabled(key: String): Boolean = flags[key]?.enabled == true

    fun getVariant(key: String): String? = flags[key]?.variant

    companion object {
        fun isEnabled(flags: FlagMap, key: String): Boolean = flags[key]?.enabled == true

        fun getVariant(flags: FlagMap, key: String): String? = flags[key]?.variant
    }
}

private fun EvaluationContext.toJsonMap(): Map<String, Any?> =
    buildMap {
        userId?.let { put("userId", it) }
        sessionId?.let { put("sessionId", it) }
        remoteAddress?.let { put("remoteAddress", it) }
        hostname?.let { put("hostname", it) }
        if (!properties.isNullOrEmpty()) put("properties", properties)
    }

// A proxy can answer with HTML, so a body that is not JSON falls back to the status.
private fun errorMessage(body: String, status: Int): String {
    val message =
        try {
            if (body.isBlank()) null else Json.parseObject(body)["error"] as? String
        } catch (_: PennantException) {
            null
        }
    return if (!message.isNullOrBlank()) message else "Evaluation failed ($status)."
}

private fun parseFlags(flagsValue: Any?): FlagMap {
    if (flagsValue == null) return emptyMap()
    val raw =
        flagsValue as? Map<*, *>
            ?: throw PennantException("Response flags must be an object.")
    return raw.entries.associate { (key, value) ->
        val flagMap =
            value as? Map<*, *>
                ?: throw PennantException("Flag evaluation must be an object.")
        val enabled = flagMap["enabled"] as? Boolean ?: false
        val variant = flagMap["variant"] as? String
        key.toString() to FlagEvaluation(enabled = enabled, variant = variant)
    }
}
