# بورتفوليو مونتير فيديو — Abdulrahman | Video Editor

موقع بورتفوليو سينمائي (Dark / Minimal / Green Accent) مبني بـ **HTML5 + CSS3 + Vanilla JavaScript** مع **لوحة تحكم كاملة** وربط سحابي بـ **Supabase**.

---

## 🧩 هيكل الملفات

```text
├── index.html              # الموقع الرئيسي (من أنا / أعمالي / آراء العملاء / ابدأ مشروعك)
├── admin.html              # لوحة التحكم (فيديو المقدمة / المشاريع / آراء العملاء)
│
├── css/
│   ├── style.css           # الهوية البصرية، المتغيرات، الفونتات، الأنيميشن
│   ├── responsive.css      # التجاوب (Desktop / Laptop / Tablet / Mobile)
│   └── admin.css           # تنسيقات لوحة التحكم + بانر قاعدة البيانات
│
├── js/
│   ├── config.js           # الإعدادات: واتساب، Supabase، كلمة مرور الأدمن، البيانات الافتراضية
│   ├── toast.js            # نظام التنبيهات المشترك (مهم جدًا — يُحمّل في الصفحتين)
│   ├── youtube.js          # استخراج Video ID + المشغّل الخفيف (Facade lazy player)
│   ├── supabase.js         # عميل Supabase + Storage + فحص الجداول (healthCheck)
│   ├── dataService.js      # طبقة البيانات الموحدة (Cloud ↔ Local)
│   ├── particles.js        # خلفية النجوم المتحركة (Canvas)
│   ├── animations.js       # ظهور العناصر عند الـ Scroll (IntersectionObserver)
│   ├── whatsapp.js         # نموذج "ابدأ مشروعك" + توليد رسالة واتساب
│   ├── main.js             # منطق الموقع الرئيسي والـ Rendering
│   └── admin.js            # منطق لوحة التحكم + أوامر SQL الجاهزة
│
└── README.md
```

---

## ▶️ تشغيل المشروع

1. ضع مجلد المشروع على أي استضافة ثابتة (Netlify / Vercel / GitHub Pages / استضافة عادية).
2. افتح `index.html` للموقع الرئيسي، و `admin.html` للوحة التحكم.
3. للتجربة محليًا: استخدم Live Server (لتشغيله عبر `http://localhost` لأن بعض المتصفحات تقيّد بعض الـ APIs على `file://`).

---

## 🔁 الإصلاح المهم في هذه النسخة (سبب مشكلة عدم إضافة الفيديوهات)

**المشكلة:** كان `js/admin.js` يستدعي `window.showToast(...)` بدون حماية، بينما دوال التنبيه كانت معرّفة داخل `js/main.js` **وهو غير محمّل في `admin.html`**. النتيجة: بعد نجاح الحفظ كان الكود يرمي `TypeError: window.showToast is not a function` فيتوقف التنفيذ قبل **إغلاق المودال وتحديث القائمة** — لذلك ظهرت الإضافة كأنها فاشلة.

**الحل:** تم إنشاء `js/toast.js` كمصدر وحيد للتنبيهات، ويُحمّل الآن في `index.html` و `admin.html` **قبل** بقية السكربتات، مع حماية كل استدعاء بـ `if (window.showToast)`. كما أصبح الحفظ يُغلق المودال ويُحدّث القائمة ضمن `try/catch` مع رسائل خطأ واضحة.

---

## 🗄️ أوامر SQL المطلوبة في Supabase (انسخها كما هي)

> Supabase Dashboard → **SQL Editor** → الصق الكود → **Run**.
> نفس الكود متاح أيضًا داخل لوحة التحكم مع زر **"نسخ أوامر SQL"** يظهر تلقائيًا إذا اكتشف النظام أن الجداول غير موجودة.

```sql
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
  for delete to anon, authenticated using (bucket_id = 'customer-reviews');
```

### بعد تنفيذ الأوامر:
1. افتح `admin.html` → ستجد شريط الحالة بالأعلى **"متصل بقاعدة Supabase"** (أخضر).
2. أي عنصر كان محفوظًا محليًا يمكن رفعه مرة واحدة بزر **"🔼 رفع البيانات المحلية"** داخل تبويب مشاريع البورتفوليو.

---

## 🔐 بيانات الربط بـ Supabase

موجودة في `js/config.js` (يستخدم **Anon / Publishable Key** فقط — لا تضع Service Role Key في الواجهة أبدًا):

```javascript
supabase: {
    url: 'https://pjxhovdoijymivxdkxgj.supabase.co',
    anonKey: 'eyJhbGciOi...',              // Anon public JWT
    publishableKey: 'sb_publishable_...',   // المفتاح الجديد (يُجرّب تلقائيًا إذا رُفض الأول)
    storageBucket: 'customer-reviews'
}
```

النظام يفحص المفتاحين تلقائيًا ويستخدم الصالح منهما ويحفظ اختياره في المتصفح.

---

## 💬 تعديل رقم واتساب

الرقم الحالي: **+20 10 21407272** (بالصيغة الدولية `201021407272`).
عدّله من مكان واحد فقط:

```javascript
// js/config.js
whatsapp: { number: '201021407272' }
```

---

## 🔒 كلمة مرور لوحة التحكم

- كلمة المرور الحالية: **`16201`**
- لتغييرها: افتح `js/config.js` وعدّل:
  - `admin.defaultRawPassword` = كلمة المرور الجديدة
  - `admin.passwordHash` = قيمة SHA-256 للكلمة الجديدة (اختياري لكن موصى به)
- ملاحظة أمنية: هذه حماية Frontend فقط. عند استخدام Supabase Auth لاحقًا، انقل التحقق من كلمة المرور إلى الخادم واستخدم JWT + RLS بدل الحماية المحلية.

---

## 🖼️ صورة غلاف الفيديو (Cover)

من لوحة التحكم يمكن رفع **صورة غلاف مخصصة** لأي فيديو (فيديو المقدمة أو مشاريع البورتفوليو):

1. أدخل رابط يوتيوب.
2. اضغط **اختيار صورة غلاف**.
3. احفظ المشروع.
4. في الموقع تظهر صورة الغلاف بدل صورة يوتيوب، وعند الضغط يُشغَّل الفيديو داخل الموقع مباشرة.

إذا لم تُرفع صورة غلاف، سيُستخدم الغلاف الافتراضي من يوتيوب.

> لو الجداول موجودة مسبقًا بدون عمود الغلاف، نفّذ هذين السطرين فقط في SQL Editor:
>
> ```sql
> alter table public.portfolio_projects add column if not exists cover_image_url text default '';
> alter table public.site_settings add column if not exists intro_cover_image_url text default '';
> ```

## 🎬 إضافة الفيديوهات

1. ارفع الفيديو على YouTube (Private / Unlisted يعمل، شرط أن يكون قابلًا للتضمين).
2. من `admin.html` → **مشاريع البورتفوليو** → **+ إضافة فيديو جديد**.
3. الصق رابط الفيديو (المدعوم: `watch?v=` ، `youtu.be` ، `shorts` ، `embed` ، أو حتى الـ ID مباشرة).
4. اكتب العنوان والوصف → **حفظ المشروع**.
5. للترتيب: أسهم ▲ ▼ داخل كل كارت. للحذف: 🗑️ (يظهر مودال تأكيد). للتعديل: ✏️.

**فيديو المقدمة:** تبويب **فيديو المقدمة** → الصق الرابط → **حفظ وتحديث فيديو المقدمة**.

---

## 🖼️ إدارة آراء العملاء

- **+ إضافة رأي عميل** → اختر صورة من جهازك (تُرفع إلى Supabase Storage داخل bucket `customer-reviews`) أو أدخل رابط صورة مباشر.
- تظهر الصور بنسب موحدة (`object-fit: cover`) مع إمكانية التكبير (Lightbox) في الموقع.
- عند الحذف يتم حذف السجل من جدول `customer_reviews` **وحذف الصورة من Storage** تلقائيًا.

---

## ⚡ الأداء والوصولية

- فيديوهات YouTube تُعرض بـ **Facade Player** (صورة مصغّرة + زر تشغيل) ثم يُحمّل الـ iframe عند الضغط فقط → تحميل فوري حتى مع عشرات الفيديوهات.
- `IntersectionObserver` لظهور العناصر، إيقاف الخلفية المتحركة عند إخفاء التاب، عدد الجزيئات يتغير حسب عرض الشاشة.
- احترام `prefers-reduced-motion`، `alt` للصور، `aria-label` للأزرار، `focus` واضح، وكل الواجهة عربية RTL.
