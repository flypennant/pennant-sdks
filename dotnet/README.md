# Pennant.Sdk (.NET)

.NET client for [Pennant](../README.md). Matches [`CONTRACT.md`](../CONTRACT.md). Targets `netstandard2.0` and `net8.0`, so it runs on .NET 6+, .NET Framework 4.6.2+, Unity, and MAUI.

## Install

```bash
dotnet add package Pennant.Sdk
```

The package id is `Pennant.Sdk`; the namespace is `Pennant`.

## Usage

```csharp
using Pennant;

using var client = new PennantClient(new PennantClientOptions
{
    ApiUrl = "http://127.0.0.1:3847",
    ClientKey = "pennant-client-demo",
    Environment = "development",
    Context = new EvaluationContext { UserId = "ada-lovelace", RemoteAddress = "127.0.0.1" },
});

var flags = await client.EvaluateAsync();
if (flags.IsEnabled("checkout-v2"))
{
    Console.WriteLine(flags.GetVariant("checkout-v2"));
}
```

In ASP.NET Core, register one client and evaluate per request:

```csharp
builder.Services.AddSingleton(new PennantClient(new PennantClientOptions
{
    ApiUrl = builder.Configuration["PENNANT_API_URL"]!,
    ClientKey = builder.Configuration["PENNANT_CLIENT_KEY"]!,
    Environment = "production",
}));

app.MapGet("/checkout", async (PennantClient pennant, HttpContext http, CancellationToken ct) =>
{
    var flags = await pennant.EvaluateAsync(new EvaluationContext { UserId = http.User.Identity?.Name }, ct);
    return flags.IsEnabled("checkout-v2") ? NewCheckout() : ClassicCheckout();
});
```

To use `IHttpClientFactory`, pass a factory-made `HttpClient` to `new PennantClient(httpClient, options)`.

`EvaluateAsync` throws `PennantException` for HTTP, network, and timeout failures (`StatusCode` is set when the server answered). Treat that as off. Cancelling the token you pass in throws `OperationCanceledException` as usual.

## Develop

```bash
cd dotnet
dotnet format --verify-no-changes
dotnet test
```
