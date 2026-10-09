<?php

declare(strict_types=1);

namespace Pennant;

/**
 * Flag keys mapped to evaluations. Unknown flags read as off.
 *
 * @implements \IteratorAggregate<string, FlagEvaluation>
 */
final class FlagMap implements \Countable, \IteratorAggregate
{
    /** @param array<string, FlagEvaluation> $flags */
    public function __construct(private readonly array $flags = [])
    {
    }

    public function isEnabled(string $key): bool
    {
        return ($this->flags[$key] ?? null)?->enabled ?? false;
    }

    public function getVariant(string $key): ?string
    {
        return ($this->flags[$key] ?? null)?->variant;
    }

    public function get(string $key): ?FlagEvaluation
    {
        return $this->flags[$key] ?? null;
    }

    /** @return array<string, FlagEvaluation> */
    public function all(): array
    {
        return $this->flags;
    }

    public function count(): int
    {
        return count($this->flags);
    }

    public function getIterator(): \ArrayIterator
    {
        return new \ArrayIterator($this->flags);
    }
}
