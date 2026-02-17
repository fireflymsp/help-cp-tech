/**
 * UI Manager — handles modals, stage transitions, priority UI, and proxy detection UI
 */
const UIManager = (() => {
    'use strict';

    /**
     * Switch between form stages (form → summary → confirm)
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
     * Set a button into loading state
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
     * Populate the summary stage with user-entered data
     */
    function populateSummary(data) {
        document.getElementById('sum-name').textContent = data.fullName;
        document.getElementById('sum-company').textContent = data.companyName;
        document.getElementById('sum-email').textContent = data.email;
        document.getElementById('sum-phone').textContent = data.phone;
        document.getElementById('sum-notes').textContent = data.notes;
    }

    /**
     * Display the AI-generated subject line
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
     * Display priority badge and reason
     */
    function showPriority(priority, reason) {
        const badge = document.getElementById('priority-badge');
        const reasonEl = document.getElementById('priority-reason');

        badge.textContent = priority;
        badge.className = 'priority-badge ' + priority.toLowerCase();
        reasonEl.textContent = reason || '';

        // Set the select to match
        const select = document.getElementById('priority-select');
        select.value = priority;
    }

    /**
     * Show/hide follow-up questions
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
     * Show the proxy contact section
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
     * Initialize the AI info modal
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
     * Initialize priority confirm/adjust buttons
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
     * Get the user's final priority selection and confirmation status
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
     * Collect answers to follow-up questions
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
     * Collect proxy user information
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
     * Show the confirmation stage with the user's name
     */
    function showConfirmation(name) {
        const firstName = name.split(' ')[0];
        document.getElementById('confirm-name').textContent = firstName;
        showStage('stage-confirm');
    }

    /**
     * Escape HTML to prevent XSS in dynamic content
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
