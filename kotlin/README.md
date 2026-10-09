# pennant (Kotlin)

Kotlin JVM client for [Pennant](../README.md). Matches [`CONTRACT.md`](../CONTRACT.md). Uses `java.net.http.HttpClient` only. No extra runtime dependencies.

This SDK is for JVM servers. `java.net.http` does not exist on Android, so Android apps use [`android/`](../android/).

Requires JDK 17+.

## Install

Gradle:

```kotlin
dependencies {
  implementation("com.flypennant:pennant-kotlin:1.1.0")
}
```

Maven Central publishing is not set up yet. Until it is, install from a checkout:

```bash
cd kotlin && gradle publishToMavenLocal
```

## Usage

```kotlin
import com.flypennant.pennant.ClientOptions
import com.flypennant.pennant.EvaluationContext
import com.flypennant.pennant.PennantClient

val client = PennantClient(
  ClientOptions(
    apiUrl = "http://127.0.0.1:3847",
    clientKey = "pennant-client-demo",
    environment = "development",
    context = EvaluationContext(
      userId = "ada-lovelace",
      remoteAddress = "127.0.0.1",
    ),
  ),
)

client.evaluate()
if (client.isEnabled("checkout-v2")) {
  println(client.getVariant("checkout-v2"))
}
```

## Develop

```bash
cd kotlin
gradle test
```
