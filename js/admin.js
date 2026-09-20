/**
 * ============================================================================
 * ADMIN DASHBOARD CONTROLLER (لوحة التحكم)
 * ============================================================================
 * إدارة: فيديو المقدمة • مشاريع البورتفوليو • آراء العملاء
 * + فحص حالة الاتصال بـ Supabase وعرض أوامر SQL الجاهزة عند الحاجة.
 *
 * ملاحظة مهمة: تم إصلاح الخطأ الذي كان يمنع إتمام عمليات الحفظ
 * (كان النداء لـ window.showToast غير محمي بينما ملف التنبيهات غير محمّل
 * داخل admin.html، ما أدى لرمي TypeError وتوقف الكود قبل إغلاق المودال
 * وتحديث القائمة). الآن التنبيهات في js/toast.js محمّلة قبل هذا الملف
 * وكل استدعاءات التنبيه محمية أيضًا.
 */

const AdminApp = {
    currentDeletingId: null,
    currentDeletingType: null,
    editingProjectId: null,
    selectedReviewFile: null,
    selectedImageDataUrl: null,
    selectedProjectCoverFile: null,
    selectedProjectCoverDataUrl: null,
    currentProjectCoverUrl: '',
    removeProjectCover: false,
    selectedIntroCoverFile: null,
    selectedIntroCoverDataUrl: null,
    currentIntroCoverUrl: '',
    removeIntroCover: false,
    introCoverWidth: 0,
    introCoverHeight: 0,
    projectCoverWidth: 0,
    projectCoverHeight: 0,
    health: null,

    // ==========================================
    // أوامر SQL الجاهزة لـ Supabase
    // ==========================================
    SETUP_SQL: `-- ============================================================
-- Abdulrahman | Video Editor Portfolio  -  Supabase Setup
-- انسخ هذا الكود كامل والصقه في: Supabase > SQL Editor > Run
-- ============================================================

-- 1) إعدادات الموقع (فيديو المقدمة)
create table if not exists public.site_settings (
  id integer primary key default 1,
  intro_video_url text default '',
  intro_cover_image_url text default '',
  whatsapp_number text default '201021407272',
  updated_at timestamptz default now()
);

alter table public.site_settings add column if not exists intro_cover_image_url text default '';
alter table public.site_settings add column if not exists intro_video_orientation text default 'auto';

insert into public.site_settings (id, intro_video_url, whatsapp_number)
values (1, '', '201021407272')
on conflict (id) do nothing;

-- 2) مشاريع البورتفوليو
create table if not exists public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  youtube_url text not null,
  youtube_video_id text,
  cover_image_url text default '',
  sort_order integer default 1,
  created_at timestamptz default now()
);

alter table public.portfolio_projects add column if not exists cover_image_url text default '';
alter table public.portfolio_projects add column if not exists orientation text default 'auto';
alter table public.portfolio_projects add column if not exists cover_width integer default 0;
alter table public.portfolio_projects add column if not exists cover_height integer default 0;

-- 3) آراء العملاء
create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  client_name text default 'محادثة واتساب',
  comment_text text default '',
  sort_order integer default 1,
  created_at timestamptz default now()
);

-- 4) الأمان: تفعيل RLS + سياسات الوصول
alter table public.site_settings enable row level security;
alter table public.portfolio_projects enable row level security;
alter table public.customer_reviews enable row level security;

drop policy if exists "portfolio_settings_access" on public.site_settings;
drop policy if exists "portfolio_projects_access" on public.portfolio_projects;
drop policy if exists "portfolio_reviews_access" on public.customer_reviews;

create policy "portfolio_settings_access" on public.site_settings
  for all to anon, authenticated using (true) with check (true);
create policy "portfolio_projects_access" on public.portfolio_projects
  for all to anon, authenticated using (true) with check (true);
create policy "portfolio_reviews_access" on public.customer_reviews
  for all to anon, authenticated using (true) with check (true);

-- 5) فهارس تسريع الترتيب
create index if not exists portfolio_projects_sort_idx on public.portfolio_projects (sort_order);
create index if not exists customer_reviews_sort_idx on public.customer_reviews (sort_order);

-- 6) Bucket صور آراء العملاء + سياساته
insert into storage.buckets (id, name, public)
values ('customer-reviews', 'customer-reviews', true)
on conflict (id) do update set public = true;

drop policy if exists "reviews_bucket_read" on storage.objects;
drop policy if exists "reviews_bucket_insert" on storage.objects;
drop policy if exists "reviews_bucket_delete" on storage.objects;

create policy "reviews_bucket_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'customer-reviews');
create policy "reviews_bucket_insert" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'customer-reviews');
create policy "reviews_bucket_delete" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'customer-reviews');`,

    async init() {
        console.log('🔒 Admin Dashboard Initializing...');

        if (window.SupabaseAdapter) {
            window.SupabaseAdapter.init();
        }

        this.bindGlobalEvents();
        this.initTabs();
        await this.checkAuth();
    },

    // ==========================================
    // AUTHENTICATION
    // ==========================================
    async hashPassword(str) {
        try {
            if (window.crypto && window.crypto.subtle) {
                const encoder = new TextEncoder();
                const data = encoder.encode(str);
                const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
                return Array.from(new Uint8Array(hashBuffer))
                    .map(b => b.toString(16).padStart(2, '0')).join('');
            }
        } catch (e) {
            console.warn('SHA-256 غير متاح في هذا السياق، سيتم استخدام المقارنة المباشرة.');
        }
        return null;
    },

    async checkAuth() {
        const loginScreen = document.getElementById('admin-login-screen');
        const dashboardScreen = document.getElementById('admin-dashboard-screen');
        const sessionToken = sessionStorage.getItem(window.APP_CONFIG.admin.sessionKey);

        if (sessionToken === window.APP_CONFIG.admin.passwordHash) {
            loginScreen.style.display = 'none';
            dashboardScreen.style.display = 'block';
            await this.loadDashboardData();
        } else {
            loginScreen.style.display = 'flex';
            dashboardScreen.style.display = 'none';
            this.setupLoginForm();
        }
    },

    setupLoginForm() {
        const form = document.getElementById('admin-login-form');
        const passInput = document.getElementById('admin-password-input');
        const errorMsg = document.getElementById('login-error-msg');

        if (!form) return;

        form.onsubmit = async (e) => {
            e.preventDefault();
            const entered = passInput.value.trim();

            if (!entered) {
                errorMsg.textContent = 'يرجى إدخال كلمة المرور';
                errorMsg.style.display = 'block';
                return;
            }

            const enteredHash = await this.hashPassword(entered);
            const isMatch =
                (enteredHash && enteredHash === window.APP_CONFIG.admin.passwordHash) ||
                entered === window.APP_CONFIG.admin.defaultRawPassword;

            if (isMatch) {
                sessionStorage.setItem(window.APP_CONFIG.admin.sessionKey, window.APP_CONFIG.admin.passwordHash);
                passInput.value = '';
                errorMsg.style.display = 'none';
                await this.checkAuth();
                if (window.showToast) window.showToast('تم تسجيل الدخول بنجاح', 'success');
            } else {
                errorMsg.textContent = 'كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى';
                errorMsg.style.display = 'block';
            }
        };
    },

    async logout() {
        sessionStorage.removeItem(window.APP_CONFIG.admin.sessionKey);
        await this.checkAuth();
        if (window.showToast) window.showToast('تم تسجيل الخروج', 'info');
    },

    // ==========================================
    // TABS
    // ==========================================
    initTabs() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabPanes = document.querySelectorAll('.tab-pane');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                tabBtns.forEach(b => b.classList.remove('active'));
                tabPanes.forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const pane = document.getElementById('tab-' + targetTab);
                if (pane) pane.classList.add('active');
            });
        });
    },

    // ==========================================
    // LOAD DASHBOARD
    // ==========================================
    async loadDashboardData() {
        try {
            this.health = window.SupabaseAdapter ? await window.SupabaseAdapter.healthCheck() : null;
        } catch (e) {
            this.health = { state: 'offline', tables: {}, missing: [], keyError: false };
        }

        this.updateSupabaseStatusBadge();
        this.renderDatabaseNotice();

        await this.loadIntroVideoSettings();
        await this.loadProjectsList();
        await this.loadReviewsList();
    },

    updateSupabaseStatusBadge() {
        const badge = document.getElementById('connection-status-badge');
        if (!badge) return;

        const state = (this.health && this.health.state) || 'offline';
        const dot = (color) => `<span class="status-dot" style="background:${color};box-shadow:0 0 6px ${color};"></span>`;

        if (state === 'ok') {
            badge.innerHTML = dot('#B9E1B8') + ' متصل بقاعدة Supabase';
            badge.style.color = '#B9E1B8';
            badge.style.borderColor = 'rgba(185,225,184,0.45)';
        } else if (state === 'missing-tables' || state === 'partial') {
            badge.innerHTML = dot('#FFC46B') + ' متصل - الجداول غير جاهزة';
            badge.style.color = '#FFC46B';
            badge.style.borderColor = 'rgba(255,196,107,0.45)';
        } else if (state === 'key-error') {
            badge.innerHTML = dot('#FF8A8A') + ' مفتاح الربط مرفوض';
            badge.style.color = '#FF8A8A';
            badge.style.borderColor = 'rgba(255,138,138,0.45)';
        } else {
            badge.innerHTML = dot('#FFC46B') + ' تخزين محلي للمتصفح (نشط)';
            badge.style.color = '#FFC46B';
            badge.style.borderColor = 'rgba(255,196,107,0.45)';
        }
    },

    renderDatabaseNotice() {
        const box = document.getElementById('supabase-notice');
        if (!box) return;

        const state = (this.health && this.health.state) || 'offline';

        // كل شيء يعمل → نخفي التنبيه تمامًا
        if (state === 'ok') {
            box.style.display = 'none';
            box.innerHTML = '';
            return;
        }

        const messages = {
            'missing-tables': {
                icon: '⚠️',
                tone: 'warn',
                title: 'جداول قاعدة البيانات غير موجودة بعد',
                text: 'الاتصال بـ Supabase ناجح، لكن الجداول المطلوبة لم يتم إنشاؤها بعد. حتى الآن تُحفظ كل التعديلات في متصفحك الحالي (لن تظهر لزوار الموقع). نفّذ أوامر SQL التالية مرة واحدة فقط ثم اضغط "إعادة فحص الاتصال".'
            },
            'partial': {
                icon: '⚠️',
                tone: 'warn',
                title: 'بعض الجداول غير موجودة',
                text: 'الاتصال ناجح وبعض الجداول تعمل، لكن الجداول الناقصة يجب إنشاؤها. نفّذ أمر SQL التالي ثم اضغط "إعادة فحص الاتصال".'
            },
            'key-error': {
                icon: '🔑',
                tone: 'error',
                title: 'مفتاح الربط (API Key) مرفوض',
                text: 'تم رفض مفتاح الربط من Supabase، لذلك يتم الحفظ محليًا. تأكد من صحة المفتاح داخل js/config.js.'
            },
            'offline': {
                icon: '📡',
                tone: 'error',
                title: 'لا يوجد اتصال بـ Supabase حاليًا',
                text: 'تعذر الوصول إلى خادم Supabase (قد يكون بسبب الشبكة أو حجب الطلبات). يتم الحفظ حاليًا في متصفحك حتى يعود الاتصال.'
            },
            'unconfigured': {
                icon: '⚙️',
                tone: 'warn',
                title: 'بيانات الربط غير مكتملة',
                text: 'أكمل بيانات Supabase (url و anonKey) داخل js/config.js لتفعيل الحفظ السحابي.'
            }
        };

        const info = messages[state] || messages['offline'];
        const showSql = (state === 'missing-tables' || state === 'partial');

        box.className = 'notice-box notice-' + info.tone;
        box.style.display = 'flex';
        box.innerHTML = `
            <div class="notice-icon">${info.icon}</div>
            <div class="notice-body">
                <h4 class="notice-title">${info.title}</h4>
                <p class="notice-text">${info.text}</p>
                <div class="notice-actions">
                    ${showSql ? '<button class="btn-admin-primary" onclick="AdminApp.copySetupSql()">📋 نسخ أوامر SQL</button>' : ''}
                    <button class="btn-admin-secondary" onclick="AdminApp.retryConnection()">🔄 إعادة فحص الاتصال</button>
                </div>
                ${showSql ? `<textarea class="sql-box" id="setup-sql-box" readonly spellcheck="false">${this.escapeHtml(this.SETUP_SQL)}</textarea>` : ''}
            </div>
        `;
    },

    copySetupSql() {
        const sql = this.SETUP_SQL;
        const done = () => {
            if (window.showToast) window.showToast('تم نسخ أوامر SQL — الصقها في Supabase SQL Editor ثم اضغط Run', 'success', 6000);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(sql).then(done).catch(() => this.fallbackCopySql(sql, done));
        } else {
            this.fallbackCopySql(sql, done);
        }
    },

    fallbackCopySql(sql, done) {
        const box = document.getElementById('setup-sql-box');
        if (box) {
            box.removeAttribute('readonly');
            box.focus();
            box.select();
            box.setSelectionRange(0, sql.length);
            try {
                document.execCommand('copy');
                done();
            } catch (e) {
                if (window.showToast) window.showToast('تعذر النسخ تلقائيًا — انسخ النص من الصندوق يدويًا', 'error');
            }
            box.setAttribute('readonly', 'readonly');
        }
    },

    async retryConnection() {
        if (window.SupabaseAdapter) {
            window.SupabaseAdapter.isInitialized = false;
            window.SupabaseAdapter.init();
        }
        if (window.showToast) window.showToast('جاري إعادة فحص الاتصال بقاعدة البيانات...', 'info', 2000);
        await this.loadDashboardData();
        if (window.showToast) window.showToast('انتهى الفحص — راجع شريط الحالة أعلى الصفحة', 'success');
    },

    async pushLocalDataToCloud() {
        if (!window.DataService) return;
        if (!window.DataService.isCloud()) {
            if (window.showToast) window.showToast('لا يوجد اتصال بـ Supabase لرفع البيانات', 'error');
            return;
        }
        if (window.showToast) window.showToast('جاري رفع البيانات المحلية إلى Supabase...', 'info', 2500);
        const res = await window.DataService.pushLocalToCloud();
        await this.loadDashboardData();
        if (window.showToast) {
            window.showToast('تم رفع ' + (res.count || 0) + ' عنصر إلى قاعدة البيانات بنجاح', 'success');
        }
    },

    // ==========================================
    // INTRO VIDEO
    // ==========================================
    async loadIntroVideoSettings() {
        const intro = await window.DataService.getIntroVideo();
        const input = document.getElementById('intro-youtube-url');
        const previewBox = document.getElementById('intro-video-preview');
        const hint = document.getElementById('intro-source-hint');

        this.selectedIntroCoverFile = null;
        this.selectedIntroCoverDataUrl = null;
        this.removeIntroCover = false;
        this.currentIntroCoverUrl = (intro && intro.coverImageUrl) || '';
        this.introCoverWidth = (intro && intro.coverWidth) || 0;
        this.introCoverHeight = (intro && intro.coverHeight) || 0;
        this.setOrientationValue('intro-orientation', (intro && intro.orientation) || 'auto');

        if (input && intro && intro.youtubeUrl) {
            input.value = intro.youtubeUrl;
        }
        this.renderCoverPreview('intro-cover-preview', 'intro-cover-remove', this.currentIntroCoverUrl);
        this.refreshIntroPreview();

        if (hint) {
            hint.textContent = window.DataService.lastLoadSource === 'cloud'
                ? 'مصدر البيانات الحالي: Supabase (سحابي)'
                : 'مصدر البيانات الحالي: تخزين متصفحك';
        }

        if (input) {
            input.oninput = () => this.refreshIntroPreview();
        }
    },

    refreshIntroPreview() {
        const input = document.getElementById('intro-youtube-url');
        const cover = this.selectedIntroCoverDataUrl || (!this.removeIntroCover ? this.currentIntroCoverUrl : '');
        this.updateVideoPreview(
            document.getElementById('intro-video-preview'),
            input ? input.value.trim() : '',
            cover,
            this.getResolvedOrientation('intro-orientation', input ? input.value.trim() : '', this.introCoverWidth, this.introCoverHeight)
        );
    },

    handleIntroCoverSelect(input) {
        const file = this.readImageFile(input);
        if (!file) return;
        this.selectedIntroCoverFile = file;
        this.removeIntroCover = false;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.selectedIntroCoverDataUrl = e.target.result;
            this.captureImageSize(e.target.result, (w, h) => {
                this.introCoverWidth = w;
                this.introCoverHeight = h;
                this.renderCoverPreview('intro-cover-preview', 'intro-cover-remove', e.target.result, file);
                this.refreshIntroPreview();
            });
        };
        reader.readAsDataURL(file);
    },

    clearIntroCover() {
        this.selectedIntroCoverFile = null;
        this.selectedIntroCoverDataUrl = null;
        this.removeIntroCover = true;
        const fileInput = document.getElementById('intro-cover-input');
        if (fileInput) fileInput.value = '';
        this.introCoverWidth = 0;
        this.introCoverHeight = 0;
        this.renderCoverPreview('intro-cover-preview', 'intro-cover-remove', '');
        this.refreshIntroPreview();
    },

    async saveIntroVideo() {
        const input = document.getElementById('intro-youtube-url');
        const url = input ? input.value.trim() : '';

        if (!url) {
            if (window.showToast) window.showToast('يرجى إدخال رابط يوتيوب أولًا', 'error');
            return;
        }

        const videoId = window.YouTubeService ? window.YouTubeService.extractVideoId(url) : null;
        if (!videoId) {
            if (window.showToast) window.showToast('رابط يوتيوب غير صالح — تأكد من نسخ الرابط كاملًا', 'error');
            return;
        }

        try {
            if (window.showToast) window.showToast('جاري حفظ فيديو المقدمة...', 'info', 1800);
            await window.DataService.updateIntroVideo(url, 'فيديو المقدمة والشواريل', {
                file: this.selectedIntroCoverFile,
                coverImageUrl: this.selectedIntroCoverDataUrl || this.currentIntroCoverUrl,
                removeCover: this.removeIntroCover,
                orientation: this.getOrientationValue('intro-orientation'),
                coverWidth: this.introCoverWidth,
                coverHeight: this.introCoverHeight
            });
            const cloud = window.DataService.lastPersistMode === 'cloud';
            if (window.showToast) {
                window.showToast(
                    cloud ? 'تم حفظ فيديو المقدمة والغلاف في Supabase' : 'تم حفظ فيديو المقدمة والغلاف محليًا في متصفحك',
                    'success'
                );
            }
            await this.loadIntroVideoSettings();
        } catch (err) {
            if (window.showToast) window.showToast('حدث خطأ أثناء الحفظ: ' + err.message, 'error');
        }
    },

    getOrientationValue(name) {
        const selected = document.querySelector('input[name="' + name + '"]:checked');
        return selected ? selected.value : 'auto';
    },

    setOrientationValue(name, value) {
        const radios = document.querySelectorAll('input[name="' + name + '"]');
        let matched = false;
        radios.forEach((radio) => {
            radio.checked = radio.value === value;
            if (radio.checked) matched = true;
        });
        if (!matched && radios[0]) radios[0].checked = true;
    },

    getResolvedOrientation(radioName, youtubeUrl, coverWidth, coverHeight) {
        const choice = radioName ? this.getOrientationValue(radioName) : 'auto';
        if (!window.YouTubeService) return choice === 'portrait' ? 'portrait' : 'landscape';
        return window.YouTubeService.resolveOrientation({
            youtubeUrl: youtubeUrl,
            orientation: choice,
            coverWidth: coverWidth,
            coverHeight: coverHeight
        });
    },

    captureImageSize(src, callback) {
        if (!src) {
            callback(0, 0);
            return;
        }
        const img = new Image();
        img.onload = () => callback(img.naturalWidth, img.naturalHeight);
        img.onerror = () => callback(0, 0);
        img.src = src;
    },

    updateVideoPreview(container, url, coverUrl, orientation) {
        if (!container) return;
        const videoId = window.YouTubeService ? window.YouTubeService.extractVideoId(url) : null;
        const cover = coverUrl || '';
        const resolved = orientation || this.getResolvedOrientation('', url, 0, 0);
        container.classList.toggle('is-portrait', resolved === 'portrait');
        container.classList.toggle('is-landscape', resolved !== 'portrait');

        if (videoId || cover) {
            const thumb = cover || (videoId ? window.YouTubeService.getThumbnailUrl(videoId) : '');
            const chip = cover
                ? 'غلاف مخصص جاهز'
                : (videoId ? 'معاينة جاهزة: ' + videoId : 'غلاف الفيديو');
            container.innerHTML = `
                <img src="${thumb}" alt="معاينة الفيديو" style="width:100%;height:100%;object-fit:cover;">
                <div style="position:absolute;inset:0;background:rgba(0,0,0,0.28);display:flex;align-items:center;justify-content:center;">
                    <span class="preview-chip">${this.escapeHtml(chip)}</span>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--color-text-dim);background:#0d100d;padding:1rem;text-align:center;">
                    <span style="font-size:0.88rem;">أدخل رابط يوتيوب لمعاينة الفيديو</span>
                </div>
            `;
        }
    },

    readImageFile(input) {
        const file = input && input.files && input.files[0];
        if (!file) return null;
        if (!file.type.startsWith('image/')) {
            if (window.showToast) window.showToast('يرجى اختيار ملف صورة صالح (PNG / JPG / WEBP)', 'error');
            input.value = '';
            return null;
        }
        return file;
    },

    renderCoverPreview(previewId, removeBtnId, src, file) {
        const previewBox = document.getElementById(previewId);
        const removeBtn = document.getElementById(removeBtnId);
        if (!previewBox) return;

        if (!src) {
            previewBox.style.display = 'none';
            previewBox.innerHTML = '';
            if (removeBtn) removeBtn.style.display = 'none';
            return;
        }

        const meta = file
            ? `تم اختيار: ${this.escapeHtml(file.name)} — ${(file.size / 1024).toFixed(0)} كيلوبايت`
            : 'غلاف محفوظ حاليًا — سيظهر في الموقع بدل صورة يوتيوب';

        previewBox.style.display = 'block';
        previewBox.innerHTML = `
            <img src="${src}" alt="معاينة غلاف الفيديو">
            <div style="padding:0.6rem 0.85rem;font-size:0.82rem;color:var(--color-text-muted);background:#141A14;">${meta}</div>
        `;
        if (removeBtn) removeBtn.style.display = 'inline-flex';
    },

    // ==========================================
    // PORTFOLIO PROJECTS
    // ==========================================
    async loadProjectsList() {
        const grid = document.getElementById('admin-projects-grid');
        if (!grid) return;

        const projects = await window.DataService.getProjects();

        const hint = document.getElementById('projects-source-hint');
        if (hint) {
            hint.textContent = window.DataService.lastLoadSource === 'cloud'
                ? 'عدد المشاريع: ' + projects.length + ' — مصدر البيانات: Supabase'
                : 'عدد المشاريع: ' + projects.length + ' — مصدر البيانات: تخزين المتصفح';
        }

        if (!projects || projects.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">🎬</div>
                    <h3 class="empty-state-title">لا توجد أعمال مضافة حاليًا</h3>
                    <p>اضغط على زر "إضافة فيديو جديد" لإضافة أول عمل في البورتفوليو.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = '';

        projects.forEach((proj, idx) => {
            const card = document.createElement('div');
            const orientation = window.YouTubeService
                ? window.YouTubeService.resolveOrientation(proj)
                : 'landscape';
            card.className = 'admin-card' + (orientation === 'portrait' ? ' is-portrait' : '');
            const videoId = proj.videoId || (window.YouTubeService ? window.YouTubeService.extractVideoId(proj.youtubeUrl) : null);
            const thumb = proj.coverImageUrl || (videoId ? window.YouTubeService.getThumbnailUrl(videoId) : '');

            card.innerHTML = `
                <div class="admin-card-preview">
                    ${thumb
                        ? `<img src="${thumb}" alt="${this.escapeHtml(proj.title)}" loading="lazy">`
                        : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--color-text-dim);">لا يوجد فيديو</div>`}
                </div>
                <div class="admin-card-body">
                    <div>
                        <div class="card-order-tag">ترتيب العرض: #${idx + 1}</div>
                        <h4 class="admin-card-title">${this.escapeHtml(proj.title)}</h4>
                        <p class="admin-card-desc">${this.escapeHtml(proj.description)}</p>
                    </div>
                    <div class="admin-card-actions">
                        <div class="order-actions">
                            <button class="btn-icon-action" title="تحريك لأعلى" aria-label="تحريك لأعلى" onclick="AdminApp.moveProject('${proj.id}', 'up')" ${idx === 0 ? 'disabled' : ''}>▲</button>
                            <button class="btn-icon-action" title="تحريك لأسفل" aria-label="تحريك لأسفل" onclick="AdminApp.moveProject('${proj.id}', 'down')" ${idx === projects.length - 1 ? 'disabled' : ''}>▼</button>
                        </div>
                        <div style="display:flex;gap:0.4rem;">
                            <button class="btn-icon-action" title="تعديل المشروع" aria-label="تعديل المشروع" onclick="AdminApp.openEditProjectModal('${proj.id}')">✏️</button>
                            <button class="btn-icon-action btn-delete" title="حذف المشروع" aria-label="حذف المشروع" onclick="AdminApp.confirmDelete('${proj.id}', 'project')">🗑️</button>
                        </div>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    },

    resetProjectCoverState() {
        this.selectedProjectCoverFile = null;
        this.selectedProjectCoverDataUrl = null;
        this.currentProjectCoverUrl = '';
        this.removeProjectCover = false;
        const fileInput = document.getElementById('project-cover-input');
        if (fileInput) fileInput.value = '';
        this.projectCoverWidth = 0;
        this.projectCoverHeight = 0;
        this.setOrientationValue('project-orientation', 'auto');
        this.renderCoverPreview('project-cover-preview', 'project-cover-remove', '');
    },

    handleProjectCoverSelect(input) {
        const file = this.readImageFile(input);
        if (!file) return;
        this.selectedProjectCoverFile = file;
        this.removeProjectCover = false;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.selectedProjectCoverDataUrl = e.target.result;
            this.captureImageSize(e.target.result, (w, h) => {
                this.projectCoverWidth = w;
                this.projectCoverHeight = h;
                this.renderCoverPreview('project-cover-preview', 'project-cover-remove', e.target.result, file);
                this.refreshProjectPreview();
            });
        };
        reader.readAsDataURL(file);
    },

    clearProjectCover() {
        this.selectedProjectCoverFile = null;
        this.selectedProjectCoverDataUrl = null;
        this.removeProjectCover = true;
        this.projectCoverWidth = 0;
        this.projectCoverHeight = 0;
        const fileInput = document.getElementById('project-cover-input');
        if (fileInput) fileInput.value = '';
        this.renderCoverPreview('project-cover-preview', 'project-cover-remove', '');
        this.refreshProjectPreview();
    },

    refreshProjectPreview() {
        const url = document.getElementById('project-form-url') ? document.getElementById('project-form-url').value.trim() : '';
        const cover = this.selectedProjectCoverDataUrl || (!this.removeProjectCover ? this.currentProjectCoverUrl : '');
        this.updateVideoPreview(
            document.getElementById('project-modal-preview'),
            url,
            cover,
            this.getResolvedOrientation('project-orientation', url, this.projectCoverWidth, this.projectCoverHeight)
        );
    },

    openAddProjectModal() {
        this.editingProjectId = null;
        document.getElementById('project-modal-title').textContent = 'إضافة عمل جديد للبورتفوليو';
        document.getElementById('project-form-title').value = '';
        document.getElementById('project-form-desc').value = '';
        document.getElementById('project-form-url').value = '';
        this.resetProjectCoverState();
        this.refreshProjectPreview();
        this.openModal('project-modal');
        setTimeout(() => document.getElementById('project-form-title').focus(), 200);
    },

    async openEditProjectModal(id) {
        this.editingProjectId = id;
        const projects = await window.DataService.getProjects();
        const proj = projects.find(p => String(p.id) === String(id));
        if (!proj) return;

        document.getElementById('project-modal-title').textContent = 'تعديل بيانات المشروع';
        document.getElementById('project-form-title').value = proj.title || '';
        document.getElementById('project-form-desc').value = proj.description || '';
        document.getElementById('project-form-url').value = proj.youtubeUrl || '';
        this.resetProjectCoverState();
        this.currentProjectCoverUrl = proj.coverImageUrl || '';
        this.projectCoverWidth = proj.coverWidth || 0;
        this.projectCoverHeight = proj.coverHeight || 0;
        this.setOrientationValue('project-orientation', proj.orientation || 'auto');
        this.renderCoverPreview('project-cover-preview', 'project-cover-remove', this.currentProjectCoverUrl);
        this.refreshProjectPreview();
        this.openModal('project-modal');
    },

    async saveProjectForm() {
        const title = document.getElementById('project-form-title').value.trim();
        const description = document.getElementById('project-form-desc').value.trim();
        const youtubeUrl = document.getElementById('project-form-url').value.trim();

        if (!title) {
            if (window.showToast) window.showToast('يرجى كتابة عنوان المشروع', 'error');
            return;
        }
        if (!youtubeUrl) {
            if (window.showToast) window.showToast('يرجى إدخال رابط يوتيوب الخاص بالفيديو', 'error');
            return;
        }

        const videoId = window.YouTubeService ? window.YouTubeService.extractVideoId(youtubeUrl) : null;
        if (!videoId) {
            if (window.showToast) window.showToast('رابط يوتيوب غير صحيح — يدعم watch / youtu.be / shorts', 'error');
            return;
        }

        try {
            if (window.showToast) window.showToast('جاري حفظ المشروع والغلاف...', 'info', 1800);
            const coverPayload = {
                title,
                description,
                youtubeUrl,
                coverFile: this.selectedProjectCoverFile,
                coverImageUrl: this.selectedProjectCoverDataUrl || this.currentProjectCoverUrl,
                removeCover: this.removeProjectCover,
                orientation: this.getOrientationValue('project-orientation'),
                coverWidth: this.projectCoverWidth || 0,
                coverHeight: this.projectCoverHeight || 0
            };

            if (this.editingProjectId) {
                await window.DataService.updateProject(this.editingProjectId, coverPayload);
            } else {
                await window.DataService.addProject(coverPayload);
            }

            const cloud = window.DataService.lastPersistMode === 'cloud';

            // إغلاق المودال وتحديث القائمة أولًا (كان هذا الجزء لا يصل إليه الكود سابقًا)
            this.closeModal('project-modal');
            this.editingProjectId = null;
            this.resetProjectCoverState();
            await this.loadProjectsList();
            this.updateSupabaseStatusBadge();

            if (window.showToast) {
                window.showToast(
                    cloud
                        ? 'تم حفظ المشروع في Supabase وظهر مباشرة في الموقع'
                        : 'تم حفظ المشروع محليًا في متصفحك (راجع تنبيه قاعدة البيانات لتشغيل SQL)',
                    'success',
                    6000
                );
            }
        } catch (err) {
            console.error(err);
            if (window.showToast) window.showToast('تعذر حفظ المشروع: ' + err.message, 'error');
        }
    },

    async moveProject(id, direction) {
        await window.DataService.reorderProjects(id, direction);
        await this.loadProjectsList();
    },

    // ==========================================
    // CUSTOMER REVIEWS
    // ==========================================
    async loadReviewsList() {
        const grid = document.getElementById('admin-reviews-grid');
        if (!grid) return;

        const reviews = await window.DataService.getReviews();

        const hint = document.getElementById('reviews-source-hint');
        if (hint) {
            hint.textContent = window.DataService.lastLoadSource === 'cloud'
                ? 'عدد الآراء: ' + reviews.length + ' — مصدر البيانات: Supabase'
                : 'عدد الآراء: ' + reviews.length + ' — مصدر البيانات: تخزين المتصفح';
        }

        if (!reviews || reviews.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">💬</div>
                    <h3 class="empty-state-title">لا توجد آراء مضافة</h3>
                    <p>اضغط على "إضافة رأي عميل" لرفع لقطات شاشة المحادثات.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = '';

        reviews.forEach((rev, idx) => {
            const card = document.createElement('div');
            card.className = 'admin-review-card';
            card.innerHTML = `
                <div class="admin-review-thumb">
                    <img src="${rev.imageUrl}" alt="رأي ${this.escapeHtml(rev.clientName)}" loading="lazy">
                </div>
                <div style="padding:1rem;">
                    <div class="card-order-tag">ترتيب العرض: #${idx + 1}</div>
                    <h5 class="admin-card-title" style="font-size:1rem;">${this.escapeHtml(rev.clientName || 'عميل')}</h5>
                    <div class="admin-card-actions" style="padding-top:0.6rem;margin-top:0.6rem;">
                        <div class="order-actions">
                            <button class="btn-icon-action" title="تحريك لأعلى" aria-label="تحريك لأعلى" onclick="AdminApp.moveReview('${rev.id}', 'up')" ${idx === 0 ? 'disabled' : ''}>▲</button>
                            <button class="btn-icon-action" title="تحريك لأسفل" aria-label="تحريك لأسفل" onclick="AdminApp.moveReview('${rev.id}', 'down')" ${idx === reviews.length - 1 ? 'disabled' : ''}>▼</button>
                        </div>
                        <button class="btn-icon-action btn-delete" title="حذف الرأي" aria-label="حذف الرأي" onclick="AdminApp.confirmDelete('${rev.id}', 'review')">🗑️</button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    },

    openAddReviewModal() {
        document.getElementById('review-form-name').value = '';
        document.getElementById('review-form-url').value = '';
        document.getElementById('review-file-input').value = '';
        const previewBox = document.getElementById('review-upload-preview');
        previewBox.style.display = 'none';
        previewBox.innerHTML = '';
        this.selectedReviewFile = null;
        this.selectedImageDataUrl = null;
        this.openModal('review-modal');
    },

    handleReviewFileSelect(input) {
        const file = input.files && input.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            if (window.showToast) window.showToast('يرجى اختيار ملف صورة صالح (PNG / JPG / WEBP)', 'error');
            input.value = '';
            return;
        }

        this.selectedReviewFile = file;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.selectedImageDataUrl = e.target.result;
            const previewBox = document.getElementById('review-upload-preview');
            previewBox.style.display = 'block';
            previewBox.innerHTML = `
                <img src="${e.target.result}" alt="معاينة الصورة المختارة">
                <div style="padding:0.6rem 0.85rem;font-size:0.82rem;color:var(--color-text-muted);background:#141A14;">
                    تم اختيار: ${this.escapeHtml(file.name)} — ${(file.size / 1024).toFixed(0)} كيلوبايت
                </div>
            `;
        };
        reader.onerror = () => {
            if (window.showToast) window.showToast('تعذر قراءة ملف الصورة، حاول مرة أخرى', 'error');
        };
        reader.readAsDataURL(file);
    },

    async saveReviewForm() {
        const clientName = document.getElementById('review-form-name').value.trim() || 'محادثة واتساب مع عميل';
        const urlInput = document.getElementById('review-form-url').value.trim();
        const imageUrl = urlInput || this.selectedImageDataUrl;

        if (!imageUrl && !this.selectedReviewFile) {
            if (window.showToast) window.showToast('يرجى اختيار صورة من جهازك أو إدخال رابط صورة مباشر', 'error');
            return;
        }

        try {
            if (window.showToast) window.showToast('جاري حفظ رأي العميل...', 'info', 1800);

            await window.DataService.addReview({ imageUrl: imageUrl || '', clientName: clientName }, this.selectedReviewFile);

            const cloud = window.DataService.lastPersistMode === 'cloud';
            this.closeModal('review-modal');
            await this.loadReviewsList();
            this.updateSupabaseStatusBadge();

            if (window.showToast) {
                window.showToast(
                    cloud
                        ? 'تم إضافة رأي العميل إلى Supabase بنجاح'
                        : 'تم إضافة رأي العميل محليًا في متصفحك (راجع تنبيه قاعدة البيانات)',
                    'success',
                    6000
                );
            }
        } catch (err) {
            console.error(err);
            if (window.showToast) window.showToast('تعذر حفظ رأي العميل: ' + err.message, 'error');
        }
    },

    async moveReview(id, direction) {
        await window.DataService.reorderReviews(id, direction);
        await this.loadReviewsList();
    },

    // ==========================================
    // DELETE CONFIRMATION
    // ==========================================
    confirmDelete(id, type) {
        this.currentDeletingId = id;
        this.currentDeletingType = type;
        const textEl = document.getElementById('delete-modal-msg');
        if (textEl) {
            textEl.textContent = type === 'project'
                ? 'هل أنت متأكد من حذف هذا المشروع من البورتفوليو؟ لا يمكن التراجع عن هذا الإجراء.'
                : 'هل أنت متأكد من حذف رأي العميل هذا؟ سيتم حذف الصورة المرتبطة به أيضًا.';
        }
        this.openModal('delete-confirm-modal');
    },

    async executeDelete() {
        if (!this.currentDeletingId || !this.currentDeletingType) return;

        try {
            if (this.currentDeletingType === 'project') {
                await window.DataService.deleteProject(this.currentDeletingId);
                this.closeModal('delete-confirm-modal');
                this.currentDeletingId = null;
                this.currentDeletingType = null;
                await this.loadProjectsList();
                if (window.showToast) window.showToast('تم حذف المشروع بنجاح', 'success');
            } else if (this.currentDeletingType === 'review') {
                await window.DataService.deleteReview(this.currentDeletingId);
                this.closeModal('delete-confirm-modal');
                this.currentDeletingId = null;
                this.currentDeletingType = null;
                await this.loadReviewsList();
                if (window.showToast) window.showToast('تم حذف رأي العميل بنجاح', 'success');
            }
        } catch (err) {
            console.error(err);
            this.closeModal('delete-confirm-modal');
            if (window.showToast) window.showToast('تعذر إتمام الحذف: ' + err.message, 'error');
        }
    },

    // ==========================================
    // MODAL HELPERS
    // ==========================================
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    bindGlobalEvents() {
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                    modal.classList.remove('active');
                });
                document.body.style.overflow = '';
            }
        });
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

window.AdminApp = AdminApp;

document.addEventListener('DOMContentLoaded', () => {
    AdminApp.init();
});
