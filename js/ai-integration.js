/**
 * @module AIIntegration
 * @description Handles communication with the Claude API backend (generate-questions.php).
 * Provides structured AI analysis of support issues including subject, priority,
 * follow-up questions, and proxy detection.
 */
const AIIntegration = (() => {
    'use strict';

    /** @type {Object} Default fallback response when AI is disabled or fails */
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
     * Falls back to DEFAULT_RESPONSE on any error (graceful degradation).
     *
     * @param {string} issueDescription - The user's issue text
     * @returns {Promise<{ subject: string, priority: string, reason: string, questions: string[], proxy_detected: boolean }>}
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
     * Ensures all expected fields exist with correct types and values.
     *
     * @param {Object} data - Raw response from the backend
     * @returns {{ subject: string, priority: string, reason: string, questions: string[], proxy_detected: boolean }}
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
     * Get the default response (used when AI review is disabled by the user).
     * @returns {{ subject: string, priority: string, reason: string, questions: string[], proxy_detected: boolean }}
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
