/**
 * ============================================================================
 * YOUTUBE PARSER & EMBED MANAGER
 * ============================================================================
 * Robust extraction of YouTube Video IDs across all URL formats,
 * responsive embed generation, and high-performance facade lazy player.
 */

const YouTubeService = {
    /**
     * Extracts YouTube Video ID from any valid YouTube URL
     * Supports:
     * - youtube.com/watch?v=ID
     * - youtu.be/ID
     * - youtube.com/embed/ID
     * - youtube.com/shorts/ID
     * - m.youtube.com/watch?v=ID
     * - Direct 11-char ID
     * 
     * @param {string} url 
     * @returns {string|null} 11-character video ID or null
     */
    extractVideoId(url) {
        if (!url || typeof url !== 'string') return null;
        
        const cleanUrl = url.trim();
        
        // If the input is already an 11-character video ID
        if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
            return cleanUrl;
        }

        // Comprehensive Regex for YouTube URLs
        const regExp = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = cleanUrl.match(regExp);

        if (match && match[1]) {
            return match[1];
        }

        try {
            // Fallback via URL parameters
            const parsedUrl = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`);
            if (parsedUrl.hostname.includes('youtube.com')) {
                const v = parsedUrl.searchParams.get('v');
                if (v && v.length === 11) return v;
            }
        } catch (e) {
            // Invalid URL format
        }

        return null;
    },

    isShortsUrl(url) {
        if (!url || typeof url !== 'string') return false;
        return /youtube\.com\/shorts\//i.test(url.trim());
    },

    /**
     * يحدد اتجاه العرض: طولي (9:16) أو عرضي (16:9)
     * الأولوية: اختيار الأدمن → رابط شورتس → أبعاد صورة الغلاف → عرضي
     */
    resolveOrientation(options) {
        const opts = options || {};
        const choice = String(opts.orientation || 'auto').toLowerCase();
        if (choice === 'portrait' || choice === 'طولي') return 'portrait';
        if (choice === 'landscape' || choice === 'عرضي') return 'landscape';

        if (this.isShortsUrl(opts.youtubeUrl)) return 'portrait';

        const w = Number(opts.coverWidth);
        const h = Number(opts.coverHeight);
        if (w > 0 && h > 0) {
            return h > w * 1.08 ? 'portrait' : 'landscape';
        }

        return 'landscape';
    },

    applyOrientationClass(element, orientation) {
        if (!element) return;
        const isPortrait = orientation === 'portrait';
        element.classList.toggle('is-portrait', isPortrait);
        element.classList.toggle('is-landscape', !isPortrait);
        const parent = element.parentElement;
        if (parent && (parent.classList.contains('intro-video-container') || parent.classList.contains('project-card'))) {
            parent.classList.toggle('is-portrait', isPortrait);
            parent.classList.toggle('is-landscape', !isPortrait);
        }
        if (element.classList.contains('project-video-box')) {
            const card = element.closest('.project-card');
            if (card) {
                card.classList.toggle('is-portrait', isPortrait);
                card.classList.toggle('is-landscape', !isPortrait);
            }
        }
    },

    /**
     * Generates a safe embed URL for an iframe
     * @param {string} videoId 
     * @param {boolean} autoplay 
     * @returns {string}
     */
    getEmbedUrl(videoId, autoplay = false) {
        if (!videoId) return '';
        const params = new URLSearchParams({
            rel: '0',
            modestbranding: '1',
            playsinline: '1',
            enablejsapi: '1',
            origin: window.location.origin || 'http://localhost'
        });

        if (autoplay) {
            params.set('autoplay', '1');
            params.set('mute', '0');
        }

        return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
    },

    /**
     * Gets best available thumbnail URL for a video ID
     * @param {string} videoId 
     * @returns {string}
     */
    getThumbnailUrl(videoId) {
        if (!videoId) return '';
        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    },

    escapeCssUrl(url) {
        if (!url) return '';
        return String(url).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
    },

    /**
     * Renders a lightweight lazy-loading facade.
     * When the user clicks the play button, the interactive iframe is loaded seamlessly
     * without any redirection to YouTube.
     *
     * @param {HTMLElement} container
     * @param {string} videoId
     * @param {string} title
     * @param {string} [customCoverUrl] صورة غلاف مخصصة من لوحة التحكم (اختياري)
     */
    renderFacade(container, videoId, title = 'فيديو', customCoverUrl = '') {
        if (!container || !videoId) return;

        const hasCustomCover = !!(customCoverUrl && String(customCoverUrl).trim());
        const thumbUrl = hasCustomCover ? String(customCoverUrl).trim() : this.getThumbnailUrl(videoId);
        const isPortraitBox = container.classList.contains('is-portrait');
        const fallbackThumb = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        const safeThumb = this.escapeCssUrl(thumbUrl);
        const safeTitle = String(title || 'فيديو').replace(/"/g, '&quot;');

        container.innerHTML = `
            <div class="video-facade${isPortraitBox ? ' is-portrait' : ''}" style="background-image: url('${safeThumb}'); background-size: ${hasCustomCover || isPortraitBox ? 'cover' : 'cover'};" role="button" tabindex="0" aria-label="تشغيل فيديو: ${safeTitle}">
                <div class="play-button" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                </div>
            </div>
        `;

        const facadeEl = container.querySelector('.video-facade');

        // Fallback if YouTube maxresdefault is not available (skip when custom cover is set)
        if (!hasCustomCover) {
            const testImg = new Image();
            testImg.onload = () => {
                if (testImg.naturalWidth === 120) {
                    facadeEl.style.backgroundImage = `url('${fallbackThumb}')`;
                }
            };
            testImg.src = thumbUrl;
        }

        const activatePlayer = (e) => {
            if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
            if (e.type === 'keydown') e.preventDefault();

            const embedUrl = this.getEmbedUrl(videoId, true);
            container.innerHTML = `
                <iframe
                    src="${embedUrl}"
                    title="${safeTitle}"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                    loading="eager"
                ></iframe>
            `;
        };

        facadeEl.addEventListener('click', activatePlayer);
        facadeEl.addEventListener('keydown', activatePlayer);
    },

    /**
     * Directly mounts an iframe into the container
     * @param {HTMLElement} container 
     * @param {string} videoId 
     * @param {string} title 
     */
    mountIframe(container, videoId, title = 'فيديو') {
        if (!container || !videoId) return;
        const embedUrl = this.getEmbedUrl(videoId, false);
        container.innerHTML = `
            <iframe 
                src="${embedUrl}" 
                title="${title}" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                allowfullscreen
                loading="lazy"
            ></iframe>
        `;
    }
};

window.YouTubeService = YouTubeService;
