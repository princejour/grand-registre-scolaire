(async () => {
  try {
    const paths = [
      './stable-gz/part1.b64?v=20260624-1',
      './stable-gz/part2.b64?v=20260624-1',
      './stable-gz/part3.b64?v=20260624-1'
    ];

    const parts = await Promise.all(paths.map(async (path) => {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return (await response.text()).replace(/\s+/g, '');
    }));

    const binary = atob(parts.join(''));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    if (!('DecompressionStream' in window)) {
      throw new Error('المتصفح لا يدعم فك الضغط');
    }

    const decompressed = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));
    const html = await new Response(decompressed).text();

    document.open();
    document.write(html);
    document.close();
  } catch (error) {
    console.error(error);
    document.body.innerHTML = '<div style="font-family:Tahoma,Arial,sans-serif;text-align:center;padding:40px"><h2>تعذر فتح التطبيق</h2><p>أعد تحميل الصفحة بعد دقيقة.</p></div>';
  }
})();