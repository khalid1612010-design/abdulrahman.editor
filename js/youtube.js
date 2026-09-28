/**
 * تم استبدال نظام YouTube بالكامل بمشغّل HTML5 ورفع الملفات إلى Supabase Storage.
 * الملف موجود فقط لتفادي روابط قديمة. المنطق الفعلي في js/videoPlayer.js
 */
if (window.VideoPlayer) {
    window.YouTubeService = window.VideoPlayer;
}
