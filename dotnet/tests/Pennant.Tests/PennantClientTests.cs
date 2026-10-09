using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace Pennant.Tests
{
    public class PennantClientTests
    {
        [Fact]
        public async Task EvaluatePostsBearerAndReturnsVariant()
        {
            var handler = new StubHandler(HttpStatusCode.OK, "{\"flags\":{\"checkout-v2\":{\"enabled\":true,\"variant\":\"treatment\"}}}");
            using var client = new PennantClient(new HttpClient(handler), new PennantClientOptions
            {
                ApiUrl = "https://pennant.test/",
                ClientKey = "pennant-client-demo",
                Environment = "production",
                Project = "default",
                Context = new EvaluationContext
                {
                    UserId = "ada",
                    RemoteAddress = "127.0.0.1",
                    Hostname = "app.local",
                    Properties = new Dictionary<string, string> { ["plan"] = "pro" },
                },
            });

            var flags = await client.EvaluateAsync();

            Assert.Equal(HttpMethod.Post, handler.Request!.Method);
            Assert.Equal("https://pennant.test/api/client/evaluate", handler.Request.RequestUri!.ToString());
            Assert.Equal("Bearer pennant-client-demo", handler.Request.Headers.Authorization!.ToString());
            Assert.Equal(
                "{\"context\":{\"userId\":\"ada\",\"remoteAddress\":\"127.0.0.1\",\"hostname\":\"app.local\",\"properties\":{\"plan\":\"pro\"}},\"environment\":\"production\",\"project\":\"default\"}",
                handler.Body);
            Assert.True(flags.IsEnabled("checkout-v2"));
            Assert.Equal("treatment", flags.GetVariant("checkout-v2"));
            Assert.True(client.IsEnabled("checkout-v2"));
            Assert.Equal("treatment", client.GetVariant("checkout-v2"));
            Assert.False(client.IsEnabled("unknown"));
            Assert.Null(client.GetVariant("unknown"));
        }

        [Fact]
        public async Task OverrideContextReplacesTheDefault()
        {
            var handler = new StubHandler(HttpStatusCode.OK, "{\"flags\":{}}");
            using var client = Client(handler, new EvaluationContext { UserId = "ada" });

            await client.EvaluateAsync(new EvaluationContext { SessionId = "s-1" });

            using var body = JsonDocument.Parse(handler.Body!);
            Assert.Equal("{\"sessionId\":\"s-1\"}", body.RootElement.GetProperty("context").GetRawText());
            Assert.Equal("development", body.RootElement.GetProperty("environment").GetString());
            Assert.False(body.RootElement.TryGetProperty("project", out _));
        }

        [Fact]
        public async Task EvaluateMapsUnauthorized()
        {
            using var client = Client(new StubHandler(HttpStatusCode.Unauthorized, "{\"error\":\"Invalid client key.\"}"));
            var error = await Assert.ThrowsAsync<PennantException>(() => client.EvaluateAsync());
            Assert.Equal("Invalid client key.", error.Message);
            Assert.Equal(401, error.StatusCode);
        }

        [Fact]
        public async Task EvaluateFallsBackToStatusForNonJsonError()
        {
            using var client = Client(new StubHandler(HttpStatusCode.BadGateway, "<html>Bad Gateway</html>"));
            var error = await Assert.ThrowsAsync<PennantException>(() => client.EvaluateAsync());
            Assert.Equal("Evaluation failed (502).", error.Message);
            Assert.Empty(client.Flags);
        }

        [Fact]
        public async Task NetworkErrorsBecomePennantException()
        {
            using var client = Client(new StubHandler(new HttpRequestException("connection refused")));
            var error = await Assert.ThrowsAsync<PennantException>(() => client.EvaluateAsync());
            Assert.Equal("connection refused", error.Message);
        }

        [Fact]
        public async Task CallerCancellationIsNotWrapped()
        {
            using var client = Client(new StubHandler(HttpStatusCode.OK, "{}"));
            using var cancelled = new CancellationTokenSource();
            cancelled.Cancel();
            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => client.EvaluateAsync(null, cancelled.Token));
        }

        [Fact]
        public async Task RejectsFlagsThatAreNotAnObject()
        {
            using var client = Client(new StubHandler(HttpStatusCode.OK, "{\"flags\":[1]}"));
            var error = await Assert.ThrowsAsync<PennantException>(() => client.EvaluateAsync());
            Assert.Equal("Response flags must be an object.", error.Message);
        }

        [Fact]
        public void RequiresClientKey()
        {
            Assert.Throws<ArgumentException>(() => new PennantClient(new PennantClientOptions { ApiUrl = "https://pennant.test", ClientKey = " " }));
        }

        private static PennantClient Client(StubHandler handler, EvaluationContext? context = null) =>
            new PennantClient(new HttpClient(handler), new PennantClientOptions
            {
                ApiUrl = "https://pennant.test",
                ClientKey = "pennant-client-demo",
                Context = context ?? new EvaluationContext(),
            });

        private sealed class StubHandler : HttpMessageHandler
        {
            private readonly HttpStatusCode _status;
            private readonly string _response;
            private readonly Exception? _error;

            public StubHandler(HttpStatusCode status, string response)
            {
                _status = status;
                _response = response;
            }

            public StubHandler(Exception error)
            {
                _error = error;
                _response = "";
            }

            public HttpRequestMessage? Request { get; private set; }

            public string? Body { get; private set; }

            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                cancellationToken.ThrowIfCancellationRequested();
                Request = request;
                Body = request.Content == null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
                if (_error != null) throw _error;
                return new HttpResponseMessage(_status) { Content = new StringContent(_response, Encoding.UTF8, "application/json") };
            }
        }
    }
}
