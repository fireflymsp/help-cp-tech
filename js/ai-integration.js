/**
 * AI Integration — handles communication with the Claude API backend
 */
const AIIntegration = (() => {
    'use strict';

    // Default fallback response when AI is disabled or fails
    const DEFAULT_RESPONSE = {
        subject: '',
        priority: 'Normal',
        reason: 'Standard support request',
        questions: [],
        proxy_detected: false
    };

    /**
     * Send the issue description to the backend for Claude analysis.
     * Returns a structured response with subject, priority, questions, and proxy flag.
     *
     * @param {string} issueDescription - The user's issue text
     * @returns {Promise<Object>} AI analysis result
     */
    async function analyzeIssue(issueDescription) {
        try {
            const response = await fetch('/generate-questions.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ issue: issueDescription })
            });

            if (!response.ok) {
                console.warn('AI endpoint returned status:', response.status);
                return DEFAULT_RESPONSE;
            }

            const data = await response.json();
            return validateResponse(data);

        } catch (error) {
            console.warn('AI analysis failed, using defaults:', error.message);
            return DEFAULT_RESPONSE;
        }
    }

    /**
     * Validate and normalize the AI response structure.
     * Ensures all expected fields exist with correct types.
     */
    function validateResponse(data) {
        return {
            subject: typeof data.subject === 'string' ? data.subject : '',
            priority: ['Urgent', 'High', 'Normal'].includes(data.priority) ? data.priority : 'Normal',
            reason: typeof data.reason === 'string' ? data.reason : 'Standard support request',
            questions: Array.isArray(data.questions) ? data.questions.slice(0, 2) : [],
            proxy_detected: data.proxy_detected === true
        };
    }

    /**
     * Get the default response (for when AI is disabled)
     */
    function getDefaultResponse() {
        return { ...DEFAULT_RESPONSE };
    }

    // Public API
    return {
        analyzeIssue,
        getDefaultResponse,
    };
})();
