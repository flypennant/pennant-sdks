package com.flypennant.pennant.android

import android.os.Handler
import android.os.Looper
import org.json.JSONException
import org.json.JSONObject
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executor
import java.util.concurrent.Executors

/**
 * POST /api/client/evaluate with a project client key.
 *
 * Create one client for the app, for example in `Application.onCreate`, and share it.
 * [evaluate] blocks, so call it off the main thread; [evaluateAsync] does that for you.
 */
class PennantClient
    @JvmOverloads
    constructor(
        options: ClientOptions,
        private val backgroundExecutor: ExecutorService = Executors.newSingleThreadExecutor(),
        private val callbackExecutor: Executor = MainThreadExecutor,
    ) {
        private val endpoint: URL
        private val clientKey = options.clientKey.trim()
        private val environment = options.environment.trim().ifEmpty { "development" }
        private val project = options.project?.takeIf { it.isNotBlank() }
        private val context = options.context
        private val connectTimeoutMs = options.connectTimeoutMs
        private val readTimeoutMs = options.readTimeoutMs

        @Volatile private var flags: FlagMap = emptyMap()

        init {
            require(options.apiUrl.isNotBlank()) { "apiUrl is required" }
            require(clientKey.isNotEmpty()) { "clientKey is required" }
            endpoint = URL(options.apiUrl.trim().trimEnd('/') + "/api/client/evaluate")
        }

        /** The last evaluate result. */
        fun flags(): FlagMap = flags

        fun isEnabled(key: String): Boolean = flags[key]?.enabled == true

        fun getVariant(key: String): String? = flags[key]?.variant

        /** POSTs to /api/client/evaluate on the calling thread. Pass null to use the default context. */
        @JvmOverloads
        fun evaluate(override: EvaluationContext? = null): FlagMap {
            val payload =
                JSONObject().apply {
                    put("context", (override ?: context).toJson())
                    put("environment", environment)
                    project?.let { put("project", it) }
                }

            val connection =
                try {
                    endpoint.openConnection() as HttpURLConnection
                } catch (ex: IOException) {
                    throw PennantException(ex.message ?: "Evaluate request failed.", ex)
                }
            try {
                connection.requestMethod = "POST"
                connection.connectTimeout = connectTimeoutMs
                connection.readTimeout = readTimeoutMs
                connection.doOutput = true
                connection.useCaches = false
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setRequestProperty("Accept", "application/json")
                connection.setRequestProperty("Authorization", "Bearer $clientKey")
                connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }

                val status = connection.responseCode
                val stream = if (status >= 400) connection.errorStream else connection.inputStream
                val body = stream.readText()
                if (status >= 400) {
                    throw PennantException(errorMessage(body, status), statusCode = status)
                }
                val next = parseFlags(body)
                flags = next
                return next
            } catch (ex: IOException) {
                throw PennantException(ex.message ?: "Evaluate request failed.", ex)
            } finally {
                connection.disconnect()
            }
        }

        /** Evaluates on the background executor and calls back on the main thread. */
        @JvmOverloads
        fun evaluateAsync(
            override: EvaluationContext? = null,
            callback: EvaluateCallback,
        ) {
            backgroundExecutor.execute {
                try {
                    val result = evaluate(override)
                    callbackExecutor.execute { callback.onSuccess(result) }
                } catch (ex: PennantException) {
                    callbackExecutor.execute { callback.onError(ex) }
                } catch (ex: RuntimeException) {
                    val error = PennantException(ex.message ?: "Evaluate failed.", ex)
                    callbackExecutor.execute { callback.onError(error) }
                }
            }
        }

        /** Stops the background executor. The client cannot evaluate asynchronously after this. */
        fun close() {
            backgroundExecutor.shutdown()
        }

        companion object {
            @JvmStatic
            fun isEnabled(
                flags: FlagMap,
                key: String,
            ): Boolean = flags[key]?.enabled == true

            @JvmStatic
            fun getVariant(
                flags: FlagMap,
                key: String,
            ): String? = flags[key]?.variant
        }
    }

private object MainThreadExecutor : Executor {
    private val handler by lazy { Handler(Looper.getMainLooper()) }

    override fun execute(command: Runnable) {
        handler.post(command)
    }
}

private fun InputStream?.readText(): String = this?.use { it.readBytes().toString(Charsets.UTF_8) }.orEmpty()

private fun EvaluationContext.toJson(): JSONObject =
    JSONObject().apply {
        userId?.let { put("userId", it) }
        sessionId?.let { put("sessionId", it) }
        remoteAddress?.let { put("remoteAddress", it) }
        hostname?.let { put("hostname", it) }
        if (!properties.isNullOrEmpty()) put("properties", JSONObject(properties))
    }

// A proxy can answer with HTML, so a body that is not JSON falls back to the status.
private fun errorMessage(
    body: String,
    status: Int,
): String {
    val message =
        try {
            JSONObject(body).optString("error")
        } catch (_: JSONException) {
            ""
        }
    return message.ifEmpty { "Evaluation failed ($status)." }
}

private fun parseFlags(body: String): FlagMap {
    if (body.isBlank()) return emptyMap()
    val root =
        try {
            JSONObject(body)
        } catch (ex: JSONException) {
            throw PennantException("Response must be a JSON object.", ex)
        }
    if (!root.has("flags") || root.isNull("flags")) return emptyMap()
    val raw = root.opt("flags") as? JSONObject ?: throw PennantException("Response flags must be an object.")
    val parsed = LinkedHashMap<String, FlagEvaluation>()
    for (key in raw.keys()) {
        val flag = raw.opt(key) as? JSONObject ?: throw PennantException("Flag evaluation must be an object.")
        val enabled = flag.opt("enabled") == true
        val variant = flag.opt("variant") as? String
        parsed[key] = FlagEvaluation(enabled, variant)
    }
    return parsed
}
