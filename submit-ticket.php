<?php
/**
 * submit-ticket.php
 *
 * Backend endpoint that receives the complete ticket data from the frontend
 * and forwards it to the Rewst webhook as FormData (application/x-www-form-urlencoded).
 *
 * Environment Variables Required:
 *   WEBHOOK_URL — The Rewst webhook endpoint URL
 */

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Get webhook URL from environment
$webhook_url = getenv('WEBHOOK_URL');
if (empty($webhook_url)) {
    error_log('CPHELP: WEBHOOK_URL not set');
    http_response_code(500);
    echo json_encode(['error' => 'Server configuration error']);
    exit;
}

// Read JSON input from frontend
$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !is_array($input)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request body']);
    exit;
}

// Define all expected fields with defaults (all must be present in submission)
$fields = [
    'fullName'           => '',
    'companyName'        => '',
    'email'              => '',
    'phone'              => '',
    'notes'              => '',
    'formType'           => 'Support_Ticket',
    'submissionDate'     => '',
    'generatedSubject'   => '',
    'screenshotBase64'   => '',
    'fileName'           => '',
    'question1'          => '',
    'answer1'            => '',
    'question2'          => '',
    'answer2'            => '',
    'urgencyLevel'       => '',
    'urgencyConfirmed'   => '',
    'computerName'       => '',
    'userName'           => '',
    'aiReviewEnabled'    => 'false',
    'aiReviewContent'    => '',
    'proxyInfo'          => '',
    'actualUserName'     => '',
    'actualUserCompany'  => '',
    'actualUserEmail'    => '',
    'actualUserPhone'    => '',
];

// Build payload — merge input with defaults (ensures all fields present)
$payload = [];
foreach ($fields as $key => $default) {
    $payload[$key] = isset($input[$key]) && is_string($input[$key]) ? $input[$key] : $default;
}

// Ensure submissionDate is set
if (empty($payload['submissionDate'])) {
    $payload['submissionDate'] = gmdate('Y-m-d\TH:i:s.v\Z');
}

// --- Spam Detection (AI-powered) ---
// Runs on every submission regardless of AI review toggle.
// Fails open — if the check errors out, the ticket is allowed through.
$api_key = getenv('ANTHROPIC_API_KEY');
if (!empty($api_key)) {
    $spam_result = checkForSpam($payload, $api_key);
    if ($spam_result === 'spam') {
        error_log('CPHELP: Spam blocked — name=' . $payload['fullName'] . ', company=' . $payload['companyName'] . ', email=' . $payload['email']);
        http_response_code(422);
        echo json_encode([
            'error' => 'spam_detected',
            'message' => 'Your submission could not be processed. If this is a legitimate request, please call us at 866.933.4359.',
        ]);
        exit;
    }
}

// Send to Rewst as application/x-www-form-urlencoded (NOT JSON — Rewst double-encodes JSON)
$post_body = http_build_query($payload);

$ch = curl_init($webhook_url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $post_body,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/x-www-form-urlencoded',
    ],
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
]);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);

// Handle errors
if ($response === false || !empty($curl_error)) {
    error_log('CPHELP: Webhook cURL error — ' . $curl_error);
    http_response_code(502);
    echo json_encode(['error' => 'Failed to submit ticket', 'detail' => 'Connection error']);
    exit;
}

if ($http_code < 200 || $http_code >= 300) {
    error_log('CPHELP: Webhook returned HTTP ' . $http_code . ' — ' . substr($response, 0, 500));
    http_response_code(502);
    echo json_encode(['error' => 'Failed to submit ticket', 'detail' => 'Webhook returned ' . $http_code]);
    exit;
}

// Success
echo json_encode(['success' => true, 'message' => 'Ticket submitted successfully']);

// --- Spam Detection Function ---

/**
 * Call Claude to determine if a ticket submission is spam.
 * Returns 'spam', 'legitimate', or 'error' (fail-open).
 *
 * @param array  $payload  The ticket payload
 * @param string $api_key  Anthropic API key
 * @return string 'spam' | 'legitimate' | 'error'
 */
function checkForSpam(array $payload, string $api_key): string {
    $content = "Name: {$payload['fullName']}\n"
             . "Company: {$payload['companyName']}\n"
             . "Email: {$payload['email']}\n"
             . "Phone: {$payload['phone']}\n"
             . "Issue: {$payload['notes']}";

    $body = json_encode([
        'model'      => 'claude-sonnet-4-5-20250929',
        'max_tokens' => 20,
        'temperature' => 0,
        'system'     => 'You are a spam detector for an IT support helpdesk form used by managed IT clients. '
                      . 'Real tickets describe computer, network, phone, printer, software, or account issues. '
                      . 'Spam includes: SEO pitches, marketing offers, sales outreach, crypto/investment schemes, '
                      . 'nonsense/gibberish, bot-generated text, phishing attempts, or anything unrelated to IT support. '
                      . 'Respond with exactly one word: "spam" or "legitimate". Nothing else.',
        'messages'   => [
            ['role' => 'user', 'content' => $content],
        ],
    ]);

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'x-api-key: ' . $api_key,
            'anthropic-version: 2023-06-01',
        ],
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);

    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($http_code !== 200 || $response === false) {
        error_log('CPHELP: Spam check failed (HTTP ' . $http_code . ') — allowing ticket through');
        return 'error';
    }

    $data = json_decode($response, true);
    $verdict = strtolower(trim($data['content'][0]['text'] ?? ''));

    return ($verdict === 'spam') ? 'spam' : 'legitimate';
}
