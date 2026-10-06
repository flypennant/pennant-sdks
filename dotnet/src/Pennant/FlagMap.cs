using System.Collections;
using System.Collections.Generic;

namespace Pennant
{
    /// <summary>Flag keys mapped to evaluations. Unknown flags read as off.</summary>
    public sealed class FlagMap : IReadOnlyDictionary<string, FlagEvaluation>
    {
        private readonly IReadOnlyDictionary<string, FlagEvaluation> _flags;

        /// <summary>An empty map.</summary>
        public static readonly FlagMap Empty = new FlagMap(new Dictionary<string, FlagEvaluation>());

        /// <summary>Wraps a copy of <paramref name="flags"/>.</summary>
        public FlagMap(IDictionary<string, FlagEvaluation> flags)
        {
            _flags = new Dictionary<string, FlagEvaluation>(flags);
        }

        /// <summary>Whether <paramref name="key"/> is on. Unknown flags are off.</summary>
        public bool IsEnabled(string key) => _flags.TryGetValue(key, out var flag) && flag.Enabled;

        /// <summary>The sticky variant for <paramref name="key"/>, or null.</summary>
        public string? GetVariant(string key) => _flags.TryGetValue(key, out var flag) ? flag.Variant : null;

        /// <inheritdoc />
        public FlagEvaluation this[string key] => _flags[key];

        /// <inheritdoc />
        public IEnumerable<string> Keys => _flags.Keys;

        /// <inheritdoc />
        public IEnumerable<FlagEvaluation> Values => _flags.Values;

        /// <inheritdoc />
        public int Count => _flags.Count;

        /// <inheritdoc />
        public bool ContainsKey(string key) => _flags.ContainsKey(key);

#if NET8_0_OR_GREATER
        /// <inheritdoc />
        public bool TryGetValue(string key, [System.Diagnostics.CodeAnalysis.MaybeNullWhen(false)] out FlagEvaluation value) =>
            _flags.TryGetValue(key, out value);
#else
        /// <inheritdoc />
        public bool TryGetValue(string key, out FlagEvaluation value) => _flags.TryGetValue(key, out value!);
#endif

        /// <inheritdoc />
        public IEnumerator<KeyValuePair<string, FlagEvaluation>> GetEnumerator() => _flags.GetEnumerator();

        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }
}
