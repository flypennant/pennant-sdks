<?php

declare(strict_types=1);

namespace Pennant;

/** Evaluation context fields accepted by POST /api/client/evaluate. */
final class EvaluationContext
{
    /**
     * @param array<string, string> $properties Custom string map for constraints and segments.
     */
    public function __construct(
        public readonly ?string $userId = null,
        public readonly ?string $sessionId = null,
        public readonly ?string $remoteAddress = null,
        public readonly ?string $hostname = null,
        public readonly array $properties = [],
    ) {
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        $map = [];
        foreach (['userId', 'sessionId', 'remoteAddress', 'hostname'] as $field) {
            if ($this->{$field} !== null) {
                $map[$field] = $this->{$field};
            }
        }
        if ($this->properties !== []) {
            $map['properties'] = array_map('strval', $this->properties);
        }
        return $map;
    }
}
