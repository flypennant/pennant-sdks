package com.flypennant.pennant.android

import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.SocketException
import kotlin.concurrent.thread

/** One request the server received. */
class RecordedRequest(
    val method: String,
    val path: String,
    val headers: Map<String, String>,
    val body: String,
)

/**
 * A tiny HTTP/1.1 server for unit tests. android.jar has no com.sun.net.httpserver,
 * so this reads one request per connection and answers with a fixed response.
 */
class TestServer(
    private val status: Int,
    private val response: String,
) : AutoCloseable {
    private val socket = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))

    @Volatile var lastRequest: RecordedRequest? = null
        private set

    val baseUrl: String get() = "http://127.0.0.1:${socket.localPort}"

    init {
        thread(isDaemon = true) {
            while (!socket.isClosed) {
                val client =
                    try {
                        socket.accept()
                    } catch (_: SocketException) {
                        break
                    }
                client.use {
                    val input = BufferedInputStream(it.getInputStream())
                    lastRequest = read(input)
                    val bytes = response.toByteArray(Charsets.UTF_8)
                    val head =
                        "HTTP/1.1 $status Test\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n"
                    it.getOutputStream().apply {
                        write(head.toByteArray(Charsets.US_ASCII))
                        write(bytes)
                        flush()
                    }
                }
            }
        }
    }

    override fun close() {
        socket.close()
    }

    private fun read(input: InputStream): RecordedRequest {
        val (method, path) = readLine(input).split(" ").let { it[0] to it[1] }
        val headers = mutableMapOf<String, String>()
        while (true) {
            val line = readLine(input)
            if (line.isEmpty()) break
            val colon = line.indexOf(':')
            headers[line.substring(0, colon).trim().lowercase()] = line.substring(colon + 1).trim()
        }
        val length = headers["content-length"]?.toInt() ?: 0
        val body = ByteArray(length)
        var read = 0
        while (read < length) {
            val count = input.read(body, read, length - read)
            if (count < 0) break
            read += count
        }
        return RecordedRequest(method, path, headers, body.toString(Charsets.UTF_8))
    }

    private fun readLine(input: InputStream): String {
        val out = ByteArrayOutputStream()
        while (true) {
            val byte = input.read()
            if (byte < 0 || byte == '\n'.code) break
            if (byte != '\r'.code) out.write(byte)
        }
        return out.toString("US-ASCII")
    }
}
