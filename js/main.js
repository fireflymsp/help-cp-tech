/**
 * @module Main
 * @description Application entry point. Handles initialization, URL parameter parsing,
 * and event binding for the CPHELP ticket submission form.
 *
 * URL Parameters (passed by the NinjaRMM desktop tray app):
 *   ?computer=HOSTNAME    — Auto-fills the hidden computerName field
 *   ?user=USERNAME        — Auto-fills the hidden userName field
 *   ?issue=DESCRIPTION    — Pre-fills the issue description textarea
 *   ?noai=1               — Disables AI review automatically
 */
(function () {
    'use strict';

    /**
     * Parse URL parameters and auto-fill form fields.
     * Called once on initialization.
     */
    function parseURLParams() {
        const params = new URLSearchParams(window.location.search);

        if (params.has('computer')) {
            document.getElementById('computerName').value = params.get('computer');
        }
        if (params.has('user')) {
            document.getElementById('userName').value = params.get('user');
        }
        if (params.has('issue')) {
            document.getElementById('notes').value = params.get('issue');
        }
        if (params.get('noai') === '1') {
            document.getElementById('aiReviewEnabled').checked = false;
        }
    }

    /**
     * Bind all DOM event listeners for form navigation and submission.
     */
    function bindEvents() {
        document.getElementById('intake-form').addEventListener('submit', (e) => {
            e.preventDefault();
            FormHandler.handleNext();
        });

        document.getElementById('btn-back').addEventListener('click', () => {
            FormHandler.handleBack();
        });

        document.getElementById('btn-submit').addEventListener('click', () => {
            FormHandler.handleSubmit();
        });
    }

    /**
     * Initialize the application — parse URL params, bind events,
     * set up live validation, modal, and priority buttons.
     */
    function init() {
        parseURLParams();
        bindEvents();
        FormHandler.initLiveValidation();
        UIManager.initModal();
        UIManager.initPriorityButtons();
    }

    // Boot on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
