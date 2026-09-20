/**
 * ============================================================================
 * SUPABASE CLIENT ADAPTER & STORAGE HANDLER
 * ============================================================================
 * Handles communication with Supabase Database (PostgreSQL) and Storage buckets.
 * Operates with RLS-compliant public anon client.
 */

const SupabaseAdapter = {
    client: null,
    isInitialized: false,

    // مفتاح الربط النشط: 'anon' (JWT قديم) أو 'publishable' (المفتاح الجديد)
    activeKeyMode: 'anon',

    /**
     * Initializes Supabase client if configuration is provided
     */
    init() {
        const config = window.APP_CONFIG?.supabase;

        if (!config || !config.url || !window.supabase) {
            this.isInitialized = false;
            return false;
        }

        // نستخدم المفتاح الذي أثبت نجاحه في آخر فحص (يُحفظ بين الصفحات)
        const preferPublishable = localStorage.getItem('abdulrahman_sb_key_mode') === 'publishable';

        let key = preferPublishable
            ? (config.publishableKey || config.anonKey)
            : (config.anonKey || config.publishableKey);

        if (!key) {
            this.isInitialized = false;
            return false;
        }

        try {
            this.client = window.supabase.createClient(config.url, key, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true
                }
            });
            this.isInitialized = true;
            this.activeKeyMode = preferPublishable ? 'publishable' : 'anon';
            console.log('✅ Supabase client ready (' + this.activeKeyMode + ' key).');
        } catch (err) {
            console.warn('⚠️ Could not initialize Supabase client:', err.message);
            this.isInitialized = false;
        }

        return this.isInitialized;
    },

    /**
     * فحص جدول واحد دون تنزيل بيانات (HEAD request)
     */
    async probeTable(tableName) {
        if (!this.isConnected()) return { ok: false, offline: true };
        try {
            // بدون head:true حتى يرجع PostgREST رسالة خطأ واضحة عند غياب الجدول
            const { error } = await this.client
                .from(tableName)
                .select('id')
                .limit(1);

            if (!error) return { ok: true };

            const signature = [error.code, error.message, error.details, error.hint]
                .filter(Boolean).join(' | ');

            if (/PGRST205|PGRST204|does not exist|Could not find the table|schema cache|404/i.test(signature)) {
                return { ok: false, missing: true, message: error.message };
            }
            if (/Invalid API key|JWT|Unauthorized|401|403|permission denied|invalid claim/i.test(signature)) {
                return { ok: false, keyError: true, message: error.message };
            }
            return { ok: false, message: error.message };
        } catch (err) {
            return { ok: false, networkError: true, message: err.message };
        }
    },

    async probeAll(tables) {
        const out = {};
        for (const t of tables) {
            out[t] = await this.probeTable(t);
        }
        return out;
    },

    /**
     * فحص شامل: صحة مفتاح الربط + وجود الجداول المطلوبة
     * @returns {Promise<{state:string, tables:Object, missing:string[], keyError:boolean}>}
     * states: ok | missing-tables | partial | key-error | offline | unconfigured
     */
    async healthCheck() {
        const config = window.APP_CONFIG?.supabase;
        const requiredTables = ['site_settings', 'portfolio_projects', 'customer_reviews'];

        if (!config || !config.url) return { state: 'unconfigured', tables: {}, missing: [], keyError: false };
        if (!this.isConnected()) return { state: 'offline', tables: {}, missing: [], keyError: false };

        let results = await this.probeAll(requiredTables);
        let keyError = requiredTables.some(t => results[t] && results[t].keyError);

        // لو رُفض المفتاح، نجرّب المفتاح البديل (الجديد أو JWT)
        if (keyError) {
            const alternateMode = this.activeKeyMode === 'publishable' ? 'anon' : 'publishable';
            const alternateKey = alternateMode === 'publishable' ? config.publishableKey : config.anonKey;

            if (alternateKey) {
                try {
                    this.client = window.supabase.createClient(config.url, alternateKey, {
                        auth: { persistSession: true, autoRefreshToken: true }
                    });
                    this.activeKeyMode = alternateMode;
                    results = await this.probeAll(requiredTables);
                    keyError = requiredTables.some(t => results[t] && results[t].keyError);
                    if (!keyError) {
                        localStorage.setItem('abdulrahman_sb_key_mode', alternateMode);
                        console.log('🔁 Switched to alternate Supabase key:', alternateMode);
                    }
                } catch (e) {
                    // نبقي الحالة كما هي
                }
            }
        }

        const missing = requiredTables.filter(t => results[t] && results[t].missing);
        const networkError = requiredTables.some(t => results[t] && results[t].networkError);

        let state = 'ok';
        if (keyError) state = 'key-error';
        else if (networkError) state = 'offline';
        else if (missing.length === requiredTables.length) state = 'missing-tables';
        else if (missing.length > 0) state = 'partial';

        this.health = { state: state, tables: results, missing: missing, keyError: keyError };
        return this.health;
    },

    /**
     * Checks if active Supabase connection is available
     */
    isConnected() {
        if (!this.isInitialized) {
            this.init();
        }
        return this.isInitialized && !!this.client;
    },

    // ==========================================
    // SITE SETTINGS
    // ==========================================
    async fetchSettings() {
        if (!this.isConnected()) return null;
        try {
            const { data, error } = await this.client
                .from('site_settings')
                .select('*')
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data;
        } catch (err) {
            console.error('Supabase fetchSettings error:', err.message);
            return null;
        }
    },

    async saveSettings(settings) {
        if (!this.isConnected()) return false;
        try {
            let payload = { id: 1, ...settings, updated_at: new Date().toISOString() };
            let { error } = await this.client.from('site_settings').upsert(payload);

            if (error && /intro_cover_image_url|intro_video_orientation|PGRST204|schema cache/i.test([error.code, error.message].filter(Boolean).join(' '))) {
                delete payload.intro_cover_image_url;
                delete payload.intro_video_orientation;
                const retry = await this.client.from('site_settings').upsert(payload);
                error = retry.error;
            }

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Supabase saveSettings error:', err.message);
            return false;
        }
    },

    // ==========================================
    // PORTFOLIO PROJECTS
    // ==========================================
    async fetchProjects() {
        if (!this.isConnected()) return null;
        try {
            const { data, error } = await this.client
                .from('portfolio_projects')
                .select('*')
                .order('sort_order', { ascending: true });

            if (error) throw error;
            return data.map(item => ({
                id: item.id,
                title: item.title,
                description: item.description,
                youtubeUrl: item.youtube_url,
                videoId: item.youtube_video_id,
                coverImageUrl: item.cover_image_url || '',
                orientation: item.orientation || 'auto',
                coverWidth: item.cover_width || 0,
                coverHeight: item.cover_height || 0,
                sortOrder: item.sort_order,
                createdAt: item.created_at
            }));
        } catch (err) {
            console.error('Supabase fetchProjects error:', err.message);
            return null;
        }
    },

    async insertProject(project) {
        if (!this.isConnected()) return null;
        const baseRow = {
            title: project.title,
            description: project.description,
            youtube_url: project.youtubeUrl,
            youtube_video_id: project.videoId || window.YouTubeService?.extractVideoId(project.youtubeUrl),
            sort_order: project.sortOrder || 1
        };
        const safeCover = (project.coverImageUrl && !String(project.coverImageUrl).startsWith('data:'))
            ? project.coverImageUrl
            : '';
        const withCover = {
            ...baseRow,
            cover_image_url: safeCover,
            orientation: project.orientation || 'auto',
            cover_width: project.coverWidth || 0,
            cover_height: project.coverHeight || 0
        };

        try {
            let { data, error } = await this.client
                .from('portfolio_projects')
                .insert([withCover])
                .select()
                .single();

            // عمود الغلاف غير موجود بعد → نعيد المحاولة بدونه
            if (error && /cover_image_url|orientation|cover_width|cover_height|PGRST204|schema cache/i.test([error.code, error.message, error.details, error.hint].filter(Boolean).join(' '))) {
                const retry = await this.client.from('portfolio_projects').insert([baseRow]).select().single();
                data = retry.data;
                error = retry.error;
            }

            if (error) throw error;
            return {
                id: data.id,
                title: data.title,
                description: data.description,
                youtubeUrl: data.youtube_url,
                videoId: data.youtube_video_id,
                coverImageUrl: data.cover_image_url || project.coverImageUrl || '',
                sortOrder: data.sort_order
            };
        } catch (err) {
            console.error('Supabase insertProject error:', err.message);
            return null;
        }
    },

    async updateProject(id, project) {
        if (!this.isConnected()) return false;
        try {
            const payload = {};
            if (project.title !== undefined) payload.title = project.title;
            if (project.description !== undefined) payload.description = project.description;
            if (project.youtubeUrl !== undefined) {
                payload.youtube_url = project.youtubeUrl;
                payload.youtube_video_id = window.YouTubeService?.extractVideoId(project.youtubeUrl);
            }
            if (project.sortOrder !== undefined) payload.sort_order = project.sortOrder;
            if (project.coverImageUrl !== undefined) {
                payload.cover_image_url = (project.coverImageUrl && !String(project.coverImageUrl).startsWith('data:'))
                    ? project.coverImageUrl
                    : '';
            }
            if (project.orientation !== undefined) payload.orientation = project.orientation || 'auto';
            if (project.coverWidth !== undefined) payload.cover_width = project.coverWidth || 0;
            if (project.coverHeight !== undefined) payload.cover_height = project.coverHeight || 0;

            let { error } = await this.client
                .from('portfolio_projects')
                .update(payload)
                .eq('id', id);

            if (error && /cover_image_url|orientation|cover_width|cover_height|PGRST204|schema cache/i.test([error.code, error.message].filter(Boolean).join(' '))) {
                delete payload.cover_image_url;
                delete payload.orientation;
                delete payload.cover_width;
                delete payload.cover_height;
                const retry = await this.client.from('portfolio_projects').update(payload).eq('id', id);
                error = retry.error;
            }

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Supabase updateProject error:', err.message);
            return false;
        }
    },

    async deleteProject(id, coverImageUrl) {
        if (!this.isConnected()) return false;
        try {
            if (coverImageUrl) await this.deleteStorageFile(coverImageUrl);
            const { error } = await this.client
                .from('portfolio_projects')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Supabase deleteProject error:', err.message);
            return false;
        }
    },

    // ==========================================
    // CUSTOMER REVIEWS
    // ==========================================
    async fetchReviews() {
        if (!this.isConnected()) return null;
        try {
            const { data, error } = await this.client
                .from('customer_reviews')
                .select('*')
                .order('sort_order', { ascending: true });

            if (error) throw error;
            return data.map(item => ({
                id: item.id,
                imageUrl: item.image_url,
                clientName: item.client_name,
                commentText: item.comment_text,
                sortOrder: item.sort_order,
                createdAt: item.created_at
            }));
        } catch (err) {
            console.error('Supabase fetchReviews error:', err.message);
            return null;
        }
    },

    async insertReview(review) {
        if (!this.isConnected()) return null;
        try {
            const { data, error } = await this.client
                .from('customer_reviews')
                .insert([{
                    image_url: review.imageUrl,
                    client_name: review.clientName || 'عميل مميز',
                    comment_text: review.commentText || '',
                    sort_order: review.sortOrder || 1
                }])
                .select()
                .single();

            if (error) throw error;
            return {
                id: data.id,
                imageUrl: data.image_url,
                clientName: data.client_name,
                commentText: data.comment_text,
                sortOrder: data.sort_order
            };
        } catch (err) {
            console.error('Supabase insertReview error:', err.message);
            return null;
        }
    },

    async updateReviewOrder(id, sortOrder) {
        if (!this.isConnected()) return false;
        try {
            const { error } = await this.client
                .from('customer_reviews')
                .update({ sort_order: sortOrder })
                .eq('id', id);
            if (error) throw error;
            return true;
        } catch (err) {
            console.warn('Supabase updateReviewOrder:', err.message);
            return false;
        }
    },

    async deleteReview(id, imageUrl) {
        if (!this.isConnected()) return false;
        try {
            if (imageUrl) await this.deleteStorageFile(imageUrl);

            const { error } = await this.client
                .from('customer_reviews')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Supabase deleteReview error:', err.message);
            return false;
        }
    },

    // ==========================================
    // STORAGE IMAGE UPLOAD
    // ==========================================
    async uploadReviewImage(file) {
        return this.uploadMedia(file, 'reviews');
    },

    async uploadCoverImage(file) {
        return this.uploadMedia(file, 'covers');
    },

    async uploadMedia(file, folder) {
        if (!this.isConnected() || !file) return null;
        try {
            const bucketName = window.APP_CONFIG.supabase.storageBucket || 'customer-reviews';
            const rawExt = (file.name && file.name.split('.').pop()) || 'jpg';
            const fileExt = String(rawExt).toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
            const prefix = folder ? `${folder}/` : '';
            const filePath = `${prefix}${folder || 'file'}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

            const { error: uploadError } = await this.client.storage
                .from(bucketName)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: file.type || 'image/jpeg'
                });

            if (uploadError) throw uploadError;

            const { data } = this.client.storage
                .from(bucketName)
                .getPublicUrl(filePath);

            return data.publicUrl;
        } catch (err) {
            console.error('Supabase uploadMedia error:', err.message);
            return null;
        }
    },

    async deleteStorageFile(publicUrl) {
        if (!this.isConnected() || !publicUrl) return false;
        try {
            const bucketName = window.APP_CONFIG.supabase.storageBucket || 'customer-reviews';
            if (!publicUrl.includes(bucketName)) return false;
            const parts = publicUrl.split(bucketName + '/');
            if (!parts[1]) return false;
            const filePath = decodeURIComponent(parts[1].split('?')[0]);
            await this.client.storage.from(bucketName).remove([filePath]);
            return true;
        } catch (err) {
            console.warn('Supabase deleteStorageFile:', err.message);
            return false;
        }
    }
};

window.SupabaseAdapter = SupabaseAdapter;
