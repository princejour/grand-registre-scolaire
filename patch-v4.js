(() => {
  'use strict';

  const STORAGE_KEYS = ['grand-registre-v3', 'grand-registre-v2'];
  const LEVEL_NAMES = {7:'السابعة',8:'الثامنة',9:'التاسعة'};
  const MONTHS = {
    'يناير':1,'جانفي':1,'janvier':1,'january':1,
    'فبراير':2,'فيفري':2,'fevrier':2,'février':2,'february':2,
    'مارس':3,'mars':3,'march':3,
    'أبريل':4,'ابريل':4,'أفريل':4,'افريل':4,'avril':4,'april':4,
    'مايو':5,'ماي':5,'mai':5,'may':5,
    'يونيو':6,'جوان':6,'juin':6,'june':6,
    'يوليو':7,'جويلية':7,'juillet':7,'july':7,
    'أغسطس':8,'اوت':8,'أوت':8,'aout':8,'août':8,'august':8,
    'سبتمبر':9,'septembre':9,'september':9,
    'أكتوبر':10,'اكتوبر':10,'octobre':10,'october':10,
    'نوفمبر':11,'novembre':11,'november':11,
    'ديسمبر':12,'decembre':12,'décembre':12,'december':12
  };

  const norm = value => String(value || '')
    .toLowerCase().replace(/[إأآ]/g,'ا').replace(/[ًٌٍَُِّْـ]/g,'')
    .replace(/\s+/g,' ').trim();
  const digits = value => String(value || '')
    .replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const cleanName = value => String(value || '')
    .replace(/^\s*\d+\s*[-.)]?\s*/,'').replace(/\s+/g,' ').trim();
  const probableName = value => {
    const v = cleanName(value);
    return v.length > 2 && v.length < 80 && !/^\d+$/.test(v) &&
      !/(الاسم|اللقب|التلميذ|المجموع|القسم|classe|nom|prenom)/i.test(norm(v));
  };
  const escRx = value => String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const pad = n => String(n).padStart(2,'0');

  function readState() {
    for (const key of STORAGE_KEYS) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null');
        if (parsed) return {key, state:parsed};
      } catch (_) {}
    }
    return {key:STORAGE_KEYS[0], state:{school:'',year:new Date().getFullYear(),active:7,classes:[],holidays:[]}};
  }

  function writeState(state) {
    localStorage.setItem('grand-registre-v3', JSON.stringify(state));
    localStorage.setItem('grand-registre-v2', JSON.stringify(state));
  }

  function detectLevel(text) {
    const t = norm(digits(text));
    if (/السابع(?:ة)?|سابعة|septieme|septième|\b7\s*(?:a|eme|ème|e|اساسي|أساسي)?\b/i.test(t)) return 7;
    if (/الثامن(?:ة)?|ثامنة|huitieme|huitième|\b8\s*(?:a|eme|ème|e|اساسي|أساسي)?\b/i.test(t)) return 8;
    if (/التاسع(?:ة)?|تاسعة|neuvieme|neuvième|\b9\s*(?:a|eme|ème|e|اساسي|أساسي)?\b/i.test(t)) return 9;
    return null;
  }

  function detectClassNumber(text, level) {
    const t = norm(digits(text));
    const nums = (t.match(/\d{1,2}/g) || []).map(Number);
    if (level && nums.length >= 2 && nums[0] === level && nums[1] >= 1 && nums[1] <= 30) return nums[1];
    const m = t.match(/(?:قسم|classe|class|groupe|division)\s*[-_:]?\s*(\d{1,2})/i);
    if (m && +m[1] >= 1 && +m[1] <= 30) return +m[1];
    if (nums.length === 1 && nums[0] !== level && nums[0] >= 1 && nums[0] <= 30) return nums[0];
    return null;
  }

  function findHeader(rows) {
    let best = -1, bestScore = 0;
    for (let i=0;i<Math.min(15,rows.length);i++) {
      const text = norm(rows[i].join(' '));
      let score = rows[i].filter(Boolean).length;
      if (/الاسم|اللقب|التلميذ|nom|prenom|prénom/.test(text)) score += 10;
      if (/القسم|الفصل|classe|groupe|division/.test(text)) score += 8;
      if (score > bestScore) {bestScore=score;best=i;}
    }
    return bestScore >= 10 ? best : -1;
  }

  function locateNameColumns(header, data) {
    const h = header.map(norm);
    const full = h.findIndex(x=>/الاسم.*اللقب|اللقب.*الاسم|اسم.*التلميذ|nom.*prenom|prenom.*nom|nom complet/.test(x));
    const first = h.findIndex(x=>/^(الاسم|prenom|prénom)$/.test(x));
    const last = h.findIndex(x=>/^(اللقب|nom)$/.test(x));
    if (full >= 0) return {mode:'full',full,used:[full]};
    if (first >= 0 && last >= 0 && first !== last) return {mode:'split',first,last,used:[first,last]};
    const max = Math.max(1,...data.map(r=>r.length));
    let best=0,score=-1;
    for (let c=0;c<max;c++) {
      const s=data.filter(r=>probableName(r[c])).length;
      if (s>score){score=s;best=c;}
    }
    return {mode:'full',full:best,used:[best]};
  }

  function getName(row, info) {
    if (info.mode === 'split') return cleanName((row[info.first]||'')+' '+(row[info.last]||''));
    return cleanName(row[info.full]||'');
  }

  function likelyClassColumn(data, excluded) {
    const max=Math.max(1,...data.map(r=>r.length));
    let best=-1,bestScore=0;
    for(let c=0;c<max;c++){
      if(excluded.includes(c))continue;
      const values=data.map(r=>String(r[c]||'').trim()).filter(Boolean);
      if(values.length<3)continue;
      const distinct=[...new Set(values.map(norm))];
      if(distinct.length>30)continue;
      const repeated=values.length-distinct.length;
      const classLike=values.filter(v=>/السابع|الثامن|التاسع|سابعة|ثامنة|تاسعة|classe|\b[789]\b|^[1-9]\d?$/.test(norm(v))).length;
      const score=repeated+classLike*2;
      if(score>bestScore&&repeated>=Math.floor(values.length*.35)){bestScore=score;best=c;}
    }
    return best;
  }

  function splitSheet(fileName, sheetName, rawRows, existing) {
    const rows=rawRows.map(r=>r.map(v=>String(v??'').trim())).filter(r=>r.some(Boolean));
    if(!rows.length)return {classes:[],rejected:0};
    const context=norm(fileName+' '+sheetName+' '+rows.slice(0,12).flat().join(' '));
    const globalLevel=detectLevel(context);
    const hi=findHeader(rows);
    const header=hi>=0?rows[hi]:[];
    const data=hi>=0?rows.slice(hi+1):rows;
    const nameInfo=locateNameColumns(header,data);
    const nh=header.map(norm);
    let classCol=nh.findIndex(h=>/^(القسم|الفصل|classe|class|groupe|division|المستوى والقسم|القسم الحالي)$/.test(h)||/رقم القسم|اسم القسم|classe actuelle/.test(h));
    if(classCol<0)classCol=likelyClassColumn(data,nameInfo.used);
    if(classCol<0)return {classes:[],rejected:1};

    const groups=new Map();
    data.forEach(row=>{
      const name=getName(row,nameInfo), label=String(row[classCol]||'').trim();
      if(!probableName(name)||!label)return;
      const key=norm(label);
      if(!groups.has(key))groups.set(key,{label,names:[]});
      groups.get(key).names.push(name);
    });

    const result=[];
    const staged=[];
    for(const group of groups.values()){
      const level=detectLevel(group.label)||globalLevel;
      if(!level)continue;
      let num=detectClassNumber(group.label,level);
      if(!num&&/^\d{1,2}$/.test(digits(group.label)))num=+digits(group.label);
      if(!num){
        const used=new Set([...existing,...staged].filter(c=>c.level===level).map(c=>c.num).filter(Boolean));
        num=1;while(used.has(num))num++;
      }
      const students=[...new Set(group.names.map(cleanName).filter(probableName))];
      if(!students.length||students.length>60)continue;
      const cls={id:Date.now()+'-'+Math.random(),level,num,name:LEVEL_NAMES[level]+' '+num,students,source:fileName+' / '+sheetName+' / '+group.label};
      staged.push(cls);result.push(cls);
    }
    return {classes:result,rejected:result.length?0:1};
  }

  function installStyles(){
    const style=document.createElement('style');
    style.textContent=`
      .sun{background-color:#c7c7c7!important;box-shadow:inset 0 0 0 1000px #c7c7c7!important}
      .school{background-color:#a9a9a9!important;box-shadow:inset 0 0 0 1000px #a9a9a9!important}
      .national{background-color:#bdbdbd!important;box-shadow:inset 0 0 0 1000px #bdbdbd!important}
      .religious{background-color:#d1d1d1!important;box-shadow:inset 0 0 0 1000px #d1d1d1!important}
      .page,.page *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
      .pastebox-v4{margin:14px 0;border:1px solid #bfd1df;background:#f6fbff;border-radius:12px;padding:12px}
      .pastebox-v4 textarea{width:100%;min-height:150px;resize:vertical;line-height:1.8}
      .patch-alert{background:#fff2d8;color:#75520a;border:1px solid #e5c06a;border-radius:10px;padding:10px;margin-top:10px}
      @media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}}
    `;
    document.head.appendChild(style);
  }

  function parseDate(text, academicYear){
    const line=digits(text).replace(/[–—]/g,'-');
    let m=line.match(/(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})/);
    if(m){
      let a=+m[1],b=+m[2],c=+m[3],y,mo,d;
      if(a>31){y=a;mo=b;d=c}else{d=a;mo=b;y=c<100?c+2000:c;}
      return {iso:y+'-'+pad(mo)+'-'+pad(d),raw:m[0]};
    }
    const names=Object.keys(MONTHS).sort((a,b)=>b.length-a.length).map(escRx).join('|');
    const rx=new RegExp('(\\d{1,2})\\s+('+names+')(?:\\s+(\\d{4}))?','i');
    m=line.match(rx);
    if(!m)return null;
    const mo=MONTHS[norm(m[2])]||MONTHS[m[2].toLowerCase()];
    const y=m[3]?+m[3]:(mo>=10?academicYear:academicYear+1);
    return {iso:y+'-'+pad(mo)+'-'+pad(+m[1]),raw:m[0]};
  }

  function addPasteBox(){
    const modal=document.querySelector('#modal .box');
    const form=modal?.querySelector('.holidayform');
    if(!modal||!form||modal.querySelector('.pastebox-v4'))return;
    const box=document.createElement('div');
    box.className='pastebox-v4';
    box.innerHTML=`<h3>لصق رزنامة العطل دفعة واحدة</h3>
      <p class="hint">كل عطلة في سطر، مثال: عطلة الشتاء: من 22 ديسمبر 2025 إلى 4 جانفي 2026</p>
      <textarea id="holidayPasteV4" placeholder="الصق رزنامة العطل هنا..."></textarea>
      <div class="actions"><button type="button" class="primary" id="parseHolidayV4">تحليل وحفظ العطل</button></div>`;
    modal.insertBefore(box,form);
    box.querySelector('#parseHolidayV4').onclick=()=>{
      const text=box.querySelector('#holidayPasteV4').value.trim();
      if(!text)return alert('الصق رزنامة العطل أولًا');
      const {state}=readState();
      state.holidays=state.holidays||[];
      let added=0,failed=0;
      text.split(/\n+/).map(x=>x.trim()).filter(Boolean).forEach(line=>{
        const parts=line.split(/\s+(?:إلى|الى|حتى)\s+/i);
        const first=parseDate(parts[0],+state.year);
        const second=parts[1]?parseDate(parts[1],+state.year):null;
        if(!first){failed++;return;}
        const end=second?.iso||first.iso;
        let name=line.replace(first.raw,' ').replace(second?.raw||'',' ').replace(/\bمن\b|\bإلى\b|\bالى\b|[:|،;-]+/g,' ').replace(/\s+/g,' ').trim()||'عطلة';
        const t=norm(name);
        const type=/المولد|الفطر|الاضحى|الأضحى|هجري|ديني/.test(t)?'religious':/الجلاء|الثوره|الثورة|الاستقلال|الشهداء|الشغل|وطني/.test(t)?'national':'school';
        if(!state.holidays.some(h=>h.start===first.iso&&h.end===end&&norm(h.name)===norm(name))){state.holidays.push({id:Date.now()+'-'+Math.random(),name,type,start:first.iso,end});added++;}
      });
      writeState(state);
      alert('تم حفظ '+added+' عطلة'+(failed?'، وتعذر فهم '+failed+' سطر.':'.'));
      location.reload();
    };
  }

  function initPatch(){
    installStyles();
    if('serviceWorker' in navigator)navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister())).catch(()=>{});
    document.getElementById('busy')?.classList.remove('on');

    const {state}=readState();
    const bad=(state.classes||[]).filter(c=>(c.students||[]).length>60).length;
    if(bad){
      state.classes=(state.classes||[]).filter(c=>(c.students||[]).length<=60);
      writeState(state);
      const status=document.getElementById('status');
      if(status){status.className='patch-alert';status.textContent='حُذفت '+bad+' قائمة جُمعت فيها عدة أقسام خطأ. أعد استيراد الملفات وسيتم تقسيمها حسب عمود القسم.';}
    }

    const input=document.getElementById('files');
    if(input)input.onchange=async event=>{
      if(typeof XLSX==='undefined')return alert('تعذر تحميل قارئ Excel');
      const files=[...event.target.files];
      const current=readState().state;
      current.classes=current.classes||[];
      let added=0,rejected=0;
      document.getElementById('busy')?.classList.add('on');
      for(const file of files){
        try{
          const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
          for(const sheetName of wb.SheetNames){
            const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,raw:false,defval:''});
            const parsed=splitSheet(file.name,sheetName,rows,current.classes);
            parsed.classes.forEach(cls=>{
              const i=current.classes.findIndex(c=>c.level===cls.level&&c.num===cls.num);
              if(i>=0)current.classes.splice(i,1,cls);else current.classes.push(cls);
              added++;
            });
            rejected+=parsed.rejected;
          }
        }catch(e){console.error(e);rejected++;}
      }
      writeState(current);
      document.getElementById('busy')?.classList.remove('on');
      if(!added){alert('لم أجد عمود القسم في الملف. يجب أن يكون هناك عمود بعنوان: القسم أو Classe.');return;}
      alert('تم تقسيم القائمات إلى '+added+' قسم'+(rejected?'، وتعذر تقسيم '+rejected+' ورقة.':'.'));
      location.reload();
    };

    const printBtn=document.getElementById('print');
    if(printBtn&&printBtn.onclick){
      const original=printBtn.onclick;
      printBtn.onclick=e=>{
        const s=readState().state;
        if((s.classes||[]).some(c=>(c.students||[]).length>60))return alert('يوجد قسم بعدد غير منطقي من التلاميذ. أعد الاستيراد.');
        return original.call(printBtn,e);
      };
    }
    const pdfBtn=document.getElementById('pdf');
    if(pdfBtn){
      pdfBtn.textContent='حفظ PDF';
      pdfBtn.onclick=()=>{
        alert('في النافذة التالية اختر: حفظ كملف PDF');
        printBtn?.click();
      };
    }
    addPasteBox();
  }

  document.addEventListener('DOMContentLoaded',()=>setTimeout(initPatch,0));
})();