namespace Pennant
{
    /// <summary>One flag evaluation result.</summary>
    public sealed class FlagEvaluation
    {
        /// <summary>Creates a result.</summary>
        public FlagEvaluation(bool enabled, string? variant = null)
        {
            Enabled = enabled;
            Variant = variant;
        }

        /// <summary>Whether the flag is on.</summary>
        public bool Enabled { get; }

        /// <summary>The sticky variant, when the flag is on and defines variants.</summary>
        public string? Variant { get; }
    }
}
