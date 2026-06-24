(() => {
  'use strict';

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function collectStyles() {
    return [...document.querySelectorAll('style')]
      .map((style) => style.textContent || '')
      .join('\n');
  }

  async function buildBook(originalHandler, printButton, printRoot) {
    const realPrint = window.print;
    window.print = () => {};
    try {
      originalHandler.call(printButton, new Event('click'));
      await wait(300);
      const book = printRoot.firstElementChild;
      if (!book || !book.querySelector('.page')) {
        throw new Error('لم يتم إنشاء صفحات الكتاب');
      }
      return book.cloneNode(true);
    } finally {
      window.print = realPrint;
    }
  }

  function openOutput(book, mode) {
    const css = collectStyles();
    const instruction = mode === 'pdf'
      ? 'من خانة الطابعة اختر: حفظ بصيغة PDF'
      : 'اختر الطابعة ثم اضغط طباعة';

    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>الدفتر الكبير للغيابات</title>
<style>
${css}
html,body{margin:0!important;padding:0!important;background:#fff!important}
#printRoot{display:block!important;position:static!important;left:auto!important;top:auto!important;width:auto!important}
.page{margin:0!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
.output-bar{position:sticky;top:0;z-index:9999;background:#173b5f;color:#fff;padding:12px;text-align:center;font-family:Tahoma,Arial,sans-serif}
.output-bar button{margin-right:8px;background:#fff;color:#173b5f;border:0;border-radius:8px;padding:8px 13px;font-weight:bold}
@media print{.output-bar{display:none!important}}
</style>
</head>
<body onload="setTimeout(()=>window.print(),700)">
<div class="output-bar">${instruction}<button onclick="window.print()">فتح نافذة الطباعة</button><button onclick="history.back()">الرجوع</button></div>
<div id="printRoot">${book.outerHTML}</div>
</body>
</html>`;

    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    window.location.href = url;
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const printButton = document.getElementById('print');
      const pdfButton = document.getElementById('pdf');
      const printRoot = document.getElementById('printRoot');
      if (!printButton || !pdfButton || !printRoot || typeof printButton.onclick !== 'function') return;

      const originalHandler = printButton.onclick;

      printButton.onclick = async () => {
        try {
          const book = await buildBook(originalHandler, printButton, printRoot);
          openOutput(book, 'print');
        } catch (error) {
          console.error(error);
          alert(error.message || 'تعذر إعداد الطباعة');
        }
      };

      pdfButton.textContent = 'حفظ PDF';
      pdfButton.onclick = async () => {
        try {
          const book = await buildBook(originalHandler, printButton, printRoot);
          openOutput(book, 'pdf');
        } catch (error) {
          console.error(error);
          alert(error.message || 'تعذر إعداد ملف PDF');
        }
      };
    }, 500);
  });
})();