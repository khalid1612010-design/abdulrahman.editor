/**
 * ============================================================================
 * WHATSAPP MESSAGING & LEAD GENERATION
 * ============================================================================
 * Form validation, dynamic Arabic message construction, and instant redirection
 * to WhatsApp wa.me endpoint without requiring complex backend.
 */

const WhatsAppService = {
    init() {
        const form = document.getElementById('cta-contact-form');
        if (!form) return;

        form.addEventListener('submit', (e) => this.handleSubmit(e));
    },

    async handleSubmit(e) {
        e.preventDefault();
        const form = e.target;

        // Extract input values
        const nameInput = form.querySelector('#client-name');
        const emailInput = form.querySelector('#client-email');
        const phoneInput = form.querySelector('#client-phone');
        const serviceSelect = form.querySelector('#project-service');
        const budgetInput = form.querySelector('#project-budget');
        const detailsInput = form.querySelector('#project-details');

        // Reset errors
        form.querySelectorAll('.form-group').forEach(fg => fg.classList.remove('has-error'));

        let isValid = true;

        if (!nameInput.value.trim()) {
            this.showFieldError(nameInput, 'يرجى إدخال اسمك الكريم');
            isValid = false;
        }

        if (!emailInput.value.trim() || !this.validateEmail(emailInput.value.trim())) {
            this.showFieldError(emailInput, 'يرجى إدخال بريد إلكتروني صحيح');
            isValid = false;
        }

        if (!phoneInput.value.trim() || phoneInput.value.trim().length < 7) {
            this.showFieldError(phoneInput, 'يرجى إدخال رقم هاتف صحيح');
            isValid = false;
        }

        if (!serviceSelect.value) {
            this.showFieldError(serviceSelect, 'يرجى اختيار نوع المشروع');
            isValid = false;
        }

        if (!detailsInput.value.trim()) {
            this.showFieldError(detailsInput, 'يرجى كتابة نبذة أو تفاصيل عن المشروع');
            isValid = false;
        }

        if (!isValid) {
            if (window.showToast) {
                window.showToast('يرجى التأكد من ملء جميع الحقول المطلوبة بشكل صحيح', 'error');
            }
            return;
        }

        // Fetch settings for dynamic WhatsApp number
        const settings = await window.DataService?.getSettings();
        const targetNumber = settings?.whatsappNumber || window.APP_CONFIG?.whatsapp?.number || '201021407272';
        const cleanNumber = targetNumber.replace(/[^0-9]/g, '');

        // Construct pre-filled Arabic message as specified
        const message = 
`مرحبًا عبدالرحمن،

أريد بدء مشروع جديد.

الاسم:
${nameInput.value.trim()}

الإيميل:
${emailInput.value.trim()}

رقم الهاتف:
${phoneInput.value.trim()}

نوع المشروع:
${serviceSelect.value}

الميزانية:
${budgetInput.value.trim() || 'لم يتم التحديد'}

تفاصيل المشروع:
${detailsInput.value.trim()}`;

        // Construct safe wa.me link
        const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;

        if (window.showToast) {
            window.showToast('جاري تحويلك إلى واتساب لإرسال تفاصيل المشروع...', 'success');
        }

        // Open WhatsApp in new tab
        setTimeout(() => {
            window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
        }, 300);
    },

    showFieldError(inputEl, message) {
        const group = inputEl.closest('.form-group');
        if (group) {
            group.classList.add('has-error');
            let errorEl = group.querySelector('.form-error-msg');
            if (errorEl) {
                errorEl.textContent = message;
            }
        }
    },

    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
};

window.WhatsAppService = WhatsAppService;
