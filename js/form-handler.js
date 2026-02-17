/**
 * Form Handler — validation, stage navigation, and ticket submission
 */
const FormHandler = (() => {
    'use strict';

    // Current AI analysis result (set after "Next" is clicked)
    let currentAnalysis = null;

    /**
     * Validate the intake form. Returns true if valid.
     */
    function validateForm() {
        let valid = true;
        const fields = [
            { id: 'fullName', message: 'Please enter your full name' },
            { id: 'companyName', message: 'Please enter your company name' },
            { id: 'email', message: 'Please enter a valid email address' },
            { id: 'phone', message: 'Please enter your phone number' },
            { id: 'notes', message: 'Please describe your issue' },
        ];

        fields.forEach(({ id, message }) => {
            const input = document.getElementById(id);
            const error = document.getElementById(`${id}-error`);
            const value = input.value.trim();

            // Special validation for email
            if (id === 'email' && value && !isValidEmail(value)) {
                input.classList.add('error');
                error.textContent = 'Please enter a valid email address';
                valid = false;
                return;
            }

            if (!value) {
                input.classList.add('error');
                error.textContent = message;
                valid = false;
            } else {
                input.classList.remove('error');
                error.textContent = '';
            }
        });

        // Focus the first error field
        if (!valid) {
            const firstError = document.querySelector('input.error, textarea.error');
            if (firstError) firstError.focus();
        }

        return valid;
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    /**
     * Clear validation errors on input
     */
    function initLiveValidation() {
        const fields = ['fullName', 'companyName', 'email', 'phone', 'notes'];
        fields.forEach(id => {
            const input = document.getElementById(id);
            input.addEventListener('input', () => {
                input.classList.remove('error');
                document.getElementById(`${id}-error`).textContent = '';
            });
        });
    }

    /**
     * Gather form data from the intake form
     */
    function getFormData() {
        return {
            fullName: document.getElementById('fullName').value.trim(),
            companyName: document.getElementById('companyName').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            notes: document.getElementById('notes').value.trim(),
            computerName: document.getElementById('computerName').value,
            userName: document.getElementById('userName').value,
            aiReviewEnabled: document.getElementById('aiReviewEnabled').checked,
        };
    }

    /**
     * Handle the "Next" button click.
     * Validates, optionally calls AI, then transitions to summary stage.
     */
    async function handleNext() {
        if (!validateForm()) return;

        const formData = getFormData();
        const nextBtn = document.getElementById('btn-next');

        UIManager.setButtonLoading(nextBtn, true);

        try {
            if (formData.aiReviewEnabled) {
                // Call AI for analysis
                currentAnalysis = await AIIntegration.analyzeIssue(formData.notes);
            } else {
                // Skip AI — use defaults
                currentAnalysis = AIIntegration.getDefaultResponse();
            }

            // Populate the summary stage
            UIManager.populateSummary(formData);
            UIManager.showSubject(currentAnalysis.subject);
            UIManager.showPriority(currentAnalysis.priority, currentAnalysis.reason);
            UIManager.showQuestions(currentAnalysis.questions);
            UIManager.showProxy(currentAnalysis.proxy_detected);

            // Show/hide subject card based on AI
            if (!formData.aiReviewEnabled) {
                document.getElementById('subject-card').classList.add('hidden');
                document.getElementById('priority-card').classList.add('hidden');
                document.getElementById('no-questions-section').classList.remove('hidden');
            } else {
                document.getElementById('priority-card').classList.remove('hidden');
            }

            UIManager.showStage('stage-summary');

        } catch (error) {
            console.error('Error during Next:', error);
            // Graceful degradation — show summary with defaults
            currentAnalysis = AIIntegration.getDefaultResponse();
            UIManager.populateSummary(formData);
            UIManager.showSubject('');
            UIManager.showPriority('Normal', 'Standard support request');
            UIManager.showQuestions([]);
            UIManager.showProxy(false);
            UIManager.showStage('stage-summary');
        } finally {
            UIManager.setButtonLoading(nextBtn, false);
        }
    }

    /**
     * Handle the "Back to Edit" button
     */
    function handleBack() {
        UIManager.showStage('stage-form');
    }

    /**
     * Handle the "Submit Ticket" button.
     * Gathers all data and sends to the Rewst webhook via PHP backend.
     */
    async function handleSubmit() {
        const submitBtn = document.getElementById('btn-submit');
        UIManager.setButtonLoading(submitBtn, true);

        try {
            const formData = getFormData();

            // Determine final priority
            let priorityInfo;
            if (formData.aiReviewEnabled && currentAnalysis) {
                priorityInfo = UIManager.getFinalPriority(currentAnalysis.priority);
            } else {
                priorityInfo = {
                    level: 'Normal',
                    confirmed: 'Standard priority (AI review disabled)'
                };
            }

            // Build urgency level string
            const urgencyLevel = `${priorityInfo.level}: ${currentAnalysis ? currentAnalysis.reason : 'Standard support request'}`;

            // Collect question answers
            const qa = UIManager.getQuestionAnswers(
                currentAnalysis ? currentAnalysis.questions : []
            );

            // Collect proxy info
            const proxyData = currentAnalysis && currentAnalysis.proxy_detected
                ? UIManager.getProxyInfo()
                : { proxyInfo: '', actualUserName: '', actualUserCompany: '', actualUserEmail: '', actualUserPhone: '' };

            // Build the full payload
            const payload = {
                fullName: formData.fullName,
                companyName: formData.companyName,
                email: formData.email,
                phone: formData.phone,
                notes: formData.notes,

                formType: 'Support_Ticket',
                submissionDate: new Date().toISOString(),
                generatedSubject: currentAnalysis ? currentAnalysis.subject : '',
                screenshotBase64: '',

                question1: qa.question1,
                answer1: qa.answer1,
                question2: qa.question2,
                answer2: qa.answer2,

                urgencyLevel: urgencyLevel,
                urgencyConfirmed: priorityInfo.confirmed,

                computerName: formData.computerName,
                userName: formData.userName,

                aiReviewEnabled: formData.aiReviewEnabled ? 'true' : 'false',
                aiReviewContent: formData.aiReviewEnabled ? formData.notes : '',

                proxyInfo: proxyData.proxyInfo,
                actualUserName: proxyData.actualUserName,
                actualUserCompany: proxyData.actualUserCompany,
                actualUserEmail: proxyData.actualUserEmail,
                actualUserPhone: proxyData.actualUserPhone,
            };

            // Send to backend
            const response = await fetch('/submit-ticket.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Submission failed: ${response.status}`);
            }

            // Success — show confirmation
            UIManager.showConfirmation(formData.fullName);

        } catch (error) {
            console.error('Submission error:', error);
            alert('There was an issue submitting your ticket. Please try again, or call us at 866.933.4359 for immediate help.');
        } finally {
            UIManager.setButtonLoading(submitBtn, false);
        }
    }

    // Public API
    return {
        handleNext,
        handleBack,
        handleSubmit,
        initLiveValidation,
    };
})();
