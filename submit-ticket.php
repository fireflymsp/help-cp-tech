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
