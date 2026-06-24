(() => {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const pdfButton = document.getElementById('pdf');
      if (!pdfButton || typeof pdfButton.onclick !== 'function') return;

      const generatePdf = pdfButton.onclick;

      pdfButton.onclick = async (event) => {
        const nativeAnchorClick = HTMLAnchorElement.prototype.click;
        let pdfUrl = '';

        HTMLAnchorElement.prototype.click = function (...args) {
          const href = String(this.href || '');
          const filename = String(this.download || '');
          if (href.startsWith('blob:') && filename.toLowerCase().endsWith('.pdf')) {
            pdfUrl = href;
            return;
          }
          return nativeAnchorClick.apply(this, args);
        };

        try {
          await generatePdf.call(pdfButton, event);
          if (!pdfUrl) {
            alert('تم إنشاء الصفحات لكن تعذر فتح ملف PDF. أعد المحاولة.');
            return;
          }

          window.location.assign(pdfUrl);
        } catch (error) {
          console.error(error);
          alert(error.message || 'تعذر إنشاء ملف PDF.');
        } finally {
          HTMLAnchorElement.prototype.click = nativeAnchorClick;
        }
      };
    }, 800);
  });
})();