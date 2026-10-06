using System;

namespace Pennant
{
    /// <summary>Raised when evaluate fails.</summary>
    public sealed class PennantException : Exception
    {
        /// <summary>Creates the exception.</summary>
        public PennantException(string message, Exception? innerException = null)
            : base(message, innerException)
        {
        }

        /// <summary>The HTTP status, when the server answered.</summary>
        public int? StatusCode { get; internal set; }
    }
}
