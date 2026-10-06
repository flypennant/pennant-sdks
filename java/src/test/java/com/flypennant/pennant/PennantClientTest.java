package com.flypennant.pennant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class PennantClientTest {
  private HttpServer server;

  @AfterEach
  void tearDown() {
    if (server != null) {
      server.stop(0);
    }
  }

  @Test
  void evaluatePostsBearerAndReturnsVariant() throws Exception {
    AtomicReference<String> auth = new AtomicReference<>();
    AtomicReference<String> body = new AtomicReference<>();
    server =
        startServer(
            (exchange) -> {
              assertEquals("/api/client/evaluate", exchange.getRequestURI().getPath());
              assertEquals("POST", exchange.getRequestMethod());
              auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
              body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
              byte[] response =
                  "{\"flags\":{\"checkout-v2\":{\"enabled\":true,\"variant\":\"treatment\"}}}"
                      .getBytes(StandardCharsets.UTF_8);
              exchange.getResponseHeaders().add("Content-Type", "application/json");
              exchange.sendResponseHeaders(200, response.length);
              try (OutputStream out = exchange.getResponseBody()) {
                out.write(response);
              }
            });

    PennantClient client =
        PennantClient.builder()
            .apiUrl(baseUrl() + "/")
            .clientKey("pennant-client-demo")
            .environment("production")
            .project("default")
            .context(
                EvaluationContext.builder()
                    .userId("ada")
                    .remoteAddress("127.0.0.1")
                    .hostname("app.local")
                    .build())
            .build();

    Map<String, FlagEvaluation> flags = client.evaluate();
    assertEquals("Bearer pennant-client-demo", auth.get());
    assertTrue(body.get().contains("\"userId\":\"ada\""));
    assertTrue(body.get().contains("\"remoteAddress\":\"127.0.0.1\""));
    assertTrue(body.get().contains("\"hostname\":\"app.local\""));
    assertTrue(body.get().contains("\"environment\":\"production\""));
    assertTrue(body.get().contains("\"project\":\"default\""));
    assertTrue(client.isEnabled("checkout-v2"));
    assertEquals("treatment", client.getVariant("checkout-v2").orElseThrow());
    assertTrue(PennantClient.isEnabled(flags, "checkout-v2"));
    assertEquals("treatment", PennantClient.getVariant(flags, "checkout-v2").orElseThrow());
  }

  @Test
  void evaluateMapsUnauthorized() throws Exception {
    server =
        startServer(
            (exchange) -> {
              byte[] response =
                  "{\"error\":\"Invalid client key.\"}".getBytes(StandardCharsets.UTF_8);
              exchange.getResponseHeaders().add("Content-Type", "application/json");
              exchange.sendResponseHeaders(401, response.length);
              try (OutputStream out = exchange.getResponseBody()) {
                out.write(response);
              }
            });

    PennantClient client =
        PennantClient.builder().apiUrl(baseUrl()).clientKey("bad-key").build();
    PennantException error = assertThrows(PennantException.class, () -> client.evaluate(null));
    assertEquals("Invalid client key.", error.getMessage());
  }

  @Test
  void evaluateFallsBackToStatusForNonJsonError() throws Exception {
    server =
        startServer(
            (exchange) -> {
              byte[] response = "<html>Bad Gateway</html>".getBytes(StandardCharsets.UTF_8);
              exchange.getResponseHeaders().add("Content-Type", "text/html");
              exchange.sendResponseHeaders(502, response.length);
              try (OutputStream out = exchange.getResponseBody()) {
                out.write(response);
              }
            });

    PennantClient client =
        PennantClient.builder().apiUrl(baseUrl()).clientKey("pennant-client-demo").build();
    PennantException error = assertThrows(PennantException.class, client::evaluate);
    assertEquals("Evaluation failed (502).", error.getMessage());
    assertTrue(client.flags().isEmpty());
  }

  private HttpServer startServer(com.sun.net.httpserver.HttpHandler handler) throws IOException {
    HttpServer httpServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    httpServer.createContext("/api/client/evaluate", handler);
    httpServer.start();
    this.server = httpServer;
    return httpServer;
  }

  private String baseUrl() {
    return "http://127.0.0.1:" + server.getAddress().getPort();
  }
}
