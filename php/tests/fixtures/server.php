<?php

// Router for `php -S`. The X-Test-Case header picks the response.

$body = file_get_contents('php://input');
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

switch ($_SERVER['HTTP_X_TEST_CASE'] ?? 'ok') {
    case 'html':
        http_response_code(502);
        header('Content-Type: text/html');
        echo '<html>Bad Gateway</html>';
        break;
    case 'unauthorized':
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Invalid client key.']);
        break;
    default:
        header('Content-Type: application/json');
        echo json_encode([
            'flags' => ['checkout-v2' => ['enabled' => true, 'variant' => 'treatment']],
            'echo' => ['auth' => $auth, 'body' => json_decode($body, true), 'path' => $_SERVER['REQUEST_URI']],
        ]);
}
