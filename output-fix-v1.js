(() => {
  'use strict';

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function showMessage(text) {
    const toast = document.getElementById('toast');
    if (!toast) {
      alert(text);
      return;
    }
    toast.textContent = text;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3500);
  }

  function loadScript(src, isReady) {
    if (isReady()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('تعذر تحميل أداة إنشاء PDF'));
      document.head.appendChild(script);
    });
  }

  function buildBook() {
    const api = window.__GRAND_REGISTRE_TEST__;
    if (!api || typeof api.buildBook !== 'function') {
      throw new Error('تعذر إعداد صفحات الكتاب');
    }
    const book = api.buildBook();
    if (!book || !book.querySelector('.page')) {
      throw new Error('لا توجد صفحات جاهزة للإخراج');
    }
    return book;
  }

  function installPrintStyle() {
    if (document.getElementById('output-fix-print-style')) return;
    const style = document.createElement('style');
    style.id = 'output-fix-print-style';
    style.textContent = `
      @media print {
        html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
        body > *:not(#printRoot) { display: none !important; }
        #printRoot { display: block !important; position: static !important; left: auto !important; top: auto !important; width: auto !important; }
        #printRoot .page { display: block !important; margin: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    `;
    document.head.appendChild(style);
  }

  async function renderPage(page) {
    await loadScript(
      'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
      () => typeof window.html2canvas === 'function'
    );

    const host = document.createElement('div');
    host.style.cssText = [
      'position:fixed',
      'left:0',
      'top:0',
      'width:420mm',
      'height:297mm',
      'background:#fff',
      'z-index:-2147483647',
      'pointer-events:none',
      'overflow:hidden'
    ].join(';');

    const clone = page.cloneNode(true);
    clone.style.margin = '0';
    host.appendChild(clone);
    document.body.appendChild(host);

    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const canvas = await window.html2canvas(clone, {
        scale: 1,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: clone.scrollWidth,
        windowHeight: clone.scrollHeight,
        width: clone.scrollWidth,
        height: clone.scrollHeight
      });
      if (!canvas || !canvas.width || !canvas.height) {
        throw new Error('تعذر تحويل الصفحة');
      }
      return canvas;
    } finally {
      host.remove();
    }
  }

  async function exportPdf() {
    await loadScript(
      'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
      () => Boolean(window.jspdf && window.jspdf.jsPDF)
    );

    const book = buildBook();
    const pages = [...book.querySelectorAll('.page')];
    const busy = document.getElementById('busy');
    const previous = busy ? busy.textContent : '';

    if (busy) {
      busy.textContent = 'جاري إنشاء PDF...';
      busy.classList.add('on');
    }

    try {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true });

      for (let index = 0; index < pages.length; index += 1) {
        if (busy) busy.textContent = `جاري إنشاء PDF: الصفحة ${index + 1} من ${pages.length}`;
        const canvas = await renderPage(pages[index]);
        const image = canvas.toDataURL('image/jpeg', 0.88);
        if (index > 0) pdf.addPage('a3', 'landscape');
        pdf.addImage(image, 'JPEG', 0, 0, 420, 297, undefined, 'FAST');
        canvas.width = 1;
        canvas.height = 1;
        await delay(10);
      }

      const blob = pdf.output('blob');
      if (!blob || blob.size < 10000) throw new Error('ملف PDF غير صالح');
      const url = URL.createObjectURL(blob);
      window.location.assign(url);
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } finally {
      if (busy) {
        busy.textContent = previous || 'جاري إعداد الكتاب...';
        busy.classList.remove('on');
      }
    }
  }

  function printDirect() {
    installPrintStyle();
    const root = document.getElementById('printRoot');
    if (!root) throw new Error('تعذر إعداد الطباعة');
    const book = buildBook();
    root.replaceChildren(book);
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  function install() {
    const pdfButton = document.getElementById('pdf');
    const printButton = document.getElementById('print');
    if (!pdfButton || !printButton) return;

    pdfButton.onclick = async () => {
      try {
        await exportPdf();
      } catch (error) {
        console.error(error);
        showMessage(error.message || 'تعذر إنشاء ملف PDF');
      }
    };

    printButton.onclick = () => {
      try {
        printDirect();
      } catch (error) {
        console.error(error);
        showMessage(error.message || 'تعذر فتح الطباعة');
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(install, 0));
  } else {
    setTimeout(install, 0);
  }
})();