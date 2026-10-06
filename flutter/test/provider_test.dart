import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:pennant_flutter/pennant_flutter.dart';

void main() {
  testWidgets('PennantFlag shows the fallback until the flag turns on', (tester) async {
    final client = _client((_) => '{"flags":{"checkout-v2":{"enabled":true,"variant":"b"}}}');

    await tester.pumpWidget(_app(
      PennantProvider(
        client: client,
        pollInterval: Duration.zero,
        child: const PennantFlag(name: 'checkout-v2', fallback: Text('old'), child: Text('new')),
      ),
    ));
    expect(find.text('old'), findsOneWidget);

    await tester.pumpAndSettle();
    expect(find.text('new'), findsOneWidget);
  });

  testWidgets('Pennant.of exposes loading, flags, and variants', (tester) async {
    final client = _client((_) => '{"flags":{"checkout-v2":{"enabled":true,"variant":"b"}}}');
    final seen = <String>[];

    await tester.pumpWidget(_app(
      PennantProvider(
        client: client,
        pollInterval: Duration.zero,
        child: Builder(builder: (context) {
          final pennant = Pennant.of(context);
          seen.add('${pennant.loading}:${pennant.getVariant('checkout-v2')}');
          return const SizedBox.shrink();
        }),
      ),
    ));
    await tester.pumpAndSettle();

    expect(seen.first, 'true:null');
    expect(seen.last, 'false:b');
  });

  testWidgets('an error keeps the last flags and reports the message', (tester) async {
    var calls = 0;
    final client = PennantClient(
      apiUrl: 'https://pennant.test',
      clientKey: 'pennant-client-demo',
      httpClient: MockClient((_) async {
        calls++;
        return calls == 1
            ? http.Response('{"flags":{"checkout-v2":{"enabled":true}}}', 200)
            : http.Response('<html>Bad Gateway</html>', 502);
      }),
    );
    late PennantValue value;

    await tester.pumpWidget(_app(
      PennantProvider(
        client: client,
        pollInterval: Duration.zero,
        child: Builder(builder: (context) {
          value = Pennant.of(context);
          return const SizedBox.shrink();
        }),
      ),
    ));
    await tester.pumpAndSettle();
    await tester.runAsync(value.refetch);
    await tester.pump();

    expect(value.isEnabled('checkout-v2'), isTrue);
    expect(value.error, 'Evaluation failed (502).');
  });

  testWidgets('a new context evaluates again', (tester) async {
    final users = <String?>[];
    final client = _client((body) {
      users.add((body['context'] as Map)['userId'] as String?);
      return '{"flags":{}}';
    });

    Widget build(String user) => _app(PennantProvider(
          client: client,
          context: EvaluationContext(userId: user),
          pollInterval: Duration.zero,
          child: const SizedBox.shrink(),
        ));

    await tester.pumpWidget(build('ada'));
    await tester.pumpAndSettle();
    await tester.pumpWidget(build('ada'));
    await tester.pumpAndSettle();
    await tester.pumpWidget(build('grace'));
    await tester.pumpAndSettle();

    expect(users, ['ada', 'grace']);
  });

  testWidgets('polling evaluates on the interval and stops on dispose', (tester) async {
    var calls = 0;
    final client = _client((_) {
      calls++;
      return '{"flags":{}}';
    });

    await tester.pumpWidget(_app(PennantProvider(
      client: client,
      pollInterval: const Duration(seconds: 15),
      child: const SizedBox.shrink(),
    )));
    await tester.pump();
    await tester.pump(const Duration(seconds: 31));
    expect(calls, 3);

    await tester.pumpWidget(_app(const SizedBox.shrink()));
    await tester.pump(const Duration(seconds: 60));
    expect(calls, 3);
  });

  testWidgets('Pennant.of without a provider throws', (tester) async {
    await tester.pumpWidget(_app(Builder(builder: (context) {
      Pennant.of(context);
      return const SizedBox.shrink();
    })));
    expect(tester.takeException(), isA<FlutterError>());
  });
}

Widget _app(Widget child) => Directionality(textDirection: TextDirection.ltr, child: child);

PennantClient _client(String Function(Map<String, dynamic> body) respond) => PennantClient(
      apiUrl: 'https://pennant.test',
      clientKey: 'pennant-client-demo',
      httpClient: MockClient((request) async {
        final body = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(respond(body), 200);
      }),
    );
