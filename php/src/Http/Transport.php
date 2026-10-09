<?php

declare(strict_types=1);

namespace Pennant\Http;

/**
 * Sends the evaluate POST. Implement it to route requests through your
 * framework's HTTP client (for example a PSR-18 client).
 *
 * Return the response for any HTTP status. Throw only when no response arrived.
 */
interface Transport
{
    /** @param array<string, string> $headers */
    public function post(string $url, array $headers, string $body, float $timeoutSeconds): Response;
}
