/**
 * @module FileHandler
 * @description Handles file attachment via drag-and-drop or browse.
 * Validates file size (10 MB max), converts to Base64 for submission,
 * and manages the drop zone UI state.
 */
const FileHandler = (() => {
    'use strict';

    /** @type {number} Maximum file size in bytes (10 MB) */
    const MAX_SIZE = 10 * 1024 * 1024;

    /** @type {File|null} Currently selected file */
    let selectedFile = null;

    /** @type {string} Base64-encoded file data (set after conversion) */
    let fileBase64 = '';

    /**
     * Initialize the drop zone — bind drag/drop, click, and remove events.
     */
    function init() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('fileInput');
        const removeBtn = document.getElementById('file-remove');

        // Click to browse
        dropZone.addEventListener('click', (e) => {
            if (e.target.closest('#file-remove')) return;
            fileInput.click();
        });

        // Keyboard accessibility
        dropZone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInput.click();
            }
        });

        // File selected via browse
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                handleFile(fileInput.files[0]);
            }
        });

        // Drag events
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0]);
            }
        });

        // Remove file
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearFile();
        });
    }

    /**
     * Process a selected file — validate size and convert to Base64.
     * @param {File} file - The file to process
     */
    function handleFile(file) {
        const errorEl = document.getElementById('file-error');
        errorEl.textContent = '';

        if (file.size > MAX_SIZE) {
            errorEl.textContent = 'File is too large. Maximum size is 10 MB.';
            clearFile();
            return;
        }

        selectedFile = file;
        showFileInfo(file);
        convertToBase64(file);
    }

    /**
     * Display the selected file name and size in the drop zone.
     * @param {File} file - The selected file
     */
    function showFileInfo(file) {
        document.getElementById('file-name').textContent = file.name;
        document.getElementById('file-size').textContent = formatSize(file.size);
        document.getElementById('drop-zone-prompt').classList.add('hidden');
        document.getElementById('drop-zone-file').classList.remove('hidden');
    }

    /**
     * Clear the selected file and reset the drop zone to its initial state.
     */
    function clearFile() {
        selectedFile = null;
        fileBase64 = '';
        document.getElementById('fileInput').value = '';
        document.getElementById('drop-zone-prompt').classList.remove('hidden');
        document.getElementById('drop-zone-file').classList.add('hidden');
        document.getElementById('file-error').textContent = '';
    }

    /**
     * Read a file and convert it to a Base64-encoded string.
     * @param {File} file - The file to convert
     */
    function convertToBase64(file) {
        const reader = new FileReader();
        reader.onload = () => {
            // reader.result is "data:<mime>;base64,<data>" — extract just the Base64 portion
            fileBase64 = reader.result.split(',')[1] || '';
        };
        reader.onerror = () => {
            console.warn('FileReader error:', reader.error);
            document.getElementById('file-error').textContent = 'Failed to read file. Please try again.';
            clearFile();
        };
        reader.readAsDataURL(file);
    }

    /**
     * Format a byte count into a human-readable string.
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted size (e.g. "2.4 MB")
     */
    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /**
     * Get the Base64-encoded file data for submission.
     * @returns {string} Base64 string, or empty string if no file
     */
    function getBase64() {
        return fileBase64;
    }

    /**
     * Get the selected file name for submission.
     * @returns {string} File name, or empty string if no file
     */
    function getFileName() {
        return selectedFile ? selectedFile.name : '';
    }

    // Public API
    return {
        init,
        getBase64,
        getFileName,
        clearFile,
    };
})();
