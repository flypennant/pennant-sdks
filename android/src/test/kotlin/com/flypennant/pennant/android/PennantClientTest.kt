package com.flypennant.pennant.android

import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class PennantClientTest {
    private var server: TestServer? = null

    @AfterTest
    fun tearDown() {
        server?.close()
    }

    @Test
    fun evaluatePostsBearerAndReturnsVariant() {
        startServer(200, """{"flags":{"checkout-v2":{"enabled":true,"variant":"treatment"}}}""")

        val client =
            PennantClient(
                ClientOptions(
                    apiUrl = "${baseUrl()}/",
                    clientKey = "pennant-client-demo",
                    environment = "production",
                    project = "default",
                    context =
                        EvaluationContext(
                            userId = "ada",
                            remoteAddress = "127.0.0.1",
                            hostname = "app.local",
                            properties = mapOf("plan" to "pro"),
                        ),
                ),
            )

        val flags = client.evaluate()
        val request = server!!.lastRequest!!
        val sent = JSONObject(request.body)
        assertEquals("POST", request.method)
        assertEquals("/api/client/evaluate", request.path)
        assertEquals("Bearer pennant-client-demo", request.headers["authorization"])
        assertEquals("ada", sent.getJSONObject("context").getString("userId"))
        assertEquals("127.0.0.1", sent.getJSONObject("context").getString("remoteAddress"))
        assertEquals("app.local", sent.getJSONObject("context").getString("hostname"))
        assertEquals("pro", sent.getJSONObject("context").getJSONObject("properties").getString("plan"))
        assertEquals("production", sent.getString("environment"))
        assertEquals("default", sent.getString("project"))
        assertTrue(client.isEnabled("checkout-v2"))
        assertEquals("treatment", client.getVariant("checkout-v2"))
        assertTrue(PennantClient.isEnabled(flags, "checkout-v2"))
        assertEquals("treatment", PennantClient.getVariant(flags, "checkout-v2"))
        assertFalse(client.isEnabled("unknown"))
        assertNull(client.getVariant("unknown"))
    }

    @Test
    fun overrideContextReplacesTheDefault() {
        startServer(200, """{"flags":{}}""")

        client(EvaluationContext(userId = "ada")).evaluate(EvaluationContext(sessionId = "s-1"))

        val sent = JSONObject(server!!.lastRequest!!.body)
        assertEquals("""{"sessionId":"s-1"}""", sent.getJSONObject("context").toString())
        assertEquals("development", sent.getString("environment"))
        assertFalse(sent.has("project"))
    }

    @Test
    fun evaluateMapsUnauthorized() {
        startServer(401, """{"error":"Invalid client key."}""")
        val error = assertFailsWith<PennantException> { client().evaluate() }
        assertEquals("Invalid client key.", error.message)
        assertEquals(401, error.statusCode)
    }

    @Test
    fun evaluateFallsBackToStatusForNonJsonError() {
        startServer(502, "<html>Bad Gateway</html>")
        val client = client()
        val error = assertFailsWith<PennantException> { client.evaluate() }
        assertEquals("Evaluation failed (502).", error.message)
        assertTrue(client.flags().isEmpty())
    }

    @Test
    fun evaluateAsyncDeliversOnTheCallbackExecutor() {
        startServer(200, """{"flags":{"checkout-v2":{"enabled":true}}}""")
        val delivered = CountDownLatch(1)
        val onCallbackExecutor = AtomicReference(false)
        val result = AtomicReference<FlagMap>()
        val marker = ThreadLocal.withInitial { false }
        val callbackExecutor =
            Executor { command ->
                Thread {
                    marker.set(true)
                    command.run()
                }.start()
            }
        val client =
            PennantClient(
                ClientOptions(apiUrl = baseUrl(), clientKey = "pennant-client-demo"),
                callbackExecutor = callbackExecutor,
            )

        client.evaluateAsync(
            callback =
                object : EvaluateCallback {
                    override fun onSuccess(flags: FlagMap) {
                        onCallbackExecutor.set(marker.get())
                        result.set(flags)
                        delivered.countDown()
                    }

                    override fun onError(error: PennantException) {
                        delivered.countDown()
                    }
                },
        )

        assertTrue(delivered.await(5, TimeUnit.SECONDS))
        assertTrue(onCallbackExecutor.get())
        assertTrue(PennantClient.isEnabled(result.get(), "checkout-v2"))
        client.close()
    }

    @Test
    fun connectionErrorsBecomePennantException() {
        val client = PennantClient(ClientOptions(apiUrl = "http://127.0.0.1:1", clientKey = "pennant-client-demo"))
        assertFailsWith<PennantException> { client.evaluate() }
    }

    @Test
    fun requiresClientKey() {
        assertFailsWith<IllegalArgumentException> {
            PennantClient(ClientOptions(apiUrl = "https://pennant.test", clientKey = " "))
        }
    }

    private fun client(context: EvaluationContext = EvaluationContext()) =
        PennantClient(ClientOptions(apiUrl = baseUrl(), clientKey = "pennant-client-demo", context = context))

    private fun startServer(
        status: Int,
        response: String,
    ) {
        server = TestServer(status, response)
    }

    private fun baseUrl(): String = server!!.baseUrl
}
