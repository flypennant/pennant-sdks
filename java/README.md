# pennant (Java)

Java client for [Pennant](../README.md). Matches [`CONTRACT.md`](../CONTRACT.md). Uses `java.net.http.HttpClient` only. No extra runtime dependencies.

Requires Java 17+.

## Install

Maven:

```xml
<dependency>
  <groupId>com.flypennant</groupId>
  <artifactId>pennant-sdk</artifactId>
  <version>1.1.0</version>
</dependency>
```

Maven Central publishing is not set up yet. Until it is, install from a checkout:

```bash
cd java && mvn install
```

## Usage

```java
import com.flypennant.pennant.EvaluationContext;
import com.flypennant.pennant.PennantClient;

PennantClient client = PennantClient.builder()
    .apiUrl("http://127.0.0.1:3847")
    .clientKey("pennant-client-demo")
    .environment("development")
    .context(EvaluationContext.builder()
        .userId("ada-lovelace")
        .remoteAddress("127.0.0.1")
        .build())
    .build();

client.evaluate();
if (client.isEnabled("checkout-v2")) {
  System.out.println(client.getVariant("checkout-v2").orElse(""));
}
```

## Develop

```bash
cd java
mvn test
```
