(() => {
  'use strict';

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const LEVEL_NAMES = { 7: 'السابعة', 8: 'الثامنة', 9: 'التاسعة' };
  const MONTHS = {
    'أكتوبر': 10, 'اكتوبر': 10,
    'نوفمبر': 11,
    'ديسمبر': 12,
    'جانفي': 1, 'يناير': 1,
    'فيفري': 2, 'فبراير': 2,
    'مارس': 3,
    'أفريل': 4, 'افريل': 4, 'أبريل': 4, 'ابريل': 4,
    'ماي': 5, 'مايو': 5
  };
  const SHADE_COLORS = {
    sun: '#c7c7c7',
    school: '#a9a9a9',
    national: '#8f8f8f',
    religious: '#bdbdbd'
  };

  function getState() {
    for (const key of ['grand-registre-v3', 'grand-registre-v2']) {
      try {
        const value = JSON.parse(localStorage.getItem(key) || 'null');
        if (value) return value;
      } catch (_) {}
    }
    return {};
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function isoDate(year, month, day) {
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  function pageMonth(page) {
    const text = page.textContent || '';
    for (const [name, month] of Object.entries(MONTHS)) {
      if (text.includes(`شهر ${name}`)) return month;
    }
    return null;
  }

  function shadeForDate(state, year, month, day) {
    const iso = isoDate(year, month, day);
    const holidays = Array.isArray(state.holidays) ? state.holidays : [];
    const matches = holidays.filter((holiday) => iso >= holiday.start && iso <= (holiday.end || holiday.start));
    if (matches.length) {
      const priority = { religious: 3, national: 2, school: 1 };
      matches.sort((a, b) => (priority[b.type] || 0) - (priority[a.type] || 0));
      return matches[0].type || 'school';
    }
    return new Date(year, month - 1, day).getDay() === 0 ? 'sun' : '';
  }

  function paintCell(cell, kind) {
    cell.classList.remove('sun', 'school', 'national', 'religious');
    cell.style.removeProperty('background');
    cell.style.removeProperty('background-image');
    cell.style.removeProperty('background-color');
    cell.style.removeProperty('box-shadow');

    if (!kind) return;
    const color = SHADE_COLORS[kind];
    cell.classList.add(kind);
    cell.style.setProperty('background', color, 'important');
    cell.style.setProperty('background-color', color, 'important');
    cell.style.setProperty('background-image', 'none', 'important');
    cell.style.setProperty('box-shadow', `inset 0 0 0 1000px ${color}`, 'important');
    cell.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
    cell.style.setProperty('print-color-adjust', 'exact', 'important');
  }

  function reapplyCalendarShading(book) {
    const state = getState();
    const startYear = Number(state.year || new Date().getFullYear());

    for (const page of book.querySelectorAll('.page')) {
      const month = pageMonth(page);
      if (!month) continue;
      const year = month >= 10 ? startYear : startYear + 1;
      const table = page.querySelector('.reg');
      const headerRow = table?.querySelector('thead tr');
      if (!table || !headerRow) continue;

      const headers = [...headerRow.children];
      for (let column = 2; column < headers.length - 2; column += 1) {
        const day = Number.parseInt(headers[column].textContent, 10);
        if (!Number.isInteger(day) || day < 1 || day > 31) continue;
        const kind = shadeForDate(state, year, month, day);
        paintCell(headers[column], kind);
        for (const row of table.querySelectorAll('tbody tr')) {
          const cell = row.children[column];
          if (cell) paintCell(cell, kind);
        }
      }
    }
  }

  function cloneAllStyles() {
    const css = [...document.querySelectorAll('style')]
      .map((style) => style.textContent || '')
      .join('\n');
    return `${css}\nhtml,body{margin:0!important;padding:0!important;background:#fff!important}#printRoot{display:block!important;position:static!important;left:auto!important;top:auto!important;width:auto!important}.page{margin:0!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}`;
  }

  async function buildBook(originalHandler, printButton, printRoot) {
    const realPrint = window.print;
    window.print = () => {};
    try {
      originalHandler.call(printButton, new Event('click'));
      await sleep(450);
      const book = printRoot.firstElementChild;
      if (!book || !book.querySelector('.page')) throw new Error('لم يتم إنشاء صفحات الكتاب');
      const clone = book.cloneNode(true);
      reapplyCalendarShading(clone);
      return clone;
    } finally {
      window.print = realPrint;
    }
  }

  function writePrintableDocument(popup, book) {
    if (!popup || popup.closed) throw new Error('نافذة الطباعة مغلقة');
    popup.document.open();
    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>طباعة الدفتر الكبير</title><style>${cloneAllStyles()}</style></head><body><div id="printRoot">${book.outerHTML}</div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),700));<\/script></body></html>`);
    popup.document.close();
  }

  async function ensurePdfLibraries() {
    if (typeof window.html2canvas !== 'function') {
      await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
    }
    if (!window.jspdf?.jsPDF) {
      await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find((script) => script.src === src);
      if (existing) {
        if (existing.dataset.loaded === '1') return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => { script.dataset.loaded = '1'; resolve(); };
      script.onerror = () => reject(new Error('تعذر تحميل مكتبة PDF'));
      document.head.appendChild(script);
    });
  }

  async function downloadPdf(book, busy) {
    await ensurePdfLibraries();

    const renderHost = document.createElement('div');
    renderHost.style.cssText = 'position:absolute;left:0;top:0;width:420mm;background:#fff;z-index:-99999;pointer-events:none;';
    document.body.appendChild(renderHost);

    try {
      const pages = [...book.querySelectorAll('.page')];
      if (!pages.length) throw new Error('الكتاب لا يحتوي على صفحات');
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3', compress: true });

      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index].cloneNode(true);
        reapplyCalendarShading(page);
        renderHost.replaceChildren(page);
        await sleep(40);
        if (busy) busy.textContent = `جاري إنشاء PDF: الصفحة ${index + 1} من ${pages.length}`;

        const canvas = await window.html2canvas(page, {
          scale: 1,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: page.scrollWidth,
          windowHeight: page.scrollHeight
        });

        if (index > 0) pdf.addPage('a3', 'landscape');
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.88), 'JPEG', 0, 0, 420, 297, undefined, 'FAST');
        canvas.width = 1;
        canvas.height = 1;
        await sleep(20);
      }

      const state = getState();
      const level = Number(state.active || 7);
      const year = Number(state.year || new Date().getFullYear());
      const filename = `الدفتر-الكبير-${LEVEL_NAMES[level] || level}-${year}-${year + 1}.pdf`;
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } finally {
      renderHost.remove();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const printButton = document.getElementById('print');
      const pdfButton = document.getElementById('pdf');
      const printRoot = document.getElementById('printRoot');
      const busy = document.getElementById('busy');
      if (!printButton || !pdfButton || !printRoot || typeof printButton.onclick !== 'function') return;

      const originalHandler = printButton.onclick;

      printButton.onclick = async () => {
        let popup = null;
        try {
          popup = window.open('', '_blank');
          if (!popup) throw new Error('المتصفح منع نافذة الطباعة');
          popup.document.write('<p style="font-family:Arial;text-align:center;padding:30px">جاري تجهيز صفحات الطباعة...</p>');
          const book = await buildBook(originalHandler, printButton, printRoot);
          writePrintableDocument(popup, book);
        } catch (error) {
          if (popup && !popup.closed) popup.close();
          console.error(error);
          alert(error.message || 'تعذر فتح الطباعة');
        }
      };

      pdfButton.textContent = 'تصدير PDF';
      pdfButton.onclick = async () => {
        const previousText = busy?.textContent || 'جاري إعداد الكتاب...';
        try {
          if (busy) {
            busy.textContent = 'جاري تجهيز صفحات PDF...';
            busy.classList.add('on');
          }
          const book = await buildBook(originalHandler, printButton, printRoot);
          await downloadPdf(book, busy);
        } catch (error) {
          console.error(error);
          alert(error.message || 'تعذر إنشاء ملف PDF');
        } finally {
          if (busy) {
            busy.textContent = previousText;
            busy.classList.remove('on');
          }
        }
      };
    }, 350);
  });
})();