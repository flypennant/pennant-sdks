using System.Collections.Generic;

namespace Pennant
{
    /// <summary>Evaluation context fields accepted by POST /api/client/evaluate.</summary>
    public sealed class EvaluationContext
    {
        /// <summary>Sticky id for gradual rollout and variants.</summary>
        public string? UserId { get; set; }

        /// <summary>Fallback sticky id when <see cref="UserId"/> is missing.</summary>
        public string? SessionId { get; set; }

        /// <summary>Used by the remoteAddress strategy.</summary>
        public string? RemoteAddress { get; set; }

        /// <summary>Used by the hostname strategy.</summary>
        public string? Hostname { get; set; }

        /// <summary>Custom string map for constraints and segments.</summary>
        public IDictionary<string, string>? Properties { get; set; }
    }
}
