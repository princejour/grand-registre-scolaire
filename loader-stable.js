(async () => {
  try {
    const response = await fetch('./app-v3.html?stable=1', { cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    let html = await response.text();
    html = html.replace(
      '</body>',
      '<script src="./patch-v4.js?stable=1"><\/script><script src="./stable-native.js?stable=1"><\/script></body>'
    );
    document.open();
    document.write(html);
    document.close();
  } catch (error) {
    console.error(error);
    document.body.innerHTML = '<p style="font-family:Tahoma,Arial;text-align:center;padding:30px">تعذر فتح التطبيق. أعد تحميل الصفحة.</p>';
  }
})();