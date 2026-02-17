<?php
/**
 * test-ai.php — Diagnostic endpoint to verify Claude API connectivity.
 * DELETE THIS FILE after confirming the integration works.
 */

header('Content-Type: application/json');

$results = [];

// 1. Check if env var exists
$api_key = getenv('ANTHROPIC_API_KEY');
$results['api_key_set'] = !empty($api_key);
$results['api_key_length'] = $api_key ? strlen($api_key) : 0;
$results['api_key_prefix'] = $api_key ? substr($api_key, 0, 10) . '...' : 'NOT SET';

// 2. Check if curl is available
$results['curl_available'] = function_exists('curl_init');

// 3. Try calling the API
if (!empty($api_key) && function_exists('curl_init')) {
    $request_body = json_encode([
        'model'      => 'claude-sonnet-4-5-20250929',
        'max_tokens' => 50,
        'messages'   => [
            ['role' => 'user', 'content' => 'Say hello in 5 words or less.']
        ],
    ]);

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $request_body,
        CURLOPT_HTTPHEADER     => [
            'x-api-key: ' . $api_key,
            'anthropic-version: 2023-06-01',
            'content-type: application/json',
        ],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_CONNECTTIMEOUT => 10,
    ]);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_error = curl_error($ch);
    curl_close($ch);

    $results['api_http_code'] = $http_code;
    $results['api_curl_error'] = $curl_error ?: null;
    $results['api_response'] = json_decode($response, true);
} else {
    $results['api_test'] = 'Skipped — missing key or curl';
}

echo json_encode($results, JSON_PRETTY_PRINT);
