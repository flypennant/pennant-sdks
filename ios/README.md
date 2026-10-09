# pennant (iOS / Swift)

Swift client for [Pennant](../README.md). Matches [`CONTRACT.md`](../CONTRACT.md). Uses `URLSession`. Works on iOS, macOS, tvOS, and watchOS.

## Install

SwiftPM reads `Package.swift` from the repository root, and that manifest builds the sources in this folder. In Xcode, use File → Add Package Dependencies and enter `https://github.com/flypennant/pennant-sdks`. In a manifest:

```swift
.package(url: "https://github.com/flypennant/pennant-sdks", branch: "main")
```

Git tags for this SDK are `ios/vX.Y.Z`. SwiftPM only treats bare `X.Y.Z` tags as versions, so pin a release with `revision:` and the commit the tag points to. During development you can also add this folder as a local package.

## Usage

```swift
import Pennant

let client = PennantClient(
  options: ClientOptions(
    apiUrl: "http://127.0.0.1:3847",
    clientKey: "pennant-client-demo",
    environment: "development",
    context: EvaluationContext(
      userId: "ada-lovelace",
      remoteAddress: "127.0.0.1"
    )
  )
)

let flags = try await client.evaluate()
if client.isEnabled("checkout-v2") {
  print(client.getVariant("checkout-v2") ?? "")
}
```

`evaluate` throws `PennantError` for HTTP and network failures, and for a blank `apiUrl` or `clientKey`. Treat that as off. One client is safe to share across tasks.

## Develop

```bash
cd ios
swift test
```
