<?php

declare(strict_types=1);

namespace Pennant;

/** One flag evaluation result. */
final class FlagEvaluation
{
    public function __construct(
        public readonly bool $enabled,
        public readonly ?string $variant = null,
    ) {
    }
}
