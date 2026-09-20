/**
 * ============================================================================
 * MAIN PORTFOLIO CONTROLLER
 * ============================================================================
 * Orchestrates dynamic data rendering, video lazy facades, review lightboxes,
 * and real-time synchronization.
 */

// ============================================================================
// NOTE: نظام التنبيهات (showToast) أصبح ملفًا مستقلًا في: js/toast.js
// ويُحمّل في index.html و admin.html قبل هذا الملف.
// ============================================================================
if (typeof window.showToast !== 'function') {
    // حماية بسيطة في حال عدم تحميل الملف بالخطأ
    window.showToast = function (message, type) {
        console.log('[toast:' + (type || 'success') + ']', message);
    };
}

const PortfolioApp = {
    async init() {
        console.log('🚀 Initializing Video Editor Portfolio...');

        // 1. Initialize Supabase if credentials exist
        if (window.SupabaseAdapter) {
            window.SupabaseAdapter.init();
        }

        // 2. Render Core Dynamic Sections
        await this.renderIntroVideo();
        await this.renderPortfolioGrid();
        await this.renderReviewsGrid();

        // 3. Setup Interactive Components
        this.setupLightbox();
        
        if (window.WhatsAppService) {
            window.WhatsAppService.init();
        }

        if (window.AnimationManager) {
            window.AnimationManager.init();
        }

        // 4. Listen for live data updates from dashboard or storage
        window.addEventListener('site_data_updated', async (e) => {
            const detail = e.detail || {};
            if (detail.type === 'intro' || detail.type === 'all') {
                await this.renderIntroVideo();
            }
            if (detail.type === 'projects' || detail.type === 'all') {
                await this.renderPortfolioGrid();
            }
            if (detail.type === 'reviews' || detail.type === 'all') {
                await this.renderReviewsGrid();
            }
            if (window.AnimationManager) {
                window.AnimationManager.observeElements();
            }
        });
    },

    /**
     * Renders the main Hero Intro Video
     */
    async renderIntroVideo() {
        const container = document.getElementById('intro-video-frame');
        if (!container) return;

        try {
            const intro = await window.DataService.getIntroVideo();
            const videoId = intro.videoId || window.YouTubeService?.extractVideoId(intro.youtubeUrl);

            if (videoId) {
                const orientation = window.YouTubeService.resolveOrientation({
                    youtubeUrl: intro.youtubeUrl,
                    orientation: intro.orientation,
                    coverWidth: intro.coverWidth,
                    coverHeight: intro.coverHeight
                });
                window.YouTubeService.applyOrientationClass(container, orientation);
                const wrap = container.closest('.intro-video-container');
                if (wrap) window.YouTubeService.applyOrientationClass(wrap, orientation);
                window.YouTubeService.renderFacade(container, videoId, 'فيديو المقدمة والشواريل', intro.coverImageUrl || '');
                this.refineOrientationFromCover(container, intro, wrap);
            } else {
                container.innerHTML = `
                    <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-text-muted);padding:2rem;text-align:center;">
                        <div>
                            <p style="font-size:1.2rem;margin-bottom:0.5rem;">فيديو المقدمة قيد التحديث</p>
                            <p style="font-size:0.9rem;opacity:0.7;">يمكنك إضافة رابط YouTube لفيديو المقدمة من لوحة التحكم</p>
                        </div>
                    </div>
                `;
            }
        } catch (err) {
            console.error('Error rendering intro video:', err);
        }
    },

    /**
     * Renders Portfolio Projects Grid (2 columns on desktop, 1 on mobile)
     */
    async renderPortfolioGrid() {
        const grid = document.getElementById('portfolio-grid');
        if (!grid) return;

        try {
            const projects = await window.DataService.getProjects();

            if (!projects || projects.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">🎬</div>
                        <h3 class="empty-state-title">لا توجد أعمال مضافة حاليًا</h3>
                        <p>سيتم إضافة أعمال وفيديوهات جديدة قريبًا جدًا.</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = '';

            projects.forEach((project, index) => {
                const card = document.createElement('div');
                card.className = `project-card reveal-on-scroll delay-${(index % 2) + 1}`;
                card.id = `project-${project.id}`;

                const videoId = project.videoId || window.YouTubeService?.extractVideoId(project.youtubeUrl);

                card.innerHTML = `
                    <div class="project-video-box" id="video-container-${project.id}"></div>
                    <div class="project-meta">
                        <h3 class="project-title">${this.escapeHtml(project.title)}</h3>
                        <p class="project-description">${this.escapeHtml(project.description)}</p>
                    </div>
                `;

                grid.appendChild(card);

                // Render video facade
                const videoBox = card.querySelector(`#video-container-${project.id}`);
                if (videoId) {
                    const orientation = window.YouTubeService.resolveOrientation({
                        youtubeUrl: project.youtubeUrl,
                        orientation: project.orientation,
                        coverWidth: project.coverWidth,
                        coverHeight: project.coverHeight
                    });
                    window.YouTubeService.applyOrientationClass(videoBox, orientation);
                    window.YouTubeService.renderFacade(videoBox, videoId, project.title, project.coverImageUrl || '');
                    this.refineOrientationFromCover(videoBox, project);
                } else {
                    videoBox.innerHTML = `
                        <div style="display:flex;align-items:center;justify-content:center;height:100%;background:#0a0d0a;color:var(--color-text-dim);">
                            <span>فيديو غير متوفر</span>
                        </div>
                    `;
                }
            });
        } catch (err) {
            console.error('Error rendering projects:', err);
        }
    },

    /**
     * Renders Customer Reviews Grid
     */
    async renderReviewsGrid() {
        const grid = document.getElementById('reviews-grid');
        if (!grid) return;

        try {
            const reviews = await window.DataService.getReviews();

            if (!reviews || reviews.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">💬</div>
                        <h3 class="empty-state-title">لا توجد آراء مضافة حاليًا</h3>
                        <p>نعتز دائمًا برضا وثقة عملائنا.</p>
                    </div>
                `;
                return;
            }

            grid.innerHTML = '';

            reviews.forEach((review, index) => {
                const card = document.createElement('div');
                card.className = `review-card reveal-on-scroll delay-${(index % 3) + 1}`;
                card.setAttribute('role', 'button');
                card.setAttribute('tabindex', '0');
                card.setAttribute('aria-label', `عرض رأي: ${review.clientName || 'عميل'}`);

                card.innerHTML = `
                    <div class="review-card-header">
                        <span class="review-badge">
                            <svg viewBox="0 0 24 24"><path d="M12.001 2.002c-5.522 0-9.999 4.477-9.999 9.999 0 1.8.48 3.49 1.32 4.96L2.09 21.91l5.12-1.34c1.41.77 3.03 1.22 4.79 1.22 5.522 0 10-4.477 10-10s-4.478-9.988-10-9.988z"></path></svg>
                            ${this.escapeHtml(review.clientName || 'محادثة واتساب')}
                        </span>
                        <span class="review-zoom-icon">🔍 تكبير</span>
                    </div>
                    <div class="review-image-wrap">
                        <img src="${review.imageUrl}" alt="رأي العميل ${review.clientName || ''}" class="review-image" loading="lazy">
                    </div>
                `;

                // Lightbox trigger on click or Enter
                const openReview = () => this.openLightbox(review.imageUrl, review.clientName);
                card.addEventListener('click', openReview);
                card.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openReview();
                    }
                });

                grid.appendChild(card);
            });
        } catch (err) {
            console.error('Error rendering reviews:', err);
        }
    },

    /**
     * Setup Lightbox Modal
     */
    setupLightbox() {
        let modal = document.getElementById('review-lightbox-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'review-lightbox-modal';
            modal.className = 'lightbox-modal';
            modal.innerHTML = `
                <div class="lightbox-content">
                    <button class="lightbox-close" aria-label="إغلاق">&times;</button>
                    <img src="" alt="معاينة رأي العميل" class="lightbox-image" id="lightbox-img">
                </div>
            `;
            document.body.appendChild(modal);

            const closeBtn = modal.querySelector('.lightbox-close');
            closeBtn.addEventListener('click', () => this.closeLightbox());

            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeLightbox();
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modal.classList.contains('active')) {
                    this.closeLightbox();
                }
            });
        }
    },

    openLightbox(imageUrl, title = '') {
        const modal = document.getElementById('review-lightbox-modal');
        const img = document.getElementById('lightbox-img');
        if (modal && img) {
            img.src = imageUrl;
            img.alt = title ? `رأي ${title}` : 'معاينة رأي العميل';
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    closeLightbox() {
        const modal = document.getElementById('review-lightbox-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    refineOrientationFromCover(element, item, extraEl) {
        if (!element || !item || !item.coverImageUrl) return;
        if (item.orientation === 'portrait' || item.orientation === 'landscape') return;
        if (item.coverWidth && item.coverHeight) return;
        const img = new Image();
        img.onload = () => {
            const orientation = window.YouTubeService.resolveOrientation({
                youtubeUrl: item.youtubeUrl,
                orientation: item.orientation,
                coverWidth: img.naturalWidth,
                coverHeight: img.naturalHeight
            });
            window.YouTubeService.applyOrientationClass(element, orientation);
            if (extraEl) window.YouTubeService.applyOrientationClass(extraEl, orientation);
        };
        img.src = item.coverImageUrl;
    },

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    PortfolioApp.init();
});
