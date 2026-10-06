<?php

declare(strict_types=1);

namespace Pennant\Tests;

use Pennant\EvaluationContext;
use Pennant\FlagMap;
use Pennant\Http\CurlTransport;
use Pennant\Http\Response;
use Pennant\Http\StreamTransport;
use Pennant\Http\Transport;
use Pennant\PennantClient;
use Pennant\PennantException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class PennantClientTest extends TestCase
{
    /** @var resource|null */
    private static $server = null;
    private static int $port = 0;

    public static function setUpBeforeClass(): void
    {
        $socket = stream_socket_server('tcp://127.0.0.1:0');
        self::$port = (int) substr(strrchr(stream_socket_get_name($socket, false), ':'), 1);
        fclose($socket);
        $router = __DIR__ . '/fixtures/server.php';
        self::$server = proc_open(
            [PHP_BINARY, '-S', '127.0.0.1:' . self::$port, $router],
            [['pipe', 'r'], ['file', '/dev/null', 'w'], ['file', '/dev/null', 'w']],
            $pipes,
        );
        $deadline = microtime(true) + 5;
        while (microtime(true) < $deadline) {
            $probe = @fsockopen('127.0.0.1', self::$port);
            if ($probe !== false) {
                fclose($probe);
                return;
            }
            usleep(50_000);
        }
        self::fail('php -S did not start');
    }

    public static function tearDownAfterClass(): void
    {
        if (self::$server !== null) {
            proc_terminate(self::$server);
            proc_close(self::$server);
        }
    }

    /** @return iterable<string, array{Transport}> */
    public static function transports(): iterable
    {
        yield 'streams' => [new StreamTransport()];
        if (function_exists('curl_init')) {
            yield 'curl' => [new CurlTransport()];
        }
    }

    #[DataProvider('transports')]
    public function testEvaluatePostsBearerAndReturnsVariant(Transport $transport): void
    {
        $recorder = new RecordingTransport($transport);
        $client = new PennantClient(
            apiUrl: $this->baseUrl() . '/',
            clientKey: 'pennant-client-demo',
            environment: 'production',
            project: 'default',
            context: new EvaluationContext(
                userId: 'ada',
                remoteAddress: '127.0.0.1',
                hostname: 'app.local',
                properties: ['plan' => 'pro'],
            ),
            transport: $recorder,
        );

        $flags = $client->evaluate();

        $echo = json_decode($recorder->last->body, true)['echo'];
        self::assertSame('/api/client/evaluate', $echo['path']);
        self::assertSame('Bearer pennant-client-demo', $echo['auth']);
        self::assertSame(
            [
                'context' => [
                    'userId' => 'ada',
                    'remoteAddress' => '127.0.0.1',
                    'hostname' => 'app.local',
                    'properties' => ['plan' => 'pro'],
                ],
                'environment' => 'production',
                'project' => 'default',
            ],
            $echo['body'],
        );
        self::assertTrue($flags->isEnabled('checkout-v2'));
        self::assertSame('treatment', $flags->getVariant('checkout-v2'));
        self::assertTrue($client->isEnabled('checkout-v2'));
        self::assertSame('treatment', $client->getVariant('checkout-v2'));
        self::assertFalse($client->isEnabled('unknown'));
        self::assertNull($client->getVariant('unknown'));
    }

    #[DataProvider('transports')]
    public function testEvaluateMapsUnauthorized(Transport $transport): void
    {
        $client = $this->client(new HeaderTransport($transport, 'unauthorized'));
        $this->expectException(PennantException::class);
        $this->expectExceptionMessage('Invalid client key.');
        $client->evaluate();
    }

    #[DataProvider('transports')]
    public function testEvaluateFallsBackToStatusForNonJsonError(Transport $transport): void
    {
        $client = $this->client(new HeaderTransport($transport, 'html'));
        try {
            $client->evaluate();
            self::fail('expected PennantException');
        } catch (PennantException $exception) {
            self::assertSame('Evaluation failed (502).', $exception->getMessage());
        }
        self::assertCount(0, $client->flags());
    }

    public function testEmptyContextIsSentAsAnObject(): void
    {
        $fake = new FakeTransport(new Response(200, '{"flags":{}}'));
        $this->client($fake)->evaluate();
        self::assertSame('{"context":{},"environment":"development"}', $fake->body);
    }

    public function testOverrideContextReplacesTheDefault(): void
    {
        $fake = new FakeTransport(new Response(200, '{"flags":{}}'));
        $client = new PennantClient(
            apiUrl: 'https://pennant.test',
            clientKey: 'pennant-client-demo',
            context: new EvaluationContext(userId: 'ada'),
            transport: $fake,
        );
        $client->evaluate(new EvaluationContext(sessionId: 's-1'));
        self::assertSame(['sessionId' => 's-1'], json_decode($fake->body, true)['context']);
    }

    public function testMissingFlagsIsEmpty(): void
    {
        $flags = $this->client(new FakeTransport(new Response(200, '')))->evaluate();
        self::assertInstanceOf(FlagMap::class, $flags);
        self::assertCount(0, $flags);
    }

    public function testRejectsFlagsThatAreNotAnObject(): void
    {
        $this->expectExceptionMessage('Response flags must be an object.');
        $this->client(new FakeTransport(new Response(200, '{"flags":[1]}')))->evaluate();
    }

    public function testRequiresClientKey(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new PennantClient(apiUrl: 'https://pennant.test', clientKey: ' ');
    }

    private function client(Transport $transport): PennantClient
    {
        return new PennantClient(
            apiUrl: $this->baseUrl(),
            clientKey: 'pennant-client-demo',
            transport: $transport,
        );
    }

    private function baseUrl(): string
    {
        return 'http://127.0.0.1:' . self::$port;
    }
}

final class FakeTransport implements Transport
{
    public string $url = '';
    public string $body = '';

    public function __construct(private readonly Response $response)
    {
    }

    public function post(string $url, array $headers, string $body, float $timeoutSeconds): Response
    {
        $this->url = $url;
        $this->body = $body;
        return $this->response;
    }
}

final class RecordingTransport implements Transport
{
    public ?Response $last = null;

    public function __construct(private readonly Transport $inner)
    {
    }

    public function post(string $url, array $headers, string $body, float $timeoutSeconds): Response
    {
        return $this->last = $this->inner->post($url, $headers, $body, $timeoutSeconds);
    }
}

final class HeaderTransport implements Transport
{
    public function __construct(private readonly Transport $inner, private readonly string $case)
    {
    }

    public function post(string $url, array $headers, string $body, float $timeoutSeconds): Response
    {
        return $this->inner->post($url, $headers + ['X-Test-Case' => $this->case], $body, $timeoutSeconds);
    }
}
