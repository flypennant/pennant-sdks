# pennant_flutter

Flutter client for [Pennant](../README.md). Matches [`CONTRACT.md`](../CONTRACT.md). `PennantClient` is plain Dart on `package:http`. `PennantProvider`, `Pennant.of`, and `PennantFlag` mirror the [React SDK](../react/).

## Install

pub.dev publishing is not set up yet. Depend on the tagged folder in git:

```yaml
dependencies:
  pennant_flutter:
    git:
      url: https://github.com/flypennant/pennant-sdks
      path: flutter
      ref: flutter/v1.1.0
```

## Usage

```dart
import 'package:pennant_flutter/pennant_flutter.dart';

final pennant = PennantClient(
  apiUrl: const String.fromEnvironment('PENNANT_API_URL'),
  clientKey: const String.fromEnvironment('PENNANT_CLIENT_KEY'),
  environment: 'production',
);

class App extends StatelessWidget {
  const App({super.key, required this.userId});

  final String userId;

  @override
  Widget build(BuildContext context) {
    return PennantProvider(
      client: pennant,
      context: EvaluationContext(userId: userId),
      child: const MaterialApp(
        home: PennantFlag(
          name: 'checkout-v2',
          fallback: ClassicCheckout(),
          child: NewCheckout(),
        ),
      ),
    );
  }
}
```

Pass the values with `flutter run --dart-define=PENNANT_API_URL=... --dart-define=PENNANT_CLIENT_KEY=...`.

The provider evaluates on mount, whenever `context` changes, and every 15 seconds (`pollInterval`, `Duration.zero` turns polling off). A failed evaluate keeps the last good flags. Any widget below it can read them:

```dart
final pennant = Pennant.of(context);
if (pennant.isEnabled('checkout-v2')) {
  print(pennant.getVariant('checkout-v2'));
}
```

`Pennant.of(context)` also has `loading`, `error`, and `refetch()`. Without the widgets, call `await pennant.evaluate()` and read the returned `FlagMap`. Failures throw `PennantException`.

## Develop

```bash
cd flutter
flutter pub get
flutter analyze
flutter test
```
