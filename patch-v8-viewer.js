(() => {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const pdfButton = document.getElementById('pdf');
      if (!pdfButton || typeof pdfButton.onclick !== 'function') return;

      const generatePdf = pdfButton.onclick;

      pdfButton.onclick = async (event) => {
        const viewer = window.open('', '_blank');
        if (!viewer) {
          alert('اسمح للمتصفح بفتح نافذة جديدة لعرض ملف PDF.');
          return;
        }

        viewer.document.open();
        viewer.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>جاري إنشاء PDF</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#eef3f7;color:#173b5f;font-family:Tahoma,Arial,sans-serif;text-align:center}.box{background:#fff;padding:28px;border-radius:16px;box-shadow:0 10px 30px #173b5f22}.spin{width:44px;height:44px;margin:0 auto 15px;border:5px solid #d7e3eb;border-top-color:#173b5f;border-radius:50%;animation:s .8s linear infinite}@keyframes s{to{transform:rotate(360deg)}}</style></head><body><div class="box"><div class="spin"></div><strong>جاري إنشاء ملف PDF...</strong><p>اترك الصفحة مفتوحة إلى أن تظهر المعاينة.</p></div></body></html>`);
        viewer.document.close();

        const nativeAnchorClick = HTMLAnchorElement.prototype.click;
        let openedPdf = false;

        HTMLAnchorElement.prototype.click = function (...args) {
          const href = String(this.href || '');
          const filename = String(this.download || '');
          if (href.startsWith('blob:') && filename.toLowerCase().endsWith('.pdf')) {
            openedPdf = true;
            try {
              viewer.location.replace(href);
            } catch (_) {
              viewer.location.href = href;
            }
            return;
          }
          return nativeAnchorClick.apply(this, args);
        };

        try {
          await generatePdf.call(pdfButton, event);
          if (!openedPdf && !viewer.closed) {
            viewer.document.body.innerHTML = '<div style="font-family:Tahoma,Arial;text-align:center;padding:40px"><h2>تعذر عرض ملف PDF</h2><p>أعد المحاولة بعد إغلاق التطبيقات الأخرى.</p></div>';
          }
        } catch (error) {
          console.error(error);
          if (!viewer.closed) {
            viewer.document.body.innerHTML = '<div style="font-family:Tahoma,Arial;text-align:center;padding:40px"><h2>تعذر إنشاء ملف PDF</h2><p>ارجع إلى التطبيق وأعد المحاولة.</p></div>';
          }
        } finally {
          HTMLAnchorElement.prototype.click = nativeAnchorClick;
        }
      };
    }, 800);
  });
})();