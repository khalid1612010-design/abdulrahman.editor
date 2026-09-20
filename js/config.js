/**
 * ============================================================================
 * ABDULRAHMAN PORTFOLIO CONFIGURATION
 * ============================================================================
 * Contains default settings, Supabase connection placeholders, WhatsApp config,
 * and default portfolio/review seed data.
 */

const APP_CONFIG = {
    // WhatsApp Configuration
    // International format without '+' sign for wa.me link
    whatsapp: {
        number: '201021407272',
        displayNumber: '+20 10 21407272',
        recipientName: 'عبدالرحمن',
        defaultMessagePrefix: 'مرحبًا عبدالرحمن،\n\nأريد بدء مشروع جديد.\n\n'
    },

    social: {
        youtube: 'https://www.youtube.com/@abdelrahmaneditor',
        instagram: 'https://www.instagram.com/abdulrahman.editor'
    },

    // Supabase Configuration
    // Filled with the provided project credentials. Uses ONLY the anon public key
    // (safe for frontend). Never place a service_role / secret key in client code.
    supabase: {
        url: 'https://pjxhovdoijymivxdkxgj.supabase.co',
        // Anon Public JWT key (safe for browser use, protected by RLS)
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeGhvdmRvaWp5bWl2eGRreGdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MDQ5OTgsImV4cCI6MjEwNTM4MDk5OH0.lzv33Og1MSRCbScUk25yNh37v36RRugaFLsGTgqpJwo',
        // Newer Publishable Key format (also accepted by supabase-js v2)
        publishableKey: 'sb_publishable_eTs_CZfKuP5CbdRiLX-FfQ_hIElJxp7',
        storageBucket: 'customer-reviews'
    },

    // Admin Credentials
    // Default password as requested: 16201
    admin: {
        // SHA-256 hash of "16201" for secure client-side comparison when offline
        // (e74f83b1bf80155b41297e687b1c1e5509930fca6834125d04595e865768cf18)
        passwordHash: 'e74f83b1bf80155b41297e687b1c1e5509930fca6834125d04595e865768cf18',
        defaultRawPassword: '16201',
        sessionKey: 'abdulrahman_admin_auth_token'
    },

    // Initial Seed Data (Used on first load or database initialization)
    defaults: {
        // High quality cinematic showreel video for intro
        introVideo: {
            youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // default placeholder
            title: 'فيديو المقدمة والشواريل'
        },

        // Projects as specified in the exact project requirements
        projects: [
            {
                id: 'proj-1',
                title: 'مش مجرد مشاريع اشتغلنا عليها',
                description: 'بل تجارب علمتنا ازاي نشوف الفيديو بشكل مختلف',
                youtubeUrl: 'https://www.youtube.com/watch?v=ScMzIvxBSi4',
                sortOrder: 1
            },
            {
                id: 'proj-2',
                title: 'مش مجرد مشاريع اشتغلنا عليها',
                description: 'بل تجارب علمتنا ازاي نشوف الفيديو بشكل مختلف',
                youtubeUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
                sortOrder: 2
            },
            {
                id: 'proj-3',
                title: 'اعرض خدمتك باسلوب مميز',
                description: 'واظهر بأفضل شكل قدام عميلك',
                youtubeUrl: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
                sortOrder: 3
            },
            {
                id: 'proj-4',
                title: 'اعرض خدمتك باسلوب مميز',
                description: 'واظهر بأفضل شكل قدام عميلك',
                youtubeUrl: 'https://www.youtube.com/watch?v=L_LUpnjgPso',
                sortOrder: 4
            },
            {
                id: 'proj-5',
                title: 'مونتاج يخلي محتواك\nاوضح، أقوى، أكثر احترافية.',
                description: 'صناعة إيقاع بصري يجذب المشاهد من الثانية الأولى حتى النهاية.',
                youtubeUrl: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
                sortOrder: 5
            },
            {
                id: 'proj-6',
                title: 'مونتاج يخلي محتواك\nاوضح، أقوى، أكثر احترافية.',
                description: 'تصميم صوتي وتعديل ألوان يرفع قيمة علامتك التجارية لأعلى مستوى.',
                youtubeUrl: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
                sortOrder: 6
            }
        ],

        // High quality WhatsApp review screenshots / testimonials
        reviews: [
            {
                id: 'rev-1',
                imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
                clientName: 'أحمد الشريف - صانع محتوى',
                commentText: 'شغل أسطوري يا عبدالرحمن! الريلز جابت أكثر من 2 مليون مشاهدة بعد التعديل الأخير والإيقاع كان ممتاز جداً.',
                sortOrder: 1
            },
            {
                id: 'rev-2',
                imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
                clientName: 'م. سارة المهدي - مديرة تسويق',
                commentText: 'تسليم في الموعد وجودة غير طبيعية في الكولور جريدينج والساوند ديزاين. أكيد هنتعامل دايماً.',
                sortOrder: 2
            },
            {
                id: 'rev-3',
                imageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80',
                clientName: 'خالد المنصور - وكالة إعلانية',
                commentText: 'الفيديو الإعلاني طلع تحفة بصرية، العملاء أعجبوا بالنتيجة جداً وزادت المبيعات.',
                sortOrder: 3
            }
        ]
    }
};

// Export to global scope
window.APP_CONFIG = APP_CONFIG;
