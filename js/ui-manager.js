/**
 * @module UIManager
 * @description Handles modals, stage transitions, priority UI, proxy detection UI,
 * and all DOM manipulation for the CPHELP ticket form.
 */
const UIManager = (() => {
    'use strict';

    /**
     * Switch between form stages (form → summary → confirm).
     * Hides all stages, then activates the target stage with a smooth scroll to top.
     * @param {string} stageId - The DOM id of the stage to show ('stage-form', 'stage-summary', 'stage-confirm')
     */
    function showStage(stageId) {
        document.querySelectorAll('.stage').forEach(s => {
            s.classList.remove('active');
            s.setAttribute('aria-hidden', 'true');
        });
        const target = document.getElementById(stageId);
        if (target) {
            target.classList.add('active');
            target.removeAttribute('aria-hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    /**
     * Toggle a button's loading state (spinner + disabled).
     * @param {HTMLButtonElement} btn - The button element
     * @param {boolean} loading - Whether to show loading state
     */
    function setButtonLoading(btn, loading) {
        if (loading) {
            btn.classList.add('loading');
            btn.disabled = true;
        } else {
            btn.classList.remove('loading');
            btn.disabled = false;
        }
    }

    /**
     * Populate the summary stage with user-entered data from the intake form.
     * @param {Object} data - Form data object
     * @param {string} data.fullName
     * @param {string} data.companyName
     * @param {string} data.email
     * @param {string} data.phone
     * @param {string} data.notes
     */
    function populateSummary(data) {
        document.getElementById('sum-name').textContent = data.fullName;
        document.getElementById('sum-company').textContent = data.companyName;
        document.getElementById('sum-email').textContent = data.email;
        document.getElementById('sum-phone').textContent = data.phone;
        document.getElementById('sum-notes').textContent = data.notes;
    }

    /**
     * Display the AI-generated ticket subject line, or hide the card if empty.
     * @param {string} subject - The generated subject line
     */
    function showSubject(subject) {
        const el = document.getElementById('sum-subject');
        const card = document.getElementById('subject-card');
        if (subject) {
            el.textContent = subject;
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    }

    /**
     * Display the priority badge with color coding and the AI's reasoning.
     * Also syncs the priority adjustment dropdown to match.
     * @param {string} priority - 'Urgent', 'High', or 'Normal'
     * @param {string} reason - One-sentence explanation of the priority level
     */
    function showPriority(priority, reason) {
        const badge = document.getElementById('priority-badge');
        const reasonEl = document.getElementById('priority-reason');

        badge.textContent = priority;
        badge.className = 'priority-badge ' + priority.toLowerCase();
        reasonEl.textContent = reason || '';

        const select = document.getElementById('priority-select');
        select.value = priority;
    }

    /**
     * Render follow-up questions from the AI analysis, or show the
     * "your issue is clear" confirmation if no questions are needed.
     * @param {string[]} questions - Array of 0–2 follow-up question strings
     */
    function showQuestions(questions) {
        const section = document.getElementById('questions-section');
        const noSection = document.getElementById('no-questions-section');
        const container = document.getElementById('questions-container');

        container.innerHTML = '';

        if (questions && questions.length > 0) {
            section.classList.remove('hidden');
            noSection.classList.add('hidden');

            questions.forEach((q, i) => {
                const card = document.createElement('div');
                card.className = 'question-card';
                card.innerHTML = `
                    <p class="question-text">${escapeHtml(q)} <span class="question-optional">(optional)</span></p>
                    <textarea id="answer${i + 1}" name="answer${i + 1}" rows="3"
                        placeholder="Your answer..." aria-label="Answer to: ${escapeHtml(q)}"></textarea>
                `;
                container.appendChild(card);
            });
        } else {
            section.classList.add('hidden');
            noSection.classList.remove('hidden');
        }
    }

    /**
     * Show or hide the proxy contact section (for on-behalf-of submissions).
     * @param {boolean} detected - Whether proxy submission was detected by the AI
     */
    function showProxy(detected) {
        const section = document.getElementById('proxy-section');
        if (detected) {
            section.classList.remove('hidden');
        } else {
            section.classList.add('hidden');
        }
    }

    /**
     * Initialize the "What's this?" AI info modal with open/close handlers
     * and keyboard accessibility (Escape to close, click-outside to close).
     */
    function initModal() {
        const overlay = document.getElementById('ai-modal');
        const openBtn = document.getElementById('ai-info-btn');
        const closeBtns = overlay.querySelectorAll('.modal-close, .modal-close-btn');

        function open() {
            overlay.classList.remove('hidden');
            overlay.querySelector('.modal-close').focus();
        }

        function close() {
            overlay.classList.add('hidden');
            openBtn.focus();
        }

        openBtn.addEventListener('click', open);
        closeBtns.forEach(btn => btn.addEventListener('click', close));

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
                close();
            }
        });
    }

    /**
     * Initialize the priority confirm/adjust toggle buttons on the summary stage.
     */
    function initPriorityButtons() {
        const confirmBtn = document.querySelector('[data-action="confirm"]');
        const adjustBtn = document.querySelector('[data-action="adjust"]');
        const adjustPanel = document.getElementById('priority-adjust');

        confirmBtn.addEventListener('click', () => {
            confirmBtn.classList.add('active');
            adjustBtn.classList.remove('active');
            adjustPanel.classList.add('hidden');
        });

        adjustBtn.addEventListener('click', () => {
            adjustBtn.classList.add('active');
            confirmBtn.classList.remove('active');
            adjustPanel.classList.remove('hidden');
        });
    }

    /**
     * Get the user's final priority selection and how it was confirmed.
     * @param {string} originalPriority - The AI-assessed priority level
     * @returns {{ level: string, confirmed: string }} Final priority and confirmation status
     */
    function getFinalPriority(originalPriority) {
        const adjustBtn = document.querySelector('[data-action="adjust"]');
        const select = document.getElementById('priority-select');

        if (adjustBtn.classList.contains('active')) {
            return {
                level: select.value,
                confirmed: `Adjusted by user to ${select.value}`
            };
        }
        return {
            level: originalPriority,
            confirmed: 'Confirmed by user'
        };
    }

    /**
     * Collect the user's answers to AI-generated follow-up questions.
     * Always returns question1/answer1/question2/answer2 keys (empty string if unused).
     * @param {string[]} questions - Array of question strings from the AI
     * @returns {{ question1: string, answer1: string, question2: string, answer2: string }}
     */
    function getQuestionAnswers(questions) {
        const result = { question1: '', answer1: '', question2: '', answer2: '' };
        if (questions && questions.length > 0) {
            questions.forEach((q, i) => {
                const num = i + 1;
                result[`question${num}`] = q;
                const textarea = document.getElementById(`answer${num}`);
                result[`answer${num}`] = textarea ? textarea.value.trim() : '';
            });
        }
        return result;
    }

    /**
     * Collect the proxy (affected user) contact information from the proxy section form fields.
     * Returns formatted proxyInfo string for the webhook payload.
     * @returns {{ proxyInfo: string, actualUserName: string, actualUserCompany: string, actualUserEmail: string, actualUserPhone: string }}
     */
    function getProxyInfo() {
        const name = document.getElementById('actualUserName').value.trim();
        const email = document.getElementById('actualUserEmail').value.trim();
        const phone = document.getElementById('actualUserPhone').value.trim();
        const company = document.getElementById('actualUserCompany').value.trim();

        if (name || email || phone) {
            return {
                proxyInfo: `PROXY SUBMISSION - Impacted User: ${name}, Email: ${email}, Phone: ${phone}`,
                actualUserName: name,
                actualUserCompany: company,
                actualUserEmail: email,
                actualUserPhone: phone
            };
        }
        return {
            proxyInfo: '',
            actualUserName: '',
            actualUserCompany: '',
            actualUserEmail: '',
            actualUserPhone: ''
        };
    }

    /**
     * Show the confirmation stage with a personalized thank-you using the user's first name.
     * @param {string} name - The user's full name
     */
    function showConfirmation(name) {
        const firstName = name.split(' ')[0];
        document.getElementById('confirm-name').textContent = firstName;
        showStage('stage-confirm');
    }

    /**
     * Escape HTML entities to prevent XSS when inserting dynamic content.
     * @param {string} str - The raw string to escape
     * @returns {string} HTML-safe string
     */
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Public API
    return {
        showStage,
        setButtonLoading,
        populateSummary,
        showSubject,
        showPriority,
        showQuestions,
        showProxy,
        showConfirmation,
        initModal,
        initPriorityButtons,
        getFinalPriority,
        getQuestionAnswers,
        getProxyInfo,
    };
})();
