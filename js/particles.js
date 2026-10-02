/**
 * ============================================================================
 * PARTICLES & AMBIENT CANVAS BACKGROUND
 * ============================================================================
 * Lightweight, silky-smooth floating micro-stars and ambient dust particles.
 * Minimal performance impact, dynamic density scaling, tab-visibility pause,
 * and prefers-reduced-motion compliance.
 */

class ParticlesBackground {
    constructor(canvasId = 'particles-canvas') {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.animationFrameId = null;
        this.isRunning = false;
        
        // Settings
        this.colorAccent = '185, 225, 184'; // #B9E1B8
        this.colorWhite = '255, 255, 255';
        
        this.init();
    }

    init() {
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            this.canvas.style.display = 'none';
            return;
        }

        this.resize();
        this.createParticles();
        this.bindEvents();
        this.start();
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width * (window.devicePixelRatio > 1 ? 1.5 : 1);
        this.canvas.height = this.height * (window.devicePixelRatio > 1 ? 1.5 : 1);
        this.ctx.scale(window.devicePixelRatio > 1 ? 1.5 : 1, window.devicePixelRatio > 1 ? 1.5 : 1);
    }

    getParticleCount() {
        // Adaptive count based on screen width
        if (this.width < 480) return 30;
        if (this.width < 768) return 45;
        if (this.width < 1200) return 70;
        return 90;
    }

    createParticles() {
        this.particles = [];
        const count = this.getParticleCount();

        for (let i = 0; i < count; i++) {
            const isAccent = Math.random() > 0.45;
            this.particles.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                radius: Math.random() * 1.3 + 0.4, // micro size (0.4px - 1.7px)
                color: isAccent ? this.colorAccent : this.colorWhite,
                alpha: Math.random() * 0.4 + 0.15,
                baseAlpha: Math.random() * 0.4 + 0.15,
                pulseSpeed: (Math.random() * 0.02 + 0.005) * (Math.random() > 0.5 ? 1 : -1),
                vx: (Math.random() - 0.5) * 0.25, // gentle horizontal drift
                vy: (Math.random() * -0.3) - 0.1 // gentle upward float
            });
        }
    }

    bindEvents() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.resize();
                this.createParticles();
            }, 200);
        });

        // Pause animation when user switches tab to save battery and GPU
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stop();
            } else {
                this.start();
            }
        });
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];

            // Update positions
            p.x += p.vx;
            p.y += p.vy;

            // Update alpha pulsation
            p.alpha += p.pulseSpeed;
            if (p.alpha > 0.65 || p.alpha < 0.1) {
                p.pulseSpeed = -p.pulseSpeed;
            }

            // Screen wrap
            if (p.y < -10) {
                p.y = this.height + 10;
                p.x = Math.random() * this.width;
            }
            if (p.x < -10) p.x = this.width + 10;
            if (p.x > this.width + 10) p.x = -10;

            // Draw particle
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${p.color}, ${Math.max(0.05, Math.min(0.8, p.alpha))})`;
            this.ctx.fill();

            // Soft glow around accent particles
            if (p.color === this.colorAccent && p.radius > 1.0) {
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.radius * 2.2, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(${p.color}, ${p.alpha * 0.25})`;
                this.ctx.fill();
            }
        }

        if (this.isRunning) {
            this.animationFrameId = requestAnimationFrame(() => this.render());
        }
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.render();
        }
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.particlesEngine = new ParticlesBackground('particles-canvas');
});
