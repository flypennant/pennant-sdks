using System;

namespace Pennant
{
    /// <summary>Options for <see cref="PennantClient"/>.</summary>
    public sealed class PennantClientOptions
    {
        /// <summary>Base URL of the Pennant server, for example https://flags.example.com.</summary>
        public string ApiUrl { get; set; } = "";

        /// <summary>The project client key from the console's Configure page.</summary>
        public string ClientKey { get; set; } = "";

        /// <summary>Environment to evaluate. Defaults to development.</summary>
        public string Environment { get; set; } = "development";

        /// <summary>Project id. When set it must own the client key.</summary>
        public string? Project { get; set; }

        /// <summary>Context used when <see cref="PennantClient.EvaluateAsync"/> gets none.</summary>
        public EvaluationContext Context { get; set; } = new EvaluationContext();

        /// <summary>Request timeout when the client creates its own HttpClient.</summary>
        public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(10);
    }
}
