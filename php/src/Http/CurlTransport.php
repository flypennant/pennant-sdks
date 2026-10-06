<?php

declare(strict_types=1);

namespace Pennant\Http;

use Pennant\PennantException;

/** Transport on ext-curl. */
final class CurlTransport implements Transport
{
    public function post(string $url, array $headers, string $body, float $timeoutSeconds): Response
    {
        $handle = curl_init($url);
        if ($handle === false) {
            throw new PennantException('Could not start a curl request.');
        }
        $lines = [];
        foreach ($headers as $name => $value) {
            $lines[] = "{$name}: {$value}";
        }
        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => $lines,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT_MS => (int) ($timeoutSeconds * 1000),
            CURLOPT_CONNECTTIMEOUT_MS => (int) (min($timeoutSeconds, 10.0) * 1000),
        ]);
        $raw = curl_exec($handle);
        if ($raw === false) {
            $error = curl_error($handle);
            curl_close($handle);
            throw new PennantException($error !== '' ? $error : 'Evaluate request failed.');
        }
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        curl_close($handle);
        return new Response($status, (string) $raw);
    }
}
