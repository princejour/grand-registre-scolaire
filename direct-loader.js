(async () => {
  try {
    const names = [
      '01','02','03','04','05',
      '06a','06b','07a','07b','08a','08b'
    ];
    const parts = await Promise.all(names.map(async (name) => {
      const response = await fetch(`./direct-payload/${name}.b64?v=direct-20260624-1`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${name}`);
      return (await response.text()).replace(/\s+/g, '');
    }));

    const binary = atob(parts.join(''));
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const html = new TextDecoder('utf-8').decode(bytes);

    if (!html.startsWith('<!doctype html>') || !html.includes('الدفتر الكبير للغيابات')) {
      throw new Error('ملف التطبيق غير صالح');
    }

    document.open();
    document.write(html);
    document.close();
  } catch (error) {
    console.error(error);
    document.body.innerHTML = '<div style="font-family:Tahoma,Arial,sans-serif;text-align:center;padding:40px"><h2>تعذر فتح التطبيق</h2><p>أعد تحميل الصفحة.</p></div>';
  }
})();