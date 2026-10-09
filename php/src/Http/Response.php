<?php

declare(strict_types=1);

namespace Pennant\Http;

/** Status and body of one HTTP response. */
final class Response
{
    public function __construct(
        public readonly int $status,
        public readonly string $body,
    ) {
    }
}
