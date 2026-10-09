# pennant (PHP)

PHP client for [Pennant](../README.md). Matches [`CONTRACT.md`](../CONTRACT.md). No runtime dependencies: it uses ext-curl when it is loaded and PHP streams otherwise.

Requires PHP 8.1+.

## Install

Packagist publishing is not set up yet. Packagist reads one package from a repository root, so it needs a split repository first. Until then, add this folder as a [path repository](https://getcomposer.org/doc/05-repositories.md#path):

```json
{
  "repositories": [{ "type": "path", "url": "../pennant-sdks/php" }],
  "require": { "flypennant/pennant": "*" }
}
```

Git tags for this SDK are `php/vX.Y.Z`.

## Usage

```php
use Pennant\EvaluationContext;
use Pennant\PennantClient;

$client = new PennantClient(
    apiUrl: 'http://127.0.0.1:3847',
    clientKey: 'pennant-client-demo',
    environment: 'development',
    context: new EvaluationContext(userId: 'ada-lovelace', remoteAddress: '127.0.0.1'),
);

$flags = $client->evaluate();
if ($flags->isEnabled('checkout-v2')) {
    echo $flags->getVariant('checkout-v2') ?? '';
}
```

On a server, create the client once (a Laravel singleton or a Symfony service) and pass each request's user to `evaluate(new EvaluationContext(userId: ...))`. `evaluate` returns a `FlagMap`; `$client->isEnabled()` and `$client->getVariant()` read the last result. Failures throw `Pennant\PennantException`. Treat that as off.

To send requests through your framework's HTTP client, implement `Pennant\Http\Transport` and pass it as `transport:`.

## Develop

```bash
cd php
composer install
composer lint
composer test
```
