/**
 * Main — initialization, URL parameter handling, event binding
 */
(function () {
    'use strict';

    /**
     * Parse URL parameters and auto-fill form fields.
     * Supported params: computer, user, issue, noai
     */
    function parseURLParams() {
        const params = new URLSearchParams(window.location.search);

        // Auto-fill hidden computer/user fields
        if (params.has('computer')) {
            document.getElementById('computerName').value = params.get('computer');
        }
        if (params.has('user')) {
            document.getElementById('userName').value = params.get('user');
        }

        // Pre-fill issue description
        if (params.has('issue')) {
            document.getElementById('notes').value = params.get('issue');
        }

        // Disable AI review if noai=1
        if (params.get('noai') === '1') {
            document.getElementById('aiReviewEnabled').checked = false;
        }
    }

    /**
     * Bind all event listeners
     */
    function bindEvents() {
        // Intake form submission (Next button)
        document.getElementById('intake-form').addEventListener('submit', (e) => {
            e.preventDefault();
            FormHandler.handleNext();
        });

        // Back to Edit button
        document.getElementById('btn-back').addEventListener('click', () => {
            FormHandler.handleBack();
        });

        // Submit Ticket button
        document.getElementById('btn-submit').addEventListener('click', () => {
            FormHandler.handleSubmit();
        });
    }

    /**
     * Initialize everything on DOM ready
     */
    function init() {
        parseURLParams();
        bindEvents();
        FormHandler.initLiveValidation();
        UIManager.initModal();
        UIManager.initPriorityButtons();
    }

    // Boot
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
