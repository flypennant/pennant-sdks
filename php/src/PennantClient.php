<?php

declare(strict_types=1);

namespace Pennant;

use Pennant\Http\CurlTransport;
use Pennant\Http\StreamTransport;
use Pennant\Http\Transport;

/** POST /api/client/evaluate with a project client key. */
final class PennantClient
{
    private readonly string $apiUrl;
    private readonly string $clientKey;
    private readonly string $environment;
    private readonly Transport $transport;
    private FlagMap $flags;

    public function __construct(
        string $apiUrl,
        string $clientKey,
        string $environment = 'development',
        private readonly ?string $project = null,
        private readonly EvaluationContext $context = new EvaluationContext(),
        ?Transport $transport = null,
        private readonly float $timeoutSeconds = 10.0,
    ) {
        if (trim($apiUrl) === '') {
            throw new \InvalidArgumentException('apiUrl is required');
        }
        if (trim($clientKey) === '') {
            throw new \InvalidArgumentException('clientKey is required');
        }
        $this->apiUrl = rtrim(trim($apiUrl), '/');
        $this->clientKey = trim($clientKey);
        $this->environment = trim($environment) === '' ? 'development' : trim($environment);
        $this->transport = $transport
            ?? (function_exists('curl_init') ? new CurlTransport() : new StreamTransport());
        $this->flags = new FlagMap();
    }

    /** POSTs to /api/client/evaluate. Pass null to use the client default context. */
    public function evaluate(?EvaluationContext $context = null): FlagMap
    {
        $payload = [
            // An empty array would encode as [], so force a JSON object.
            'context' => (object) ($context ?? $this->context)->toArray(),
            'environment' => $this->environment,
        ];
        if ($this->project !== null && trim($this->project) !== '') {
            $payload['project'] = $this->project;
        }

        $response = $this->transport->post(
            $this->apiUrl . '/api/client/evaluate',
            [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
                'Authorization' => 'Bearer ' . $this->clientKey,
            ],
            json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES),
            $this->timeoutSeconds,
        );

        if ($response->status >= 400) {
            throw new PennantException(self::errorMessage($response->body, $response->status));
        }

        $parsed = [];
        if (trim($response->body) !== '') {
            try {
                $parsed = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
            } catch (\JsonException $exception) {
                throw new PennantException('Response must be a JSON object.', 0, $exception);
            }
            if (!is_array($parsed)) {
                throw new PennantException('Response must be a JSON object.');
            }
        }

        $this->flags = self::parseFlags($parsed['flags'] ?? null);
        return $this->flags;
    }

    /** The last evaluate result. */
    public function flags(): FlagMap
    {
        return $this->flags;
    }

    public function isEnabled(string $key): bool
    {
        return $this->flags->isEnabled($key);
    }

    public function getVariant(string $key): ?string
    {
        return $this->flags->getVariant($key);
    }

    // A proxy can answer with HTML, so a body that is not JSON falls back to the status.
    private static function errorMessage(string $body, int $status): string
    {
        $decoded = json_decode($body, true);
        $message = is_array($decoded) ? ($decoded['error'] ?? null) : null;
        return is_string($message) && $message !== '' ? $message : "Evaluation failed ({$status}).";
    }

    private static function parseFlags(mixed $raw): FlagMap
    {
        if ($raw === null) {
            return new FlagMap();
        }
        if (!is_array($raw) || array_is_list($raw) && $raw !== []) {
            throw new PennantException('Response flags must be an object.');
        }
        $flags = [];
        foreach ($raw as $key => $flag) {
            if (!is_array($flag)) {
                throw new PennantException('Flag evaluation must be an object.');
            }
            $variant = $flag['variant'] ?? null;
            $flags[(string) $key] = new FlagEvaluation(
                ($flag['enabled'] ?? false) === true,
                is_string($variant) ? $variant : null,
            );
        }
        return new FlagMap($flags);
    }
}
