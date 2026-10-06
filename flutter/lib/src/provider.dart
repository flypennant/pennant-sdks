import 'dart:async';

import 'package:flutter/widgets.dart';

import 'client.dart';
import 'models.dart';

/// What [Pennant.of] returns: the latest flags and the request state.
@immutable
class PennantValue {
  /// Creates a value.
  const PennantValue({
    required this.flags,
    required this.loading,
    required this.error,
    required this.refetch,
  });

  /// The latest flags. Empty until the first evaluate finishes.
  final FlagMap flags;

  /// True until the first evaluate finishes, whether it succeeded or not.
  final bool loading;

  /// The last error message, or null after a successful evaluate.
  final String? error;

  /// Evaluates again now.
  final Future<void> Function() refetch;

  /// Whether [key] is on. Unknown flags are off.
  bool isEnabled(String key) => flags.isEnabled(key);

  /// The sticky variant for [key], or null.
  String? getVariant(String key) => flags.getVariant(key);
}

/// Evaluates flags for the widgets below it and keeps them fresh.
///
/// It evaluates on mount, whenever [context] changes, and every [pollInterval].
/// A failed evaluate keeps the last good flags and sets [PennantValue.error].
class PennantProvider extends StatefulWidget {
  /// Creates a provider around [client].
  const PennantProvider({
    super.key,
    required this.client,
    this.context,
    this.pollInterval = const Duration(seconds: 15),
    required this.child,
  });

  /// The shared client. The provider does not close it.
  final PennantClient client;

  /// Context for this subtree. Null uses the client's default context.
  final EvaluationContext? context;

  /// Time between evaluations. [Duration.zero] turns polling off.
  final Duration pollInterval;

  /// The widget below this one.
  final Widget child;

  @override
  State<PennantProvider> createState() => _PennantProviderState();
}

class _PennantProviderState extends State<PennantProvider> {
  FlagMap _flags = FlagMap.empty;
  bool _loading = true;
  String? _error;
  int _requestId = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _refetch();
    _schedule();
  }

  @override
  void didUpdateWidget(PennantProvider oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.client != widget.client || oldWidget.context != widget.context) {
      _refetch();
    }
    if (oldWidget.pollInterval != widget.pollInterval) _schedule();
  }

  @override
  void dispose() {
    _timer?.cancel();
    // Drops any response still in flight.
    _requestId++;
    super.dispose();
  }

  void _schedule() {
    _timer?.cancel();
    _timer = widget.pollInterval > Duration.zero
        ? Timer.periodic(widget.pollInterval, (_) => _refetch())
        : null;
  }

  Future<void> _refetch() async {
    final id = ++_requestId;
    try {
      final flags = await widget.client.evaluate(widget.context);
      if (!mounted || id != _requestId) return;
      setState(() {
        _flags = flags;
        _error = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || id != _requestId) return;
      setState(() {
        _error = error is PennantException ? error.message : error.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return _PennantScope(
      value: PennantValue(flags: _flags, loading: _loading, error: _error, refetch: _refetch),
      child: widget.child,
    );
  }
}

class _PennantScope extends InheritedWidget {
  const _PennantScope({required this.value, required super.child});

  final PennantValue value;

  @override
  bool updateShouldNotify(_PennantScope oldWidget) =>
      value.flags != oldWidget.value.flags ||
      value.loading != oldWidget.value.loading ||
      value.error != oldWidget.value.error;
}

/// Reads flags from the nearest [PennantProvider].
abstract final class Pennant {
  /// The nearest provider's value. Rebuilds the caller when flags change.
  static PennantValue of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<_PennantScope>();
    if (scope == null) {
      throw FlutterError('Pennant.of() was called without a PennantProvider above it.');
    }
    return scope.value;
  }

  /// Whether [key] is on. Unknown flags are off.
  static bool isEnabled(BuildContext context, String key) => of(context).isEnabled(key);

  /// The sticky variant for [key], or null.
  static String? getVariant(BuildContext context, String key) => of(context).getVariant(key);
}

/// Shows [child] when the flag is on and [fallback] otherwise.
class PennantFlag extends StatelessWidget {
  /// Creates the widget.
  const PennantFlag({
    super.key,
    required this.name,
    required this.child,
    this.fallback = const SizedBox.shrink(),
  });

  /// The flag key.
  final String name;

  /// Shown when the flag is on.
  final Widget child;

  /// Shown while loading, when the flag is off, and for unknown flags.
  final Widget fallback;

  @override
  Widget build(BuildContext context) => Pennant.isEnabled(context, name) ? child : fallback;
}
