<?php

declare(strict_types=1);

namespace Pennant\Http;

use Pennant\PennantException;

/** Transport on PHP streams, for hosts without ext-curl. */
final class StreamTransport implements Transport
{
    public function post(string $url, array $headers, string $body, float $timeoutSeconds): Response
    {
        $lines = [];
        foreach ($headers as $name => $value) {
            $lines[] = "{$name}: {$value}";
        }
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", $lines),
                'content' => $body,
                'timeout' => $timeoutSeconds,
                // Read 4xx and 5xx bodies instead of failing.
                'ignore_errors' => true,
            ],
        ]);
        $raw = @file_get_contents($url, false, $context);
        $responseHeaders = function_exists('http_get_last_response_headers')
            ? http_get_last_response_headers()
            : ($http_response_header ?? null);
        if ($raw === false || !is_array($responseHeaders) || $responseHeaders === []) {
            $error = error_get_last()['message'] ?? 'Evaluate request failed.';
            throw new PennantException($error);
        }
        return new Response(self::status($responseHeaders), $raw);
    }

    /** @param list<string> $headers */
    private static function status(array $headers): int
    {
        // Redirects add one status line per hop; the last one wins.
        $status = 0;
        foreach ($headers as $line) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $match) === 1) {
                $status = (int) $match[1];
            }
        }
        return $status;
    }
}
