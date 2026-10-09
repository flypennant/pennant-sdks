package com.flypennant.pennant

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import java.nio.charset.StandardCharsets
import kotlin.test.AfterTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class PennantClientTest {
    private var server: HttpServer? = null

    @AfterTest
    fun tearDown() {
        server?.stop(0)
    }

    @Test
    fun evaluatePostsBearerAndReturnsVariant() {
        var auth: String? = null
        var body = ""
        server =
            startServer { exchange ->
                assertEquals("/api/client/evaluate", exchange.requestURI.path)
                assertEquals("POST", exchange.requestMethod)
                auth = exchange.requestHeaders.getFirst("Authorization")
                body = exchange.requestBody.readAllBytes().toString(StandardCharsets.UTF_8)
                val response =
                    """{"flags":{"checkout-v2":{"enabled":true,"variant":"treatment"}}}"""
                        .toByteArray(StandardCharsets.UTF_8)
                exchange.responseHeaders.add("Content-Type", "application/json")
                exchange.sendResponseHeaders(200, response.size.toLong())
                exchange.responseBody.use { it.write(response) }
            }

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
                        ),
                ),
            )

        val flags = client.evaluate()
        assertEquals("Bearer pennant-client-demo", auth)
        assertTrue(body.contains("\"userId\":\"ada\""))
        assertTrue(body.contains("\"remoteAddress\":\"127.0.0.1\""))
        assertTrue(body.contains("\"hostname\":\"app.local\""))
        assertTrue(body.contains("\"environment\":\"production\""))
        assertTrue(body.contains("\"project\":\"default\""))
        assertTrue(client.isEnabled("checkout-v2"))
        assertEquals("treatment", client.getVariant("checkout-v2"))
        assertTrue(PennantClient.isEnabled(flags, "checkout-v2"))
        assertEquals("treatment", PennantClient.getVariant(flags, "checkout-v2"))
    }

    @Test
    fun evaluateMapsUnauthorized() {
        server =
            startServer { exchange ->
                val response = """{"error":"Invalid client key."}""".toByteArray(StandardCharsets.UTF_8)
                exchange.responseHeaders.add("Content-Type", "application/json")
                exchange.sendResponseHeaders(401, response.size.toLong())
                exchange.responseBody.use { it.write(response) }
            }

        val client =
            PennantClient(
                ClientOptions(
                    apiUrl = baseUrl(),
                    clientKey = "bad-key",
                ),
            )
        val error = assertFailsWith<PennantException> { client.evaluate() }
        assertEquals("Invalid client key.", error.message)
    }

    @Test
    fun evaluateFallsBackToStatusForNonJsonError() {
        server =
            startServer { exchange ->
                val response = "<html>Bad Gateway</html>".toByteArray(StandardCharsets.UTF_8)
                exchange.responseHeaders.add("Content-Type", "text/html")
                exchange.sendResponseHeaders(502, response.size.toLong())
                exchange.responseBody.use { it.write(response) }
            }

        val client = PennantClient(ClientOptions(apiUrl = baseUrl(), clientKey = "pennant-client-demo"))
        val error = assertFailsWith<PennantException> { client.evaluate() }
        assertEquals("Evaluation failed (502).", error.message)
        assertTrue(client.flags().isEmpty())
    }

    private fun startServer(handler: com.sun.net.httpserver.HttpHandler): HttpServer {
        val httpServer = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        httpServer.createContext("/api/client/evaluate", handler)
        httpServer.start()
        server = httpServer
        return httpServer
    }

    private fun baseUrl(): String = "http://127.0.0.1:${server!!.address.port}"
}
