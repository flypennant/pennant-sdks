# pennant-android

Android client for [Pennant](../README.md). Matches [`CONTRACT.md`](../CONTRACT.md). Uses `HttpURLConnection` and the platform's `org.json`, with no extra runtime dependencies. minSdk 21.

The [Kotlin SDK](../kotlin/) is for JVM servers; it uses `java.net.http`, which Android does not have.

## Install

Maven Central publishing is not set up yet. Until it is, publish to your local Maven repository from a checkout:

```bash
cd android && gradle publishToMavenLocal
```

```kotlin
repositories { mavenLocal() }

dependencies {
  implementation("com.flypennant:pennant-android:1.1.0")
}
```

The library's manifest adds the `INTERNET` permission.

## Usage

Create one client for the app, for example in `Application.onCreate`:

```kotlin
import com.flypennant.pennant.android.ClientOptions
import com.flypennant.pennant.android.EvaluateCallback
import com.flypennant.pennant.android.EvaluationContext
import com.flypennant.pennant.android.FlagMap
import com.flypennant.pennant.android.PennantClient
import com.flypennant.pennant.android.PennantException

val client = PennantClient(
  ClientOptions(
    apiUrl = "http://10.0.2.2:3847", // the host machine from the emulator
    clientKey = "pennant-client-demo",
    environment = "development",
  ),
)

client.evaluateAsync(EvaluationContext(userId = "ada-lovelace"), object : EvaluateCallback {
  override fun onSuccess(flags: FlagMap) {
    if (PennantClient.isEnabled(flags, "checkout-v2")) showNewCheckout()
  }

  override fun onError(error: PennantException) {
    // Keep the current behaviour.
  }
})
```

`evaluateAsync` runs the request on a background thread and calls back on the main thread. `evaluate()` blocks, for code that is already on a worker thread or in a coroutine on `Dispatchers.IO`. `client.isEnabled(key)` and `client.getVariant(key)` read the last result. Call `client.close()` if you throw the client away.

## Develop

```bash
cd android
gradle testDebugUnitTest
```

Gradle finds the Android SDK through `ANDROID_HOME` or `sdk.dir` in `local.properties`.
