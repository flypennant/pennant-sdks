using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Pennant
{
    /// <summary>
    /// POST /api/client/evaluate with a project client key. Create one per process and share it.
    /// </summary>
    public sealed class PennantClient : IDisposable
    {
        private readonly HttpClient _http;
        private readonly bool _ownsHttp;
        private readonly Uri _endpoint;
        private readonly string _clientKey;
        private readonly string _environment;
        private readonly string? _project;
        private readonly EvaluationContext _context;
        private volatile FlagMap _flags = FlagMap.Empty;

        /// <summary>Creates a client with its own HttpClient.</summary>
        public PennantClient(PennantClientOptions options)
            : this(new HttpClient { Timeout = options?.Timeout ?? TimeSpan.FromSeconds(10) }, options!, ownsHttp: true)
        {
        }

        /// <summary>Creates a client on a caller-owned HttpClient, for example one from IHttpClientFactory.</summary>
        public PennantClient(HttpClient httpClient, PennantClientOptions options)
            : this(httpClient, options, ownsHttp: false)
        {
        }

        private PennantClient(HttpClient httpClient, PennantClientOptions options, bool ownsHttp)
        {
            if (options == null) throw new ArgumentNullException(nameof(options));
            if (string.IsNullOrWhiteSpace(options.ApiUrl)) throw new ArgumentException("ApiUrl is required", nameof(options));
            if (string.IsNullOrWhiteSpace(options.ClientKey)) throw new ArgumentException("ClientKey is required", nameof(options));

            _http = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
            _ownsHttp = ownsHttp;
            _endpoint = new Uri(options.ApiUrl.Trim().TrimEnd('/') + "/api/client/evaluate");
            _clientKey = options.ClientKey.Trim();
            _environment = string.IsNullOrWhiteSpace(options.Environment) ? "development" : options.Environment.Trim();
            _project = string.IsNullOrWhiteSpace(options.Project) ? null : options.Project;
            _context = options.Context ?? new EvaluationContext();
        }

        /// <summary>The last evaluate result.</summary>
        public FlagMap Flags => _flags;

        /// <summary>Whether <paramref name="key"/> is on in the last result.</summary>
        public bool IsEnabled(string key) => _flags.IsEnabled(key);

        /// <summary>The sticky variant for <paramref name="key"/> in the last result.</summary>
        public string? GetVariant(string key) => _flags.GetVariant(key);

        /// <summary>POSTs to /api/client/evaluate. Pass null to use the client default context.</summary>
        public async Task<FlagMap> EvaluateAsync(EvaluationContext? context = null, CancellationToken cancellationToken = default)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, _endpoint)
            {
                Content = new StringContent(RequestBody(context ?? _context), Encoding.UTF8, "application/json"),
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _clientKey);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            HttpResponseMessage response;
            string body;
            try
            {
                response = await _http.SendAsync(request, cancellationToken).ConfigureAwait(false);
                body = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (OperationCanceledException ex)
            {
                throw new PennantException("Evaluate request timed out.", ex);
            }
            catch (HttpRequestException ex)
            {
                throw new PennantException(ex.Message, ex);
            }

            using (response)
            {
                var status = (int)response.StatusCode;
                if (status >= 400)
                {
                    throw new PennantException(ErrorMessage(body, status)) { StatusCode = status };
                }
                var next = ParseFlags(body);
                _flags = next;
                return next;
            }
        }

        /// <summary>Disposes the HttpClient when this client created it.</summary>
        public void Dispose()
        {
            if (_ownsHttp) _http.Dispose();
        }

        private string RequestBody(EvaluationContext context)
        {
            using var stream = new MemoryStream();
            using (var writer = new Utf8JsonWriter(stream))
            {
                writer.WriteStartObject();
                writer.WriteStartObject("context");
                WriteIfSet(writer, "userId", context.UserId);
                WriteIfSet(writer, "sessionId", context.SessionId);
                WriteIfSet(writer, "remoteAddress", context.RemoteAddress);
                WriteIfSet(writer, "hostname", context.Hostname);
                if (context.Properties != null && context.Properties.Count > 0)
                {
                    writer.WriteStartObject("properties");
                    foreach (var pair in context.Properties) writer.WriteString(pair.Key, pair.Value);
                    writer.WriteEndObject();
                }
                writer.WriteEndObject();
                writer.WriteString("environment", _environment);
                if (_project != null) writer.WriteString("project", _project);
                writer.WriteEndObject();
            }
            return Encoding.UTF8.GetString(stream.ToArray());
        }

        private static void WriteIfSet(Utf8JsonWriter writer, string name, string? value)
        {
            if (value != null) writer.WriteString(name, value);
        }

        // A proxy can answer with HTML, so a body that is not JSON falls back to the status.
        private static string ErrorMessage(string body, int status)
        {
            try
            {
                using var document = JsonDocument.Parse(body);
                if (document.RootElement.ValueKind == JsonValueKind.Object &&
                    document.RootElement.TryGetProperty("error", out var error) &&
                    error.ValueKind == JsonValueKind.String &&
                    !string.IsNullOrEmpty(error.GetString()))
                {
                    return error.GetString()!;
                }
            }
            catch (JsonException)
            {
                // Not JSON.
            }
            return $"Evaluation failed ({status}).";
        }

        private static FlagMap ParseFlags(string body)
        {
            if (string.IsNullOrWhiteSpace(body)) return FlagMap.Empty;
            JsonDocument document;
            try
            {
                document = JsonDocument.Parse(body);
            }
            catch (JsonException ex)
            {
                throw new PennantException("Response must be a JSON object.", ex);
            }
            using (document)
            {
                var root = document.RootElement;
                if (root.ValueKind != JsonValueKind.Object) throw new PennantException("Response must be a JSON object.");
                if (!root.TryGetProperty("flags", out var raw) || raw.ValueKind == JsonValueKind.Null) return FlagMap.Empty;
                if (raw.ValueKind != JsonValueKind.Object) throw new PennantException("Response flags must be an object.");

                var flags = new Dictionary<string, FlagEvaluation>();
                foreach (var property in raw.EnumerateObject())
                {
                    var flag = property.Value;
                    if (flag.ValueKind != JsonValueKind.Object) throw new PennantException("Flag evaluation must be an object.");
                    var enabled = flag.TryGetProperty("enabled", out var e) && e.ValueKind == JsonValueKind.True;
                    var variant = flag.TryGetProperty("variant", out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
                    flags[property.Name] = new FlagEvaluation(enabled, variant);
                }
                return new FlagMap(flags);
            }
        }
    }
}
