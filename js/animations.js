/**
 * ============================================================================
 * SCROLL REVEAL & SMOOTH INTERACTION ANIMATIONS
 * ============================================================================
 * Uses IntersectionObserver for high performance, smooth scroll navigation,
 * and adaptive header backdrop dynamics.
 */

const AnimationManager = {
    observer: null,

    init() {
        this.initObserver();
        this.initSmoothNav();
        this.initHeaderScroll();
        this.observeElements();
    },

    initObserver() {
        const options = {
            root: null,
            rootMargin: '0px 0px -60px 0px',
            threshold: 0.12
        };

        this.observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-revealed');
                    // Unobserve after reveal to optimize memory
                    observer.unobserve(entry.target);
                }
            });
        }, options);
    },

    observeElements() {
        if (!this.observer) return;
        const elements = document.querySelectorAll('.reveal-on-scroll');
        elements.forEach(el => this.observer.observe(el));
    },

    initSmoothNav() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const targetId = this.getAttribute('href');
                if (targetId === '#') return;

                const targetEl = document.querySelector(targetId);
                if (targetEl) {
                    e.preventDefault();
                    targetEl.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    },

    initHeaderScroll() {
        const header = document.querySelector('.site-header');
        if (!header) return;

        let lastScrollY = window.scrollY;
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
            lastScrollY = currentScrollY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
    }
};

window.AnimationManager = AnimationManager;
