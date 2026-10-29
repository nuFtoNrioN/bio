const $=(s)=>document.querySelector(s),$$=(s)=>[...document.querySelectorAll(s)];
const ST={working:['Đang chạy','working'],patched:['Đã bị patch','patched'],outdated:['Cũ','outdated']};
const IC={arrow:'M7 17L17 7M9 7h8v8',play:'M8 5v14l11-7z',copy:'M9 9h10v10H9zM5 15V5h10',code:'M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14',x:'M6 6l12 12M18 6L6 18',down:'M6 9l6 6 6-6',right:'M9 6l6 6-6 6',left:'M15 18l-6-6 6-6',check:'M20 6L9 17l-5-5',ext:'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3',key:'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',users:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8'};
function ic(d,c=''){const N='http://www.w3.org/2000/svg',s=document.createElementNS(N,'svg'),p=document.createElementNS(N,'path');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('class','i '+c);p.setAttribute('d',d);s.append(p);return s}
function el(tag,attrs={},...kids){const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k==='class')e.className=v;else if(k==='text')e.textContent=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else e.setAttribute(k,v)}kids.forEach(c=>e.append(c));return e}
const safeUrl=(u)=>{try{const x=new URL(u);return x.protocol==='https:'?x.href:null}catch{return null}};
const host=(u)=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch{return ''}};
async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch{const a=el('textarea');a.value=t;document.body.append(a);a.select();const ok=document.execCommand('copy');a.remove();return ok}}
function flash(b,t){const o=b.dataset.o||b.textContent;b.dataset.o=o;b.textContent=t;setTimeout(()=>b.textContent=o,1500)}
let D,TAB;
const rawUrl=(s)=>D.raw_url?D.raw_url+'/'+s.id:'';
const cmdOf=(s)=>'loadstring(game:HttpGet("'+rawUrl(s)+'"))()';

/* hiệu ứng bấm (gợn sóng) và vệt sáng theo con trỏ */
document.addEventListener('pointerdown',(e)=>{const t=e.target.closest&&e.target.closest('.rp');if(!t)return;const r=t.getBoundingClientRect(),s=Math.max(r.width,r.height)*2.2,x=document.createElement('span');x.className='ripple';x.style.cssText='width:'+s+'px;height:'+s+'px;left:'+(e.clientX-r.left-s/2)+'px;top:'+(e.clientY-r.top-s/2)+'px';t.append(x);setTimeout(()=>x.remove(),650)});
document.addEventListener('pointermove',(e)=>{const t=e.target.closest&&e.target.closest('.sp');if(!t)return;const r=t.getBoundingClientRect();t.style.setProperty('--mx',(e.clientX-r.left)+'px');t.style.setProperty('--my',(e.clientY-r.top)+'px')},{passive:true});

async function copyCode(s,btn){try{const r=await fetch('/api/code/'+s.id);if(!r.ok)throw 0;flash(btn,(await copyText(await r.text()))?'Đã copy code':'Không copy được')}catch{flash(btn,'Lỗi, thử lại')}}
function copyCmd(s,btn){copyText(cmdOf(s)).then(ok=>flash(btn,ok?'Đã copy lệnh':'Không copy được'));fetch('/api/copy/'+s.id,{method:'POST'}).catch(()=>{})}
const rawLink=(s,cls)=>safeUrl(rawUrl(s))?el('a',{class:cls,href:safeUrl(rawUrl(s)),target:'_blank',rel:'noopener noreferrer',text:'Raw',onclick:(e)=>e.stopPropagation()}):'';

function card(s,i){
  const st=ST[s.status]||ST.working,img=safeUrl(s.image_url);
  const c=el('article',{class:'scard sp rp rv',tabindex:'0',role:'button','aria-label':'Xem chi tiết '+s.title},
    el('div',{class:'sthumb'},img?el('img',{src:img,alt:'',loading:'lazy'}):el('div',{class:'sph'},ic(IC.code)),el('span',{class:'badge '+st[1],text:st[0]}),s.has_key?el('span',{class:'badge kbadge',title:'Script này cần key'},ic(IC.key),'Key'):''),
    el('div',{class:'sbody'},
      el('h3',{text:s.title}),s.game?el('div',{class:'smeta',text:s.game}):'',
      el('div',{class:'sstats'},el('span',{title:'Lượt chạy'},ic(IC.play),String(s.runs)),el('span',{title:'Lượt copy'},ic(IC.copy),String(s.copies)))));
  c.style.setProperty('--i',i+2);
  c.onclick=()=>openDlg(s);c.onkeydown=(e)=>{if(e.key==='Enter'&&e.target===c)openDlg(s)};
  return c}

function popHero(imgs,st){
  const h=el('div',{class:'pp-hero'}),badge=el('span',{class:'badge '+st[1],text:st[0]}),ph=()=>el('div',{class:'sph'},ic(IC.code));
  if(!imgs.length){h.append(ph(),badge);return h}
  const tr=el('div',{class:'pp-gal'});
  imgs.forEach((u,i)=>{const im=el('img',{src:u,alt:'Ảnh minh họa '+(i+1),loading:i?'lazy':'eager',draggable:'false'});im.onerror=()=>im.replaceWith(ph());tr.append(im)});
  h.append(tr,badge);
  if(imgs.length>1){
    const dots=imgs.map((_,i)=>el('button',{class:'pp-dot',type:'button','aria-label':'Ảnh '+(i+1),onclick:()=>go(i)})),
      pv=el('button',{class:'pp-nav prev',type:'button','aria-label':'Ảnh trước',onclick:()=>go(cur()-1)},ic(IC.left)),
      nx=el('button',{class:'pp-nav next',type:'button','aria-label':'Ảnh sau',onclick:()=>go(cur()+1)},ic(IC.right));
    const cur=()=>Math.round(tr.scrollLeft/Math.max(1,tr.clientWidth)),
      go=(i)=>tr.scrollTo({left:Math.min(imgs.length-1,Math.max(0,i))*tr.clientWidth,behavior:'smooth'}),
      mark=()=>{const c=Math.min(imgs.length-1,Math.max(0,cur()));dots.forEach((x,k)=>x.classList.toggle('on',k===c));pv.disabled=c===0;nx.disabled=c===imgs.length-1};
    tr.addEventListener('scroll',mark,{passive:true});mark();
    h.append(el('div',{class:'pp-dots'},...dots),pv,nx);
  }
  return h}
const SRE=/^\/s\/([a-z0-9-]{2,40})$/;
function openDlg(s,mode){
  const d=$('#dlg'),b=$('#dbody'),st=ST[s.status]||ST.working;b.replaceChildren();
  const fd=t=>new Date(t).toLocaleDateString('vi-VN'),rows=t=>String(t||'').split('\n').map(x=>x.trim()).filter(Boolean);
  const cc=el('button',{class:'btn primary rp',type:'button',text:'Copy code',onclick:()=>copyCode(s,cc)});
  const cl=el('button',{class:'btn rp',type:'button',text:'Copy loadstring',onclick:()=>copyCmd(s,cl)});
  const lk=el('button',{class:'btn rp',type:'button',text:'Copy link',onclick:()=>copyText(location.origin+'/s/'+s.id).then(ok=>flash(lk,ok?'Đã copy link':'Không copy được'))});
  const dl=el('a',{class:'btn rp',href:'/api/download/'+s.id,download:s.id+'.lua',text:'Download'});
  const pre=el('pre',{class:'cmd pvc',text:'Đang tải...'}),pw=el('div',{},el('div',{class:'pp-h',text:'Xem trước code'}),pre);
  const vw=el('div',{class:'vwrap'});
  fetch('/api/versions/'+s.id).then(r=>r.ok?r.json():[]).catch(()=>[]).then(list=>{
    if(!list.length&&s.version)list=[{version:s.version,changelog:s.changelog||'',created_at:s.updated_at}];
    if(!list.length){vw.remove();return}
    let cur=list[0];const many=list.length>1;
    const lab=el('span',{class:'vsel-t'}),
      pick=el('button',{class:'vsel rp',type:'button','aria-haspopup':'listbox','aria-expanded':'false','aria-label':'Chọn phiên bản'},lab,many?ic(IC.down,'vsel-c'):''),
      menu=el('div',{class:'vmenu',role:'listbox'}),
      tlab=el('span'),tg=el('button',{class:'vtog',type:'button','aria-expanded':'false'},ic(IC.right,'vtog-c'),tlab),
      txt=el('div',{class:'vtxt'}),box=el('div',{class:'vbox'},el('div',{class:'vin'},txt));
    menu.hidden=true;
    const setMenu=(o)=>{menu.hidden=!o;pick.setAttribute('aria-expanded',String(o));pick.classList.toggle('open',o)};
    menu._close=()=>setMenu(false);
    const opts=list.map(v=>{const o=el('button',{class:'vopt',type:'button',role:'option'},el('span',{text:v.version}),el('small',{text:fd(v.created_at)}));o.onclick=()=>{cur=v;show();setMenu(false)};return o});
    const show=()=>{lab.textContent=cur.version+' · '+fd(cur.created_at);tlab.textContent='Có gì mới ở '+cur.version;txt.textContent=cur.changelog||'Không có ghi chú.';
      opts.forEach((o,k)=>{const on=list[k]===cur;o.classList.toggle('on',on);o.setAttribute('aria-selected',String(on))})};
    if(many){menu.append(...opts);pick.onclick=()=>{setMenu(menu.hidden);if(!menu.hidden)menu.scrollIntoView({block:'nearest',behavior:'smooth'})}}else pick.classList.add('one');
    tg.onclick=()=>{const o=!box.classList.contains('open');box.classList.toggle('open',o);tg.classList.toggle('open',o);tg.setAttribute('aria-expanded',String(o))};
    vw.addEventListener('keydown',(e)=>{if(e.key==='Escape'&&!menu.hidden){e.preventDefault();e.stopPropagation();setMenu(false)}});
    vw.append(el('div',{class:'pp-h',text:'Lịch sử phiên bản'}),el('div',{class:'vpick'},pick,menu),tg,box);show()});
  const imgs=(Array.isArray(s.images)&&s.images.length?s.images:[s.image_url]).map(safeUrl).filter(Boolean),kurl=safeUrl(s.key_url),hw=rows(s.howto),ft=rows(s.features);
  const stat=(icon,val,lab)=>el('div',{class:'pp-st'},ic(icon),el('b',{text:val}),el('span',{text:lab}));
  const kv=[['Phiên bản',s.version],['Cập nhật',fd(s.updated_at)],s.created_at?['Ngày đăng',fd(s.created_at)]:null,s.executors?['Hỗ trợ',s.executors]:null].filter(x=>x&&x[1]);
  const sec=(t,...k)=>el('div',{},el('div',{class:'pp-h',text:t}),...k);
  b.append(el('div',{class:'pp-top'},el('button',{class:'dclose',type:'button','aria-label':'Đóng',onclick:()=>d.close()},ic(IC.x))),
    popHero(imgs,st),
    el('div',{class:'pp-pad'},
      el('div',{class:'pp-head'},el('h3',{class:'pp-title',text:s.title}),(s.game||s.version)?el('div',{class:'pp-chips'},s.game?el('span',{class:'pp-chip game',text:s.game}):'',s.version?el('span',{class:'pp-chip',text:s.version}):''):''),
      s.has_key?el('div',{class:'pp-key',role:'note'},el('span',{class:'pp-key-i'},ic(IC.key)),el('div',{},el('b',{text:'Script này cần Key để chạy trong game'}),s.key_note?el('p',{text:s.key_note}):'',kurl?el('a',{class:'pp-key-btn rp',href:kurl,target:'_blank',rel:'noopener noreferrer'},ic(IC.ext),'Lấy Key'):'')):'',
      s.description?el('p',{class:'pp-desc',text:s.description}):'',
      el('div',{class:'pp-stats'},stat(IC.play,nf(s.runs||0),'Lượt chạy'),stat(IC.copy,nf(s.copies||0),'Lượt copy'),s.lines?stat(IC.code,String(s.lines),'dòng · '+(s.size/1024).toFixed(1)+' KB'):''),
      ft.length?sec('Tính năng',el('ul',{class:'pp-feat'},...ft.map(t=>el('li',{},ic(IC.check),el('span',{text:t}))))):'',
      hw.length?sec('Hướng dẫn sử dụng',hw.length>1?el('ol',{class:'pp-steps'},...hw.map(t=>el('li',{},el('span',{text:t})))):el('p',{class:'howto',text:hw[0]})):'',
      kv.length?el('div',{class:'pp-kv'},...kv.map(([k,v])=>el('div',{class:'pp-r'},el('span',{text:k}),el('b',{text:v})))):'',
      vw,pw,D.raw_url?el('pre',{class:'cmd',text:cmdOf(s)}):'',
      el('div',{class:'pp-more'},lk,rawLink(s,'btn rp'),dl)),
    el('div',{class:'pp-bar'},cc,D.raw_url?cl:''));
  fetch('/api/preview/'+s.id).then(r=>r.ok?r.text():'').then(t=>{if(t)pre.textContent=t;else pw.remove()}).catch(()=>pw.remove());
  d.showModal();d.scrollTop=0;
  if(mode!=='pop')fetch('/api/open/'+s.id,{method:'POST'}).catch(()=>{});
  if(mode==='init')history.replaceState({s:s.id,init:1},'','/s/'+s.id);else if(mode!=='pop')history.pushState({s:s.id},'','/s/'+s.id)}
$('#dlg').addEventListener('close',()=>{const st=history.state;if(st&&st.s){if(st.init)history.replaceState(null,'','/');else history.back()}});
addEventListener('popstate',()=>{const d=$('#dlg'),m=location.pathname.match(SRE);if(m){const s=D&&D.scripts.find(x=>x.id===m[1]);if(s&&!d.open)openDlg(s,'pop')}else if(d.open)d.close()});
function openFromUrl(){const m=location.pathname.match(SRE);if(!m||$('#dlg').open)return;const s=D.scripts.find(x=>x.id===m[1]);
  if(!s){history.replaceState(null,'','/');return}
  const t=pickTab(D.tabs,'script',s.tab_id);if(t&&t.id!==TAB){TAB=t.id;drawTabs();drawPanel()}
  openDlg(s,'init')}
$('#dlg').addEventListener('click',(e)=>{if(e.target===e.currentTarget){e.currentTarget.close();return}$$('.vmenu:not([hidden])').forEach(m=>{if(!m.parentNode.contains(e.target))m._close()})});

function moveInd(){const n=$('#tabs'),a=n.querySelector('.tab.active'),i=n.querySelector('.ind');if(a&&i){i.style.setProperty('--x',a.offsetLeft+'px');i.style.setProperty('--w',a.offsetWidth+'px')}}
function drawTabs(){const n=$('#tabs');
  n.replaceChildren(el('span',{class:'ind'}),...D.tabs.map(t=>el('button',{class:'tab rp'+(t.id===TAB?' active':''),role:'tab','aria-selected':String(t.id===TAB),type:'button',text:t.name,onclick:(e)=>{const cb=e.currentTarget;TAB=t.id;$$('#tabs .tab').forEach((b,k)=>{const on=D.tabs[k].id===TAB;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on))});moveInd();cb.scrollIntoView&&cb.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});drawPanel()}})));
  n.classList.toggle('hidden',D.tabs.length<2);
  requestAnimationFrame(()=>{moveInd();n.classList.add('ready')})}
addEventListener('resize',moveInd);document.fonts&&document.fonts.ready.then(moveInd);
new MutationObserver(()=>requestAnimationFrame(moveInd)).observe(document.documentElement,{attributes:true,attributeFilter:['data-ui']});

let F={q:'',st:'all',sort:'def'};
/* icon của link: ảnh máy chủ Discord, biểu tượng nền tảng, hoặc emoji */
function lkIcon(l,info){const slug=(l.icon||'').startsWith('si:')?l.icon.slice(3):'',av=info&&info.icon&&safeUrl(info.icon),cu=l.icon_url&&safeUrl(l.icon_url),ib=el('span',{class:'lk-ic'});
  if(cu)ib.append(isVid(cu)?mkVideo(cu,'lk-av'):el('img',{class:'lk-av',src:cu,alt:'',loading:'lazy'}));else if(av)ib.append(el('img',{class:'lk-av',src:av,alt:'',loading:'lazy'}));else if(PLAT[slug]){const im=el('img',{class:'lk-i',src:'https://cdn.simpleicons.org/'+slug+'/white',alt:'',loading:'lazy'});im.addEventListener('error',()=>im.remove());ib.append(im)}else ib.textContent=l.icon&&!l.icon.startsWith('si:')?l.icon:'🔗';
  return{ib,slug}}
/* v18.3: màu, banner tự đặt cho link (chế độ Social và Link) luôn ghi đè màu và icon mặc định của nền tảng */
function lkLook(a,l,slug){const c=/^#[0-9a-f]{6}$/i.test(l.color||'')?l.color:'';
  if(c){a.style.setProperty('--bc',c);a.classList.add('has-c')}else if(PLAT[slug])a.style.setProperty('--bc',PLAT[slug][1]);
  const u=l.banner_url&&safeUrl(l.banner_url);if(!u)return;
  a.classList.add('has-bn');const b=el('span',{class:'lk-bn'});b.append(isVid(u)?mkVideo(u,'lk-bnm'):el('img',{class:'lk-bnm',src:u,alt:'',loading:'lazy'}));a.prepend(b)}
function blkSocial(items){const box=el('div',{class:'links'+(((D.settings||{}).layout||{}).links==='grid'?'':' list')});items.forEach((l,i)=>{const href=safeUrl(l.url);if(!href)return;
    const info=l.info,{ib,slug}=lkIcon(l,info);
    const a=el('a',{class:'link sp rp rv',href,target:'_blank',rel:'noopener noreferrer'});
    a.append(ib,el('span',{class:'lk-tx'},el('b',{text:l.label}),el('small',{text:info?info.name:host(href)})),ic(IC.arrow,'lk-ar'));
    if(l.note)a.append(el('p',{class:'lk-note',text:l.note}));
    if(info)a.append(el('div',{class:'lk-st'},el('span',{},el('i',{class:'on'}),(info.online||0).toLocaleString('vi-VN')+' online'),el('span',{},ic(IC.users),(info.members||0).toLocaleString('vi-VN')+' thành viên')));a.style.setProperty('--i',i+2);lkLook(a,l,slug);box.append(a)});return box}
/* chế độ Link: link chia sẻ, có mô tả hiện đầy đủ */
function blkLink(items){const box=el('div',{class:'shl'});items.forEach((l,i)=>{const href=safeUrl(l.url);if(!href)return;
    const{ib,slug}=lkIcon(l);ib.className='shl-ic';
    const a=el('a',{class:'shl-i sp rp rv',href,target:'_blank',rel:'noopener noreferrer'});
    const tx=el('span',{class:'shl-tx'},el('b',{text:l.label}));if(l.note)tx.append(el('span',{class:'shl-n',text:l.note}));tx.append(el('small',{class:'shl-h',text:host(href)}));
    a.append(ib,tx,ic(IC.arrow,'lk-ar'));a.style.setProperty('--i',i+2);lkLook(a,l,slug);box.append(a)});return box}
/* chế độ Ảnh & video: lưới ảnh, bấm để xem lớn; link không tải được thì mở như link thường */
function openMedia(l,href,v){const d=$('#mdlg'),m=v?el('video',{src:href,controls:'',autoplay:'',loop:'',playsinline:''}):el('img',{src:href,alt:l.label||''}),cp=[l.label,l.note].filter(Boolean).join(' · ');
  $('#mbody').replaceChildren(m,...(cp?[el('div',{class:'ml-cap',text:cp})]:[]));d.showModal()}
function mediaGrid(items){const g=el('div',{class:'mg'});items.forEach((l,i)=>{const href=safeUrl(l.url);if(!href)return;
    const v=isVid(href),b=el('button',{class:'mg-i sp rp rv',type:'button','aria-label':l.label||'Xem lớn'});b.style.setProperty('--i',i+2);let bad=false;
    const th=v?mkVideo(href):el('img',{src:href,alt:l.label||'',loading:'lazy'});
    th.addEventListener('error',()=>{bad=true;th.replaceWith(el('span',{class:'mg-ph',text:'🔗'}))});
    b.append(th);if(l.label)b.append(el('span',{class:'mg-cap',text:l.label}));
    b.onclick=()=>{if(bad)open(href,'_blank','noopener');else openMedia(l,href,v)};g.append(b)});return g}
/* v20: link TikTok / YouTube trong tab Ảnh & video được nhúng. Chưa bấm thì chỉ là khung (không tải gì của bên thứ ba); bấm mới nạp iframe */
function blkEmbed(items){const g=el('div',{class:'eg'});items.forEach((l,i)=>{const e=embedOf(safeUrl(l.url));if(!e)return;
    const c=el('div',{class:'emb sp rv '+e.p+(e.ratio==='9/16'?' tall':'')}),f=el('button',{class:'emb-f rp',type:'button','aria-label':'Phát video '+(l.label||e.label)});c.style.setProperty('--i',i+2);
    if(e.thumb)f.style.backgroundImage='url("'+e.thumb+'")';
    f.append(el('span',{class:'emb-pl'},ic(IC.play)),el('span',{class:'emb-lb'},el('b',{text:l.label||(e.label+' video')}),el('small',{text:e.label})));
    f.onclick=()=>{const fr=el('iframe',{class:'emb-v',src:e.src+(e.p==='youtube'?'?autoplay=1&rel=0&playsinline=1':''),title:l.label||e.label,allow:'autoplay; encrypted-media; fullscreen; picture-in-picture',referrerpolicy:'strict-origin-when-cross-origin'});
      fr.setAttribute('allowfullscreen','');fr.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation');c.classList.add('on');f.replaceWith(fr)};
    c.append(f);if(l.note)c.append(el('p',{class:'emb-n',text:l.note}));g.append(c)});return g}
function blkMedia(items){const emb=[],rest=[];items.forEach(l=>{const h=safeUrl(l.url);(h&&embedOf(h)?emb:rest).push(l)});
  if(!emb.length)return mediaGrid(rest);const w=el('div',{class:'mw'});if(rest.length)w.append(mediaGrid(rest));w.append(blkEmbed(emb));return w}
$('#mdlg').addEventListener('click',(e)=>{if(e.target===e.currentTarget)e.currentTarget.close()});
$('#mx').addEventListener('click',()=>$('#mdlg').close());
$('#mdlg').addEventListener('close',()=>{const v=$('#mbody video');if(v)v.pause();$('#mbody').replaceChildren()});
/* ghi chú nhiều mục (v18.2): mỗi ghi chú là một thẻ có mũi tên; mở ra thấy nội dung và giờ tạo, giờ cập nhật chi tiết. Chỉ có một ghi chú thì mở sẵn */
const fdt=(ms,full)=>new Date(ms).toLocaleString('vi-VN',full?{hour:'2-digit',minute:'2-digit',second:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'}:{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
function blkNote(t){const L=parseNotes(t.body).filter(n=>n.title||n.text),box=el('div',{class:'ntl'});
  L.forEach((n,i)=>{const open=L.length===1,first=(n.text.split('\n').find(x=>x.trim())||'').trim().slice(0,70),title=n.title||first||'Ghi chú';
    const tm=el('div',{class:'nt-tm'},el('span',{text:'Tạo lúc: '+(n.c?fdt(n.c,1):'chưa rõ')}),el('span',{text:'Cập nhật lúc: '+(n.u?fdt(n.u,1):'chưa rõ')}));
    const vb=el('div',{class:'vbox'+(open?' open':'')},el('div',{class:'vin'},el('div',{class:'nt-in'},...(n.text?[el('div',{class:'nt-x',text:n.text})]:[]),tm)));
    const hd=el('button',{class:'nt-h rp',type:'button','aria-expanded':String(open)},ic(IC.right,'nt-c'),el('span',{class:'nt-tt'},el('b',{text:title}),...(n.u?[el('small',{text:'Cập nhật '+fdt(n.u)})]:[])));
    hd.onclick=()=>{const on=hd.getAttribute('aria-expanded')!=='true';hd.setAttribute('aria-expanded',String(on));vb.classList.toggle('open',on)};
    const c=el('article',{class:'nt rv'},hd,vb);c.style.setProperty('--i',i+2);box.append(c)});
  return box}
function blkScript(items,tools){const w=el('div'),g=el('div',{class:'grid'});
    const fill=()=>{const f=tools?F:{q:'',st:'all',sort:'def'},q=f.q.trim().toLowerCase();let l=items.filter(s=>(f.st==='all'||s.status===f.st)&&(!q||(s.title+' '+(s.game||'')+' '+(s.description||'')).toLowerCase().includes(q)));
      if(f.sort==='runs')l=[...l].sort((a,b)=>b.runs-a.runs);else if(f.sort==='new')l=[...l].sort((a,b)=>b.updated_at-a.updated_at);
      g.replaceChildren(...(l.length?l.map((s,i)=>card(s,i)):[el('div',{class:'empty',style:'grid-column:1/-1',text:'Không có script nào khớp.'})]))};
    if(tools&&items.length>=3){
      const q=el('input',{class:'sq',type:'search',placeholder:'Tìm script hoặc game...','aria-label':'Tìm script'});q.value=F.q;q.addEventListener('input',()=>{F.q=q.value;fill()});
      const chips=[['all','Tất cả'],['working','Đang chạy'],['patched','Đã patch'],['outdated','Cũ']].map(([v,l])=>{const b=el('button',{class:'fchip'+(F.st===v?' on':''),type:'button',text:l,onclick:()=>{F.st=v;chips.forEach(c=>c.classList.toggle('on',c._v===v));fill()}});b._v=v;return b});
      const so=el('select',{class:'ssel','aria-label':'Sắp xếp'},...[['def','Mặc định'],['new','Mới cập nhật'],['runs','Nhiều lượt chạy']].map(([v,l])=>el('option',{value:v,text:l})));so.value=F.sort;so.addEventListener('change',()=>{F.sort=so.value;fill()});
      w.append(el('div',{class:'tools'},q,so,el('div',{class:'fchips'},...chips)))}
    w.append(g);fill();return w}
const BH={social:'Mạng xã hội',link:'Link',media:'Ảnh & video',script:'Script'};
/* một tab có thể có nhiều khối (tab Khác): ghi chú, social, link, ảnh & video, script.
   v20: mục nào đã vào section thì nằm trong section đó; mục chưa vào section hiện trước, rồi tới các section theo thứ tự */
const OPEN={},CARD='.scard,.link,.shl-i,.mg-i,.emb';
function blocksFor(t,sid){const SC=(x)=>secOf(D.sections,t.id,x),out=[];
  tabFeats(t).forEach(k=>{
    if(k==='note'){if(!sid&&parseNotes(t.body).some(n=>n.title||n.text))out.push(['note',blkNote(t)])}
    else if(LINK_FEATS.includes(k)){const it=D.links.filter(l=>{const pl=linkPlace(D.tabs,l);return pl.tab&&pl.tab.id===t.id&&pl.mode===k&&SC(l)===sid});if(it.length)out.push([k,({social:blkSocial,link:blkLink,media:blkMedia})[k](it)])}
    else if(k==='script'){const it=D.scripts.filter(s=>{const x=pickTab(D.tabs,'script',s.tab_id);return x&&x.id===t.id&&SC(s)===sid});if(it.length)out.push(['script',blkScript(it,!sid&&(t.kind==='custom'?tabOpts(t).tools:true))])}});
  return out}
function addBlocks(box,blocks){blocks.forEach(([k,n])=>{const w=el('section',{class:'blk'});if(blocks.length>1&&BH[k])w.append(el('h3',{class:'blk-h',text:BH[k]}));w.append(n);box.append(w)})}
function blkSection(s,blocks){const sv=OPEN[s.id],open=sv===undefined?!!s.open:sv,inn=el('div',{class:'sec-in'}),w=el('section',{class:'sec rv'+(open?' open':'')},el('div'),el('div',{class:'sec-bx'},inn)),cnt=el('span',{class:'sec-n'}),
    hd=el('button',{class:'sec-h rp',type:'button','aria-expanded':String(open)},el('span',{class:'sec-t'},el('b',{text:s.title}),...(s.sub?[el('small',{text:s.sub})]:[])),cnt,ic(IC.down,'sec-c'));
  hd.onclick=()=>{const o=!w.classList.contains('open');w.classList.toggle('open',o);hd.setAttribute('aria-expanded',String(o));OPEN[s.id]=o};
  let q,none;if(s.search){q=el('input',{class:'sq sec-q',type:'search',placeholder:'Tìm trong '+s.title+'...','aria-label':'Tìm trong section '+s.title});none=el('div',{class:'empty',hidden:'',text:'Không có kết quả.'});inn.append(q)}
  addBlocks(inn,blocks);if(none)inn.append(none);
  const cards=[...inn.querySelectorAll(CARD)];cnt.textContent=String(cards.length);
  if(q)q.addEventListener('input',()=>{const v=q.value.trim().toLowerCase();let n=0;cards.forEach(c=>{const hit=!v||(c.textContent+' '+(c.getAttribute('aria-label')||'')).toLowerCase().includes(v);c.hidden=!hit;if(hit)n++});none.hidden=n>0||!v});
  w.firstChild.replaceWith(hd);return w}
function drawPanel(){const t=D.tabs.find(x=>x.id===TAB),p=$('#panel');p.replaceChildren();if(!t)return;
  const top=blocksFor(t,0),secs=(D.sections||[]).filter(s=>s.tab_id===t.id).map(s=>[s,blocksFor(t,s.id)]).filter(([,b])=>b.length);
  if(!top.length&&!secs.length){p.append(el('div',{class:'empty',text:'Chưa có gì ở tab này.'}));return}
  addBlocks(p,top);secs.forEach(([s,b])=>p.append(blkSection(s,b)))}

const nf=(n)=>n>=1e6?(n/1e6).toFixed(1).replace(/\.0$/,'')+'M':n>=1e3?(n/1e3).toFixed(1).replace(/\.0$/,'')+'K':String(n);
/* khối dưới thẻ hồ sơ (chỉ hiện ở giao diện máy tính): số liệu chung và 2 script mới cập nhật */
function drawSide(){const b=$('#sidex'),L=D.scripts||[];b.replaceChildren();b.classList.toggle('hidden',!L.length);if(!L.length)return;
  const sum=(k)=>L.reduce((a,s)=>a+(Number(s[k])||0),0);
  b.append(el('div',{class:'sx-st'},...[['Script',L.length],['Lượt chạy',sum('runs')],['Lượt copy',sum('copies')]].map(([k,v])=>el('div',{},el('b',{text:nf(v)}),el('span',{text:k})))));
  const nw=[...L].sort((a,b)=>b.updated_at-a.updated_at).slice(0,2);
  b.append(el('div',{class:'sx-h',text:'Mới cập nhật'}),...nw.map((s)=>{const img=safeUrl(s.image_url),r=el('button',{class:'sx-row',type:'button','aria-label':'Xem chi tiết '+s.title},
    el('span',{class:'sx-th'},img?el('img',{src:img,alt:'',loading:'lazy'}):ic(IC.code)),
    el('span',{class:'sx-tx'},el('b',{text:s.title}),el('small',{text:[s.version,new Date(s.updated_at).toLocaleDateString('vi-VN')].filter(Boolean).join(' · ')})),ic(IC.right,'sx-ar'));
    r.onclick=()=>openDlg(s);return r}))}
function render(d){D=d;applyLook(d.settings,'bio');const pr=d.profile;$('#prof').replaceChildren(buildProfile(pr));drawSide();document.title=pr.name||'NOIR';startFx(pr.effect);
  if(!TAB||!d.tabs.some(t=>t.id===TAB))TAB=(d.tabs[0]||{}).id;drawTabs();drawPanel();openFromUrl()}
$('#year').textContent=new Date().getFullYear();
fetch('/api/site').then(r=>r.json()).then(render).catch(()=>{$('#prof').textContent='Không tải được dữ liệu, thử lại sau nhé.';$('#panel').replaceChildren()});
(async()=>{const info={ref:document.referrer,ret:false,scr:screen.width+'x'+screen.height},q=new URLSearchParams(location.search);
  info.tag=q.get('utm_source')||q.get('ref')||q.get('src')||'';
  try{info.ret=!!localStorage.getItem('noir_seen');localStorage.setItem('noir_seen','1')}catch{}
  try{if(navigator.userAgentData){info.plat=navigator.userAgentData.platform;const hv=await navigator.userAgentData.getHighEntropyValues(['model','platformVersion']);info.model=hv.model||'';info.pv=hv.platformVersion||''}}catch{}
  navigator.sendBeacon&&navigator.sendBeacon('/api/hit',new Blob([JSON.stringify(info)],{type:'application/json'}))})();
