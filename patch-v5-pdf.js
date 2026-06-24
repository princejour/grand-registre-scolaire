(() => {
  'use strict';

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const pdfButton = document.getElementById('pdf');
      const printButton = document.getElementById('print');
      const printRoot = document.getElementById('printRoot');
      const busy = document.getElementById('busy');

      if (!pdfButton || !printButton || !printRoot) return;

      pdfButton.textContent = 'تصدير PDF';

      pdfButton.onclick = async () => {
        if (typeof html2pdf === 'undefined') {
          alert('تعذر تحميل أداة PDF. تحقق من الاتصال بالإنترنت ثم أعد المحاولة.');
          return;
        }

        const originalWindowPrint = window.print;
        window.print = () => {};
        busy?.classList.add('on');

        try {
          printButton.click();
          await wait(300);

          const book = printRoot.firstElementChild;
          if (!book) throw new Error('لم يتم إنشاء الكتاب');

          let state = {};
          try {
            state = JSON.parse(localStorage.getItem('grand-registre-v3') || localStorage.getItem('grand-registre-v2') || '{}');
          } catch (_) {}

          const levelNames = {7:'السابعة',8:'الثامنة',9:'التاسعة'};
          const level = state.active || 7;
          const year = state.year || new Date().getFullYear();
          const filename = `الدفتر-الكبير-${levelNames[level]}-${year}-${year + 1}.pdf`;

          await html2pdf()
            .set({
              margin: 0,
              filename,
              image: {type: 'jpeg', quality: 0.96},
              html2canvas: {
                scale: 1.25,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false
              },
              jsPDF: {
                unit: 'mm',
                format: 'a3',
                orientation: 'landscape',
                compress: true
              },
              pagebreak: {mode: ['css', 'legacy'], after: '.page'}
            })
            .from(book)
            .save();
        } catch (error) {
          console.error(error);
          alert('تعذر إنشاء ملف PDF. أعد المحاولة بعد إغلاق التطبيقات الأخرى.');
        } finally {
          window.print = originalWindowPrint;
          busy?.classList.remove('on');
        }
      };
    }, 100);
  });
})();