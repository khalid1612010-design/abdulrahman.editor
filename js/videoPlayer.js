/**
 * ============================================================================
 * HTML5 VIDEO PLAYER  —  لا يعتمد على YouTube بأي شكل
 * ============================================================================
 * واجهة تشغيل داخل الموقع: غلاف + Play/Pause + ملء الشاشة فقط.
 */

const VideoPlayer = {
    allowedTypes: [
        'video/mp4',
        'video/webm',
        'video/ogg',
        'video/quicktime',
        'video/x-m4v',
        'video/x-matroska'
    ],

    allowedExtensions: ['mp4', 'webm', 'ogg', 'mov', 'm4v', 'mkv'],

    isVideoFile(file) {
        if (!file) return false;
        if (file.type && this.allowedTypes.includes(file.type)) return true;
        if (file.type && file.type.startsWith('video/')) return true;
        const ext = String(file.name || '').split('.').pop().toLowerCase();
        return this.allowedExtensions.indexOf(ext) !== -1;
    },

    formatFileSize(bytes) {
        const n = Number(bytes) || 0;
        if (n < 1024) return n + ' بايت';
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' كيلوبايت';
        return (n / (1024 * 1024)).toFixed(1) + ' ميجابايت';
    },

    resolveVideoUrl(item) {
        if (!item) return '';
        if (item.videoUrl) return item.videoUrl;
        if (item.video_url) return item.video_url;
        return '';
    },

    resolveOrientation(options) {
        const opts = options || {};
        const choice = String(opts.orientation || 'auto').toLowerCase();
        if (choice === 'portrait' || choice === 'طولي') return 'portrait';
        if (choice === 'landscape' || choice === 'عرضي') return 'landscape';

        const w = Number(opts.coverWidth || opts.videoWidth);
        const h = Number(opts.coverHeight || opts.videoHeight);
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

    escapeAttr(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    pauseOthers(currentVideo) {
        document.querySelectorAll('video').forEach((vid) => {
            if (vid !== currentVideo && !vid.paused) {
                vid.pause();
            }
        });
    },

    /**
     * غلاف قابل للضغط → تشغيل HTML5 داخل نفس الحاوية
     * options.autoplay = true يشغّل الفيديو فورًا (فيديو المقدمة)
     */
    renderFacade(container, videoUrl, title, coverUrl, options) {
        if (!container || !videoUrl) return;

        const safeTitle = this.escapeAttr(title || 'فيديو');
        const poster = coverUrl ? this.escapeAttr(coverUrl) : '';
        const autoplay = !!(options && options.autoplay);

        if (autoplay) {
            this.mountPlayer(container, videoUrl, safeTitle, poster, { autoplay: true });
            return;
        }

        const bg = poster ? ` style="background-image:url('${poster}')"` : '';

        container.innerHTML = `
            <div class="video-facade"${bg} role="button" tabindex="0" aria-label="تشغيل فيديو: ${safeTitle}">
                <div class="play-button" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </div>
            </div>
        `;

        const facade = container.querySelector('.video-facade');
        const activate = (e) => {
            if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
            if (e.type === 'keydown') e.preventDefault();
            this.mountPlayer(container, videoUrl, safeTitle, poster);
        };
        facade.addEventListener('click', activate);
        facade.addEventListener('keydown', activate);
    },

    mountPlayer(container, videoUrl, title, poster, options) {
        container.innerHTML = `
            <div class="html5-player">
                <video
                    src="${this.escapeAttr(videoUrl)}"
                    ${poster ? `poster="${poster}"` : ''}
                    playsinline
                    webkit-playsinline=""
                    preload="auto"
                    title="${title}"
                ></video>
                <div class="player-controls">
                    <button type="button" class="player-btn player-toggle" aria-label="تشغيل">
                        <svg class="icon-play" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        <svg class="icon-pause" viewBox="0 0 24 24" hidden><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                    </button>
                    <button type="button" class="player-btn player-fs" aria-label="ملء الشاشة">
                        <svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm0-4h2V7h3V5H5v5h2zm10 7h-3v2h5v-5h-2v3zm-3-11v2h3v3h2V5h-5z"></path></svg>
                    </button>
                </div>
            </div>
        `;

        const wrap = container.querySelector('.html5-player');
        const video = wrap.querySelector('video');
        const toggleBtn = wrap.querySelector('.player-toggle');
        const fsBtn = wrap.querySelector('.player-fs');
        const iconPlay = toggleBtn.querySelector('.icon-play');
        const iconPause = toggleBtn.querySelector('.icon-pause');

        const syncIcons = () => {
            const playing = !video.paused;
            wrap.classList.toggle('is-playing', playing);
            iconPlay.hidden = playing;
            iconPause.hidden = !playing;
            toggleBtn.setAttribute('aria-label', playing ? 'إيقاف' : 'تشغيل');
        };

        const togglePlay = (e) => {
            if (e) e.stopPropagation();
            if (video.paused) {
                this.pauseOthers(video);
                video.muted = false;
                video.play().catch(() => {});
            } else {
                video.pause();
            }
        };

        toggleBtn.addEventListener('click', togglePlay);
        video.addEventListener('click', togglePlay);
        video.addEventListener('play', () => {
            this.pauseOthers(video);
            syncIcons();
        });
        video.addEventListener('pause', syncIcons);
        video.addEventListener('ended', syncIcons);

        const getFsElement = () => document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
        const getFsVideo = () => video.webkitDisplayingFullscreen ? video : null;

        const isActuallyFullscreen = () => !!(getFsElement() || getFsVideo());

        const enterFullscreen = () => {
            const node = wrap;
            // iOS Safari: الـ video element نفسه هو من يدعم ملء الشاشة
            if (video.webkitSupportsFullscreen) {
                const p = video.webkitEnterFullscreen();
                if (p && typeof p.catch === 'function') p.catch(() => {});
                return true;
            }
            const req = node.requestFullscreen || node.webkitRequestFullscreen || node.msRequestFullscreen;
            if (req) {
                const result = req.call(node);
                if (result && typeof result.catch === 'function') {
                    result.catch(() => {
                        if (video.webkitSupportsFullscreen) video.webkitEnterFullscreen();
                    });
                }
                return true;
            }
            return false;
        };

        const exitFullscreen = () => {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (video.webkitExitFullscreen) video.webkitExitFullscreen();
        };

        fsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isActuallyFullscreen()) enterFullscreen();
            else exitFullscreen();
        });

        const shouldAutoplay = !!(options && options.autoplay);
        if (shouldAutoplay) {
            video.playsInline = true;
            video.volume = 1;

            const unlockSound = () => {
                video.muted = false;
                video.volume = 1;
                if (video.paused) {
                    this.pauseOthers(video);
                    video.play().catch(() => {});
                }
            };

            const bindUnlock = () => {
                const events = ['pointerdown', 'touchstart', 'keydown', 'scroll', 'wheel'];
                const onUnlock = (e) => {
                    if (e && wrap.contains(e.target)) return;
                    unlockSound();
                    events.forEach((name) => window.removeEventListener(name, onUnlock, true));
                };
                events.forEach((name) => window.addEventListener(name, onUnlock, { capture: true, passive: true }));
            };

            const tryPlay = () => {
                this.pauseOthers(video);
                video.muted = false;
                const playAttempt = video.play();
                if (playAttempt && typeof playAttempt.then === 'function') {
                    playAttempt.catch(() => {
                        video.muted = true;
                        video.play().then(bindUnlock).catch(() => {});
                    });
                }
            };

            if (video.readyState >= 2) tryPlay();
            else video.addEventListener('canplay', tryPlay, { once: true });
        }

        syncIcons();
    }
};

window.VideoPlayer = VideoPlayer;
