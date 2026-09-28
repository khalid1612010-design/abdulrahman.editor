/**
 * ============================================================================
 * SHARED TOAST NOTIFICATIONS (Vanilla JS)
 * ============================================================================
 * يُستخدم في الصفحة الرئيسية ولوحة التحكم (كان الاعتماد سابقًا على main.js
 * وهو غير محمّل داخل admin.html مما سبّب توقف عمليات الحفظ عن إظهار النتائج).
 */

(function () {
    'use strict';

    if (typeof window.showToast === 'function') return;

    /**
     * @param {string} message
     * @param {'success'|'error'|'info'} type
     * @param {number} duration
     */
    window.showToast = function (message, type, duration) {
        type = type || 'success';
        duration = typeof duration === 'number' ? duration : 4500;

        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            container.setAttribute('aria-live', 'polite');
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.setAttribute('role', 'alert');

        const icon = document.createElement('span');
        icon.className = 'toast-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = type === 'error' ? '⚠️' : (type === 'info' ? 'ℹ️' : '✓');

        const text = document.createElement('span');
        text.className = 'toast-text';
        text.textContent = message;

        toast.appendChild(icon);
        toast.appendChild(text);
        container.appendChild(toast);

        setTimeout(function () {
            toast.classList.add('toast-hiding');
            setTimeout(function () {
                if (toast.parentNode) toast.remove();
            }, 320);
        }, duration);
    };
})();
