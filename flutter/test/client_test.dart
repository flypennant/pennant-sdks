import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:pennant_flutter/pennant_flutter.dart';

void main() {
  test('evaluate posts the bearer key and returns variants', () async {
    late http.Request sent;
    final client = PennantClient(
      apiUrl: 'https://pennant.test/',
      clientKey: 'pennant-client-demo',
      environment: 'production',
      project: 'default',
      context: const EvaluationContext(
        userId: 'ada',
        remoteAddress: '127.0.0.1',
        hostname: 'app.local',
        properties: {'plan': 'pro'},
      ),
      httpClient: MockClient((request) async {
        sent = request;
        return http.Response(
          '{"flags":{"checkout-v2":{"enabled":true,"variant":"treatment"}}}',
          200,
        );
      }),
    );

    final flags = await client.evaluate();

    expect(sent.method, 'POST');
    expect(sent.url.toString(), 'https://pennant.test/api/client/evaluate');
    expect(sent.headers['Authorization'], 'Bearer pennant-client-demo');
    expect(jsonDecode(sent.body), {
      'context': {
        'userId': 'ada',
        'remoteAddress': '127.0.0.1',
        'hostname': 'app.local',
        'properties': {'plan': 'pro'},
      },
      'environment': 'production',
      'project': 'default',
    });
    expect(flags.isEnabled('checkout-v2'), isTrue);
    expect(flags.getVariant('checkout-v2'), 'treatment');
    expect(client.isEnabled('checkout-v2'), isTrue);
    expect(client.isEnabled('unknown'), isFalse);
    expect(client.getVariant('unknown'), isNull);
  });

  test('an override context replaces the default', () async {
    late Map<String, dynamic> body;
    final client = PennantClient(
      apiUrl: 'https://pennant.test',
      clientKey: 'pennant-client-demo',
      context: const EvaluationContext(userId: 'ada'),
      httpClient: MockClient((request) async {
        body = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response('{"flags":{}}', 200);
      }),
    );

    await client.evaluate(const EvaluationContext(sessionId: 's-1'));

    expect(body, {
      'context': {'sessionId': 's-1'},
      'environment': 'development',
    });
  });

  test('a 401 surfaces the server error', () async {
    final client = _client(http.Response('{"error":"Invalid client key."}', 401));
    await expectLater(
      client.evaluate(),
      throwsA(isA<PennantException>()
          .having((e) => e.message, 'message', 'Invalid client key.')
          .having((e) => e.statusCode, 'statusCode', 401)),
    );
  });

  test('a non-JSON error falls back to the status', () async {
    final client = _client(http.Response('<html>Bad Gateway</html>', 502));
    await expectLater(
      client.evaluate(),
      throwsA(
          isA<PennantException>().having((e) => e.message, 'message', 'Evaluation failed (502).')),
    );
    expect(client.flags.isEmpty, isTrue);
  });

  test('network errors become PennantException', () async {
    final client = PennantClient(
      apiUrl: 'https://pennant.test',
      clientKey: 'pennant-client-demo',
      httpClient: MockClient((_) async => throw http.ClientException('connection refused')),
    );
    await expectLater(
      client.evaluate(),
      throwsA(isA<PennantException>().having((e) => e.message, 'message', 'connection refused')),
    );
  });

  test('flags that are not an object are rejected', () async {
    final client = _client(http.Response('{"flags":[1]}', 200));
    await expectLater(
      client.evaluate(),
      throwsA(isA<PennantException>()
          .having((e) => e.message, 'message', 'Response flags must be an object.')),
    );
  });

  test('a blank client key is rejected', () {
    expect(
      () => PennantClient(apiUrl: 'https://pennant.test', clientKey: ' '),
      throwsArgumentError,
    );
  });
}

PennantClient _client(http.Response response) => PennantClient(
      apiUrl: 'https://pennant.test',
      clientKey: 'pennant-client-demo',
      httpClient: MockClient((_) async => response),
    );
