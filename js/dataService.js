/**
 * ============================================================================
 * UNIFIED DATA SERVICE (ABSTRACTION LAYER)
 * ============================================================================
 * طبقة موحدة لإدارة البيانات: تتصل بـ Supabase عند توفره، وتعمل بذكاء على
 * التخزين المحلي (localStorage) عندما تكون الجداول غير جاهزة، دون أي أخطاء.
 *
 * lastPersistMode : 'cloud' | 'local'  → لتوضيح مكان حفظ آخر عملية
 * lastLoadSource  : 'cloud' | 'local'  → لتوضيح مصدر البيانات المعروضة
 */

const DataService = {
    STORAGE_KEYS: {
        INTRO_VIDEO: 'abdulrahman_intro_video',
        PROJECTS: 'abdulrahman_projects',
        REVIEWS: 'abdulrahman_reviews',
        SETTINGS: 'abdulrahman_settings'
    },

    lastPersistMode: 'local',
    lastLoadSource: 'local',

    /**
     * تهيئة البيانات الافتراضية عند أول تشغيل
     */
    init() {
        if (!localStorage.getItem(this.STORAGE_KEYS.PROJECTS)) {
            localStorage.setItem(
                this.STORAGE_KEYS.PROJECTS,
                JSON.stringify(window.APP_CONFIG.defaults.projects)
            );
        }

        if (!localStorage.getItem(this.STORAGE_KEYS.INTRO_VIDEO)) {
            localStorage.setItem(
                this.STORAGE_KEYS.INTRO_VIDEO,
                JSON.stringify(window.APP_CONFIG.defaults.introVideo)
            );
        }

        if (!localStorage.getItem(this.STORAGE_KEYS.REVIEWS)) {
            localStorage.setItem(
                this.STORAGE_KEYS.REVIEWS,
                JSON.stringify(window.APP_CONFIG.defaults.reviews)
            );
        }

        if (!localStorage.getItem(this.STORAGE_KEYS.SETTINGS)) {
            localStorage.setItem(
                this.STORAGE_KEYS.SETTINGS,
                JSON.stringify({
                    whatsappNumber: window.APP_CONFIG.whatsapp.number,
                    siteTitle: 'عبدالرحمن | Video Editor',
                    aboutMeText: 'صانع محتوى بصري ومونتير متخصص في الفيديوهات الإعلانية، الريلز، واليوتيوب الاحترافي.'
                })
            );
        }
    },

    isCloud() {
        return !!(window.SupabaseAdapter && window.SupabaseAdapter.isConnected());
    },

    readLocal(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    },

    // ==========================================
    // INTRO VIDEO
    // ==========================================
    async getIntroVideo() {
        this.init();

        if (this.isCloud()) {
            const settings = await window.SupabaseAdapter.fetchSettings();
            if (settings && settings.intro_video_url) {
                this.lastLoadSource = 'cloud';
                const data = {
                    youtubeUrl: settings.intro_video_url,
                    title: 'فيديو المقدمة والشواريل',
                    videoId: window.YouTubeService?.extractVideoId(settings.intro_video_url),
                    coverImageUrl: settings.intro_cover_image_url || '',
                    orientation: settings.intro_video_orientation || 'auto'
                };
                localStorage.setItem(this.STORAGE_KEYS.INTRO_VIDEO, JSON.stringify(data));
                return data;
            }
        }

        this.lastLoadSource = 'local';
        const cached = this.readLocal(this.STORAGE_KEYS.INTRO_VIDEO, window.APP_CONFIG.defaults.introVideo);
        const videoId = window.YouTubeService?.extractVideoId(cached?.youtubeUrl);
        return { ...cached, videoId };
    },

    async updateIntroVideo(youtubeUrl, title = 'فيديو المقدمة', coverOptions = {}) {
        const videoId = window.YouTubeService?.extractVideoId(youtubeUrl);
        const current = this.readLocal(this.STORAGE_KEYS.INTRO_VIDEO, {}) || {};
        let coverImageUrl = current.coverImageUrl || '';

        if (coverOptions.removeCover) {
            coverImageUrl = '';
        } else if (coverOptions.coverImageUrl) {
            coverImageUrl = coverOptions.coverImageUrl;
        }

        if (coverOptions.file && this.isCloud()) {
            const uploaded = await window.SupabaseAdapter.uploadCoverImage(coverOptions.file);
            if (uploaded) coverImageUrl = uploaded;
        } else if (coverOptions.file && coverOptions.coverImageUrl) {
            coverImageUrl = coverOptions.coverImageUrl;
        }

        const orientation = coverOptions.orientation || current.orientation || 'auto';
        const data = {
            youtubeUrl,
            videoId,
            title,
            coverImageUrl,
            orientation,
            coverWidth: coverOptions.coverWidth || current.coverWidth || 0,
            coverHeight: coverOptions.coverHeight || current.coverHeight || 0
        };

        localStorage.setItem(this.STORAGE_KEYS.INTRO_VIDEO, JSON.stringify(data));
        this.lastPersistMode = 'local';

        if (this.isCloud()) {
            const payload = { intro_video_url: youtubeUrl };
            if (coverOptions.removeCover) {
                payload.intro_cover_image_url = '';
            } else if (coverImageUrl && !String(coverImageUrl).startsWith('data:')) {
                payload.intro_cover_image_url = coverImageUrl;
            }
            if (orientation) payload.intro_video_orientation = orientation;
            const ok = await window.SupabaseAdapter.saveSettings(payload);
            if (ok) this.lastPersistMode = 'cloud';
        }

        window.dispatchEvent(new CustomEvent('site_data_updated', { detail: { type: 'intro' } }));
        return this.lastPersistMode === 'cloud';
    },

    // ==========================================
    // PORTFOLIO PROJECTS
    // ==========================================
    async getProjects() {
        this.init();

        if (this.isCloud()) {
            const remoteProjects = await window.SupabaseAdapter.fetchProjects();
            // remoteProjects === null تعني فشل الاتصال/عدم وجود الجدول → نستخدم المحلي
            if (remoteProjects) {
                this.lastLoadSource = 'cloud';
                localStorage.setItem(this.STORAGE_KEYS.PROJECTS, JSON.stringify(remoteProjects));
                return remoteProjects.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            }
        }

        this.lastLoadSource = 'local';
        const list = this.readLocal(this.STORAGE_KEYS.PROJECTS, window.APP_CONFIG.defaults.projects);
        return list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    },

    async addProject(projectData) {
        const videoId = window.YouTubeService?.extractVideoId(projectData.youtubeUrl);
        const currentProjects = await this.getProjects();
        const maxOrder = currentProjects.reduce((max, p) => Math.max(max, p.sortOrder || 0), 0);

        let coverImageUrl = projectData.coverImageUrl || '';
        if (projectData.coverFile && this.isCloud()) {
            const uploaded = await window.SupabaseAdapter.uploadCoverImage(projectData.coverFile);
            if (uploaded) coverImageUrl = uploaded;
        }

        const newProject = {
            id: 'proj_' + Date.now(),
            title: (projectData.title || '').trim() || 'مشروع جديد',
            description: (projectData.description || '').trim(),
            youtubeUrl: (projectData.youtubeUrl || '').trim(),
            videoId: videoId,
            coverImageUrl: coverImageUrl,
            orientation: projectData.orientation || 'auto',
            coverWidth: projectData.coverWidth || 0,
            coverHeight: projectData.coverHeight || 0,
            sortOrder: maxOrder + 1,
            createdAt: new Date().toISOString()
        };

        this.lastPersistMode = 'local';

        if (this.isCloud()) {
            const inserted = await window.SupabaseAdapter.insertProject(newProject);
            if (inserted && inserted.id) {
                newProject.id = inserted.id;
                this.lastPersistMode = 'cloud';
            }
        }

        const updated = [...currentProjects, newProject];
        localStorage.setItem(this.STORAGE_KEYS.PROJECTS, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('site_data_updated', { detail: { type: 'projects' } }));
        return newProject;
    },

    async updateProject(id, projectData) {
        const currentProjects = await this.getProjects();
        const index = currentProjects.findIndex(p => String(p.id) === String(id));
        if (index === -1) return false;

        const videoId = projectData.youtubeUrl ?
            window.YouTubeService?.extractVideoId(projectData.youtubeUrl) :
            currentProjects[index].videoId;

        let coverImageUrl = currentProjects[index].coverImageUrl || '';
        if (projectData.removeCover) {
            coverImageUrl = '';
        } else if (projectData.coverFile && this.isCloud()) {
            const uploaded = await window.SupabaseAdapter.uploadCoverImage(projectData.coverFile);
            if (uploaded) coverImageUrl = uploaded;
        } else if (projectData.coverImageUrl !== undefined && projectData.coverImageUrl !== '') {
            coverImageUrl = projectData.coverImageUrl;
        }

        const merged = {
            ...currentProjects[index],
            ...projectData,
            videoId: videoId || currentProjects[index].videoId,
            coverImageUrl,
            orientation: projectData.orientation || currentProjects[index].orientation || 'auto',
            coverWidth: projectData.coverWidth || currentProjects[index].coverWidth || 0,
            coverHeight: projectData.coverHeight || currentProjects[index].coverHeight || 0
        };
        delete merged.coverFile;
        delete merged.removeCover;

        currentProjects[index] = merged;
        localStorage.setItem(this.STORAGE_KEYS.PROJECTS, JSON.stringify(currentProjects));

        this.lastPersistMode = 'local';
        if (this.isCloud()) {
            const ok = await window.SupabaseAdapter.updateProject(id, {
                title: merged.title,
                description: merged.description,
                youtubeUrl: merged.youtubeUrl,
                coverImageUrl: merged.coverImageUrl,
                orientation: merged.orientation,
                coverWidth: merged.coverWidth,
                coverHeight: merged.coverHeight
            });
            if (ok) this.lastPersistMode = 'cloud';
        }

        window.dispatchEvent(new CustomEvent('site_data_updated', { detail: { type: 'projects' } }));
        return true;
    },

    async deleteProject(id) {
        const currentProjects = await this.getProjects();
        const target = currentProjects.find(p => String(p.id) === String(id));
        const updated = currentProjects.filter(p => String(p.id) !== String(id));
        localStorage.setItem(this.STORAGE_KEYS.PROJECTS, JSON.stringify(updated));

        this.lastPersistMode = 'local';
        if (this.isCloud()) {
            const ok = await window.SupabaseAdapter.deleteProject(id, target?.coverImageUrl);
            if (ok) this.lastPersistMode = 'cloud';
        }

        window.dispatchEvent(new CustomEvent('site_data_updated', { detail: { type: 'projects' } }));
        return true;
    },

    async reorderProjects(id, direction) {
        const list = await this.getProjects();
        const index = list.findIndex(p => String(p.id) === String(id));
        if (index === -1) return false;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= list.length) return false;

        const temp = list[index];
        list[index] = list[targetIndex];
        list[targetIndex] = temp;

        list.forEach((item, idx) => { item.sortOrder = idx + 1; });
        localStorage.setItem(this.STORAGE_KEYS.PROJECTS, JSON.stringify(list));

        if (this.isCloud()) {
            for (const item of list) {
                await window.SupabaseAdapter.updateProject(item.id, { sortOrder: item.sortOrder });
            }
        }

        window.dispatchEvent(new CustomEvent('site_data_updated', { detail: { type: 'projects' } }));
        return true;
    },

    // ==========================================
    // CUSTOMER REVIEWS
    // ==========================================
    async getReviews() {
        this.init();

        if (this.isCloud()) {
            const remoteReviews = await window.SupabaseAdapter.fetchReviews();
            if (remoteReviews) {
                this.lastLoadSource = 'cloud';
                localStorage.setItem(this.STORAGE_KEYS.REVIEWS, JSON.stringify(remoteReviews));
                return remoteReviews.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            }
        }

        this.lastLoadSource = 'local';
        const list = this.readLocal(this.STORAGE_KEYS.REVIEWS, window.APP_CONFIG.defaults.reviews);
        return list.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    },

    async addReview(reviewData, file = null) {
        let finalImageUrl = reviewData.imageUrl;

        // رفع الصورة إلى Supabase Storage عند توفره
        if (file && this.isCloud()) {
            const uploadedUrl = await window.SupabaseAdapter.uploadReviewImage(file);
            if (uploadedUrl) finalImageUrl = uploadedUrl;
        }

        const currentReviews = await this.getReviews();
        const maxOrder = currentReviews.reduce((max, r) => Math.max(max, r.sortOrder || 0), 0);

        const newReview = {
            id: 'rev_' + Date.now(),
            imageUrl: finalImageUrl || '',
            clientName: reviewData.clientName || 'محادثة واتساب',
            commentText: reviewData.commentText || '',
            sortOrder: maxOrder + 1,
            createdAt: new Date().toISOString()
        };

        this.lastPersistMode = 'local';

        if (this.isCloud() && finalImageUrl && !finalImageUrl.startsWith('data:')) {
            const inserted = await window.SupabaseAdapter.insertReview(newReview);
            if (inserted && inserted.id) {
                newReview.id = inserted.id;
                this.lastPersistMode = 'cloud';
            }
        }

        const updated = [...currentReviews, newReview];
        localStorage.setItem(this.STORAGE_KEYS.REVIEWS, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('site_data_updated', { detail: { type: 'reviews' } }));
        return newReview;
    },

    async deleteReview(id) {
        const currentReviews = await this.getReviews();
        const target = currentReviews.find(r => String(r.id) === String(id));
        const updated = currentReviews.filter(r => String(r.id) !== String(id));
        localStorage.setItem(this.STORAGE_KEYS.REVIEWS, JSON.stringify(updated));

        this.lastPersistMode = 'local';
        if (this.isCloud()) {
            const ok = await window.SupabaseAdapter.deleteReview(id, target?.imageUrl);
            if (ok) this.lastPersistMode = 'cloud';
        }

        window.dispatchEvent(new CustomEvent('site_data_updated', { detail: { type: 'reviews' } }));
        return true;
    },

    async reorderReviews(id, direction) {
        const list = await this.getReviews();
        const index = list.findIndex(r => String(r.id) === String(id));
        if (index === -1) return false;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= list.length) return false;

        const temp = list[index];
        list[index] = list[targetIndex];
        list[targetIndex] = temp;

        list.forEach((item, idx) => { item.sortOrder = idx + 1; });
        localStorage.setItem(this.STORAGE_KEYS.REVIEWS, JSON.stringify(list));

        if (this.isCloud()) {
            for (const item of list) {
                await window.SupabaseAdapter.updateReviewOrder(item.id, item.sortOrder);
            }
        }

        window.dispatchEvent(new CustomEvent('site_data_updated', { detail: { type: 'reviews' } }));
        return true;
    },

    // ==========================================
    // SETTINGS
    // ==========================================
    async getSettings() {
        this.init();
        return this.readLocal(this.STORAGE_KEYS.SETTINGS, {
            whatsappNumber: window.APP_CONFIG.whatsapp.number
        });
    },

    async updateSettings(newSettings) {
        const current = await this.getSettings();
        const merged = { ...current, ...newSettings };
        localStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify(merged));

        if (merged.whatsappNumber) {
            window.APP_CONFIG.whatsapp.number = String(merged.whatsappNumber).replace(/[^0-9]/g, '');
        }

        if (this.isCloud()) {
            const payload = {};
            if (merged.whatsappNumber) {
                payload.whatsapp_number = String(merged.whatsappNumber).replace(/[^0-9]/g, '');
            }
            await window.SupabaseAdapter.saveSettings(payload);
        }

        window.dispatchEvent(new CustomEvent('site_data_updated', { detail: { type: 'settings' } }));
        return true;
    },

    // ==========================================
    // SYNC LOCAL → CLOUD (زر في لوحة التحكم)
    // ==========================================
    async pushLocalToCloud() {
        if (!this.isCloud()) return { ok: false, count: 0, reason: 'offline' };

        const localProjects = this.readLocal(this.STORAGE_KEYS.PROJECTS, []);
        const localReviews = this.readLocal(this.STORAGE_KEYS.REVIEWS, []);
        const intro = this.readLocal(this.STORAGE_KEYS.INTRO_VIDEO, null);

        const remoteProjects = (await window.SupabaseAdapter.fetchProjects()) || [];
        const remoteReviews = (await window.SupabaseAdapter.fetchReviews()) || [];
        let count = 0;

        for (const p of localProjects) {
            const exists = remoteProjects.some(rp => rp.title === p.title && rp.youtubeUrl === p.youtubeUrl);
            if (!exists) {
                const ins = await window.SupabaseAdapter.insertProject(p);
                if (ins) count++;
            }
        }

        for (const r of localReviews) {
            if (!r.imageUrl || r.imageUrl.startsWith('data:')) continue;
            const exists = remoteReviews.some(rr => rr.imageUrl === r.imageUrl);
            if (!exists) {
                const ins = await window.SupabaseAdapter.insertReview(r);
                if (ins) count++;
            }
        }

        if (intro?.youtubeUrl) {
            await window.SupabaseAdapter.saveSettings({ intro_video_url: intro.youtubeUrl });
        }

        return { ok: true, count };
    },

    /**
     * استعادة البيانات الافتراضية محليًا
     */
    resetToDefaults() {
        localStorage.setItem(this.STORAGE_KEYS.PROJECTS, JSON.stringify(window.APP_CONFIG.defaults.projects));
        localStorage.setItem(this.STORAGE_KEYS.INTRO_VIDEO, JSON.stringify(window.APP_CONFIG.defaults.introVideo));
        localStorage.setItem(this.STORAGE_KEYS.REVIEWS, JSON.stringify(window.APP_CONFIG.defaults.reviews));
        window.dispatchEvent(new CustomEvent('site_data_updated', { detail: { type: 'all' } }));
    }
};

window.DataService = DataService;
