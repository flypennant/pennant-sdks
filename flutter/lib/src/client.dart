import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'models.dart';

/// POST /api/client/evaluate with a project client key.
///
/// Works in Flutter and in plain Dart. Create one and share it.
class PennantClient {
  /// Creates a client. [httpClient] defaults to a new `http.Client`.
  PennantClient({
    required String apiUrl,
    required String clientKey,
    String environment = 'development',
    String? project,
    this.context = const EvaluationContext(),
    http.Client? httpClient,
    this.timeout = const Duration(seconds: 10),
  })  : _endpoint = Uri.parse('${_trimSlash(apiUrl.trim())}/api/client/evaluate'),
        _clientKey = clientKey.trim(),
        _environment = environment.trim().isEmpty ? 'development' : environment.trim(),
        _project = (project == null || project.trim().isEmpty) ? null : project,
        _http = httpClient ?? http.Client(),
        _ownsHttp = httpClient == null {
    if (apiUrl.trim().isEmpty) throw ArgumentError.value(apiUrl, 'apiUrl', 'is required');
    if (_clientKey.isEmpty) throw ArgumentError.value(clientKey, 'clientKey', 'is required');
  }

  /// Context used when [evaluate] gets none.
  final EvaluationContext context;

  /// How long one evaluate request may take.
  final Duration timeout;

  final Uri _endpoint;
  final String _clientKey;
  final String _environment;
  final String? _project;
  final http.Client _http;
  final bool _ownsHttp;
  FlagMap _flags = FlagMap.empty;

  /// The last evaluate result.
  FlagMap get flags => _flags;

  /// Whether [key] is on in the last result.
  bool isEnabled(String key) => _flags.isEnabled(key);

  /// The sticky variant for [key] in the last result.
  String? getVariant(String key) => _flags.getVariant(key);

  /// POSTs to /api/client/evaluate. Pass null to use [context].
  Future<FlagMap> evaluate([EvaluationContext? override]) async {
    final body = jsonEncode({
      'context': (override ?? context).toJson(),
      'environment': _environment,
      if (_project != null) 'project': _project,
    });

    final http.Response response;
    try {
      response = await _http
          .post(
            _endpoint,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': 'Bearer $_clientKey',
            },
            body: body,
          )
          .timeout(timeout);
    } on TimeoutException {
      throw const PennantException('Evaluate request timed out.');
    } on http.ClientException catch (error) {
      throw PennantException(error.message);
    }

    if (response.statusCode >= 400) {
      throw PennantException(
        _errorMessage(response.body, response.statusCode),
        statusCode: response.statusCode,
      );
    }
    final next = _parseFlags(response.body);
    _flags = next;
    return next;
  }

  /// Closes the HTTP client when this client created it.
  void close() {
    if (_ownsHttp) _http.close();
  }

  static String _trimSlash(String value) {
    var end = value.length;
    while (end > 0 && value[end - 1] == '/') {
      end--;
    }
    return value.substring(0, end);
  }

  // A proxy can answer with HTML, so a body that is not JSON falls back to the status.
  static String _errorMessage(String body, int status) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map && decoded['error'] is String && (decoded['error'] as String).isNotEmpty) {
        return decoded['error'] as String;
      }
    } on FormatException {
      // Not JSON.
    }
    return 'Evaluation failed ($status).';
  }

  static FlagMap _parseFlags(String body) {
    if (body.trim().isEmpty) return FlagMap.empty;
    final Object? decoded;
    try {
      decoded = jsonDecode(body);
    } on FormatException {
      throw const PennantException('Response must be a JSON object.');
    }
    if (decoded is! Map) throw const PennantException('Response must be a JSON object.');
    final raw = decoded['flags'];
    if (raw == null) return FlagMap.empty;
    if (raw is! Map) throw const PennantException('Response flags must be an object.');
    final flags = <String, FlagEvaluation>{};
    raw.forEach((key, value) {
      if (value is! Map) throw const PennantException('Flag evaluation must be an object.');
      final variant = value['variant'];
      flags[key.toString()] = FlagEvaluation(
        enabled: value['enabled'] == true,
        variant: variant is String ? variant : null,
      );
    });
    return FlagMap(flags);
  }
}
