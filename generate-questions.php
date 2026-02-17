<?php
/**
 * generate-questions.php
 *
 * Backend endpoint that sends the user's issue description to Claude (Anthropic API)
 * and returns a structured JSON response with subject, priority, questions, and proxy flag.
 *
 * Environment Variables Required:
 *   ANTHROPIC_API_KEY — Your Anthropic API key
 */

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Default response for graceful degradation
$default_response = [
    'subject'        => '',
    'priority'       => 'Normal',
    'reason'         => 'Standard support request',
    'questions'      => [],
    'proxy_detected' => false,
];

// Read and validate input
$input = json_decode(file_get_contents('php://input'), true);
$issue = trim($input['issue'] ?? '');

if (empty($issue)) {
    echo json_encode($default_response);
    exit;
}

// Get API key from environment
$api_key = getenv('ANTHROPIC_API_KEY');
if (empty($api_key)) {
    error_log('CPHELP: ANTHROPIC_API_KEY not set');
    echo json_encode($default_response);
    exit;
}

// System prompt for Claude
$system_prompt = <<<'PROMPT'
You are an intelligent IT support triage assistant for Creative Planning Technology, a managed service provider delivering white-glove IT support.

Your job is to analyze a user's support request and return three things:
1. A clear, concise SUBJECT line for the support ticket (max 10 words)
2. A PRIORITY assessment (Urgent, High, or Normal)
3. ZERO to TWO follow-up questions — ONLY if they would genuinely help the support team resolve the issue faster

PRIORITY RULES:
- Urgent: Multiple users affected AND work is completely stopped, OR critical shared system (phones, email server, line-of-business app) is fully down
- High: Multiple users with degraded functionality, OR a few users completely unable to work
- Normal: Individual user issue, OR any issue that's an inconvenience but work can continue (this is MOST tickets)

QUESTION RULES — THIS IS THE MOST IMPORTANT PART:
- Ask questions ONLY when the missing information would change how the support team approaches the issue
- If the issue is already clear and actionable (e.g., "my monitor won't turn on," "our phone system is completely down"), return ZERO questions
- Never ask more than 2 questions
- Never ask users to run diagnostics, check settings, or do technical troubleshooting
- Focus on: scope of impact (how many people affected), timeline (when did it start), what they were trying to do, and whether it's affecting others
- Write questions in plain, friendly language — no jargon
- For Urgent issues, always ask about business impact if not already stated

PROXY DETECTION:
- If the description suggests someone is submitting on behalf of another person (phrases like "on behalf of," "submitting for," "my colleague needs help," "they can't," etc.), include the flag proxy_detected: true in your response

OUTPUT FORMAT (strict JSON only — no markdown, no code fences):
{
  "subject": "Brief ticket subject",
  "priority": "Normal",
  "reason": "One sentence explaining the priority level",
  "questions": [],
  "proxy_detected": false
}

If no questions are needed, return an empty questions array. This is expected and preferred when the issue is already clear.
PROMPT;

// Build the API request
$request_body = json_encode([
    'model'       => 'claude-sonnet-4-5-20250929',
    'max_tokens'  => 400,
    'temperature' => 0.2,
    'system'      => $system_prompt,
    'messages'    => [
        ['role' => 'user', 'content' => $issue]
    ],
]);

// Call the Anthropic API
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
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
]);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);

// Handle curl errors
if ($response === false || !empty($curl_error)) {
    error_log('CPHELP: cURL error — ' . $curl_error);
    echo json_encode($default_response);
    exit;
}

// Handle non-200 responses
if ($http_code !== 200) {
    error_log('CPHELP: Anthropic API returned HTTP ' . $http_code . ' — ' . substr($response, 0, 500));
    echo json_encode($default_response);
    exit;
}

// Parse the Anthropic API response
$api_response = json_decode($response, true);
if (!$api_response || empty($api_response['content'][0]['text'])) {
    error_log('CPHELP: Unexpected API response structure');
    echo json_encode($default_response);
    exit;
}

$claude_text = $api_response['content'][0]['text'];

// Parse Claude's JSON response
$analysis = json_decode($claude_text, true);
if (!$analysis || !is_array($analysis)) {
    // Try extracting JSON from the response in case Claude wrapped it
    if (preg_match('/\{[\s\S]*\}/', $claude_text, $matches)) {
        $analysis = json_decode($matches[0], true);
    }
    if (!$analysis || !is_array($analysis)) {
        error_log('CPHELP: Failed to parse Claude response — ' . substr($claude_text, 0, 500));
        echo json_encode($default_response);
        exit;
    }
}

// Validate and sanitize the response
$result = [
    'subject'        => isset($analysis['subject']) && is_string($analysis['subject'])
                            ? substr($analysis['subject'], 0, 200) : '',
    'priority'       => in_array($analysis['priority'] ?? '', ['Urgent', 'High', 'Normal'])
                            ? $analysis['priority'] : 'Normal',
    'reason'         => isset($analysis['reason']) && is_string($analysis['reason'])
                            ? substr($analysis['reason'], 0, 500) : 'Standard support request',
    'questions'      => [],
    'proxy_detected' => ($analysis['proxy_detected'] ?? false) === true,
];

// Validate questions array (max 2 string items)
if (isset($analysis['questions']) && is_array($analysis['questions'])) {
    foreach (array_slice($analysis['questions'], 0, 2) as $q) {
        if (is_string($q) && !empty(trim($q))) {
            $result['questions'][] = trim($q);
        }
    }
}

echo json_encode($result);
