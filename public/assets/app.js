const $=(s)=>document.querySelector(s),$$=(s)=>[...document.querySelectorAll(s)];
const ST={working:['Đang chạy','working'],patched:['Đã bị patch','patched'],outdated:['Cũ','outdated']};
const IC={arrow:'M7 17L17 7M9 7h8v8',play:'M8 5v14l11-7z',copy:'M9 9h10v10H9zM5 15V5h10',code:'M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14',x:'M6 6l12 12M18 6L6 18',down:'M6 9l6 6 6-6',right:'M9 6l6 6-6 6',users:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8'};
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
    el('div',{class:'sthumb'},img?el('img',{src:img,alt:'',loading:'lazy'}):el('div',{class:'sph'},ic(IC.code)),el('span',{class:'badge '+st[1],text:st[0]})),
    el('div',{class:'sbody'},
      el('h3',{text:s.title}),s.game?el('div',{class:'smeta',text:s.game}):'',
      el('div',{class:'sstats'},el('span',{title:'Lượt chạy'},ic(IC.play),String(s.runs)),el('span',{title:'Lượt copy'},ic(IC.copy),String(s.copies)))));
  c.style.setProperty('--i',i+2);
  c.onclick=()=>openDlg(s);c.onkeydown=(e)=>{if(e.key==='Enter'&&e.target===c)openDlg(s)};
  return c}

const SRE=/^\/s\/([a-z0-9-]{2,40})$/;
function openDlg(s,mode){
  const d=$('#dlg'),b=$('#dbody'),st=ST[s.status]||ST.working,img=safeUrl(s.image_url);b.replaceChildren();
  const fd=t=>new Date(t).toLocaleDateString('vi-VN'),rows=t=>String(t||'').split('\n').map(x=>x.trim()).filter(Boolean);
  const cc=el('button',{class:'btn primary rp',type:'button',text:'Copy code',onclick:()=>copyCode(s,cc)});
  const cl=el('button',{class:'btn rp',type:'button',text:'Copy lệnh loadstring',onclick:()=>copyCmd(s,cl)});
  const lk=el('button',{class:'btn rp',type:'button',text:'Copy link script',onclick:()=>copyText(location.origin+'/s/'+s.id).then(ok=>flash(lk,ok?'Đã copy link':'Không copy được'))});
  const dl=el('a',{class:'btn rp',href:'/api/download/'+s.id,download:s.id+'.lua',text:'Download'});
  const pre=el('pre',{class:'cmd pvc',text:'Đang tải...'}),pw=el('div',{},el('div',{class:'pvh',text:'Xem trước code (cuộn để xem thêm)'}),pre);
  const cells=[['Phiên bản',s.version||'–'],['Cập nhật',fd(s.updated_at)],s.created_at?['Ngày đăng',fd(s.created_at)]:null,s.lines?['Độ dài',s.lines+' dòng, '+(s.size/1024).toFixed(1)+' KB']:null,
    s.executors?['Hỗ trợ',s.executors]:null,['Lượt chạy',String(s.runs)],['Lượt copy',String(s.copies)]].filter(Boolean);
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
    vw.append(el('div',{class:'pvh',text:'Lịch sử phiên bản'}),el('div',{class:'vpick'},pick,menu),tg,box);show()});
  b.append(el('button',{class:'dclose',type:'button','aria-label':'Đóng',onclick:()=>d.close()},ic(IC.x)),
    img?el('img',{class:'dimg',src:img,alt:''}):'',
    el('div',{class:'card-head'},el('h3',{text:s.title}),el('span',{class:'badge '+st[1],text:st[0]})),
    s.game?el('div',{class:'meta',text:s.game}):'',
    s.description?el('p',{class:'desc',style:'white-space:pre-line',text:s.description}):'',
    el('div',{class:'info'},...cells.map(([k,v])=>el('div',{},el('span',{text:k}),el('b',{text:v})))),
    rows(s.features).length?el('div',{},el('div',{class:'pvh',text:'Tính năng'}),el('ul',{class:'feat'},...rows(s.features).map(t=>el('li',{text:t})))):'',
    s.howto?el('div',{},el('div',{class:'pvh',text:'Hướng dẫn sử dụng'}),el('p',{class:'howto',text:s.howto})):'',
    vw,pw,D.raw_url?el('pre',{class:'cmd',text:cmdOf(s)}):'',
    el('div',{class:'dact'},cc,D.raw_url?cl:'',lk,rawLink(s,'btn rp'),dl));
  fetch('/api/preview/'+s.id).then(r=>r.ok?r.text():'').then(t=>{if(t)pre.textContent=t;else pw.remove()}).catch(()=>pw.remove());
  d.showModal();
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
function blkMedia(items){const g=el('div',{class:'mg'});items.forEach((l,i)=>{const href=safeUrl(l.url);if(!href)return;
    const v=isVid(href),b=el('button',{class:'mg-i sp rp rv',type:'button','aria-label':l.label||'Xem lớn'});b.style.setProperty('--i',i+2);let bad=false;
    const th=v?mkVideo(href):el('img',{src:href,alt:l.label||'',loading:'lazy'});
    th.addEventListener('error',()=>{bad=true;th.replaceWith(el('span',{class:'mg-ph',text:'🔗'}))});
    b.append(th);if(l.label)b.append(el('span',{class:'mg-cap',text:l.label}));
    b.onclick=()=>{if(bad)open(href,'_blank','noopener');else openMedia(l,href,v)};g.append(b)});return g}
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
    const fill=()=>{const q=F.q.trim().toLowerCase();let l=items.filter(s=>(F.st==='all'||s.status===F.st)&&(!q||(s.title+' '+(s.game||'')+' '+(s.description||'')).toLowerCase().includes(q)));
      if(F.sort==='runs')l=[...l].sort((a,b)=>b.runs-a.runs);else if(F.sort==='new')l=[...l].sort((a,b)=>b.updated_at-a.updated_at);
      g.replaceChildren(...(l.length?l.map((s,i)=>card(s,i)):[el('div',{class:'empty',style:'grid-column:1/-1',text:'Không có script nào khớp.'})]))};
    if(tools&&items.length>=3){
      const q=el('input',{class:'sq',type:'search',placeholder:'Tìm script hoặc game...','aria-label':'Tìm script'});q.value=F.q;q.addEventListener('input',()=>{F.q=q.value;fill()});
      const chips=[['all','Tất cả'],['working','Đang chạy'],['patched','Đã patch'],['outdated','Cũ']].map(([v,l])=>{const b=el('button',{class:'fchip'+(F.st===v?' on':''),type:'button',text:l,onclick:()=>{F.st=v;chips.forEach(c=>c.classList.toggle('on',c._v===v));fill()}});b._v=v;return b});
      const so=el('select',{class:'ssel','aria-label':'Sắp xếp'},...[['def','Mặc định'],['new','Mới cập nhật'],['runs','Nhiều lượt chạy']].map(([v,l])=>el('option',{value:v,text:l})));so.value=F.sort;so.addEventListener('change',()=>{F.sort=so.value;fill()});
      w.append(el('div',{class:'tools'},q,so,el('div',{class:'fchips'},...chips)))}
    w.append(g);fill();return w}
const BH={social:'Mạng xã hội',link:'Link',media:'Ảnh & video',script:'Script'};
/* một tab có thể có nhiều khối (tab Khác): ghi chú, social, link, ảnh & video, script */
function drawPanel(){const t=D.tabs.find(x=>x.id===TAB),p=$('#panel');p.replaceChildren();if(!t)return;
  const blocks=[];
  tabFeats(t).forEach(k=>{
    if(k==='note'){if(parseNotes(t.body).some(n=>n.title||n.text))blocks.push(['note',blkNote(t)])}
    else if(LINK_FEATS.includes(k)){const it=D.links.filter(l=>{const pl=linkPlace(D.tabs,l);return pl.tab&&pl.tab.id===t.id&&pl.mode===k});if(it.length)blocks.push([k,({social:blkSocial,link:blkLink,media:blkMedia})[k](it)])}
    else if(k==='script'){const it=D.scripts.filter(s=>{const x=pickTab(D.tabs,'script',s.tab_id);return x&&x.id===t.id});if(it.length)blocks.push(['script',blkScript(it,t.kind==='custom'?tabOpts(t).tools:true)])}});
  if(!blocks.length){p.append(el('div',{class:'empty',text:'Chưa có gì ở tab này.'}));return}
  blocks.forEach(([k,n])=>{const w=el('section',{class:'blk'});if(blocks.length>1&&BH[k])w.append(el('h3',{class:'blk-h',text:BH[k]}));w.append(n);p.append(w)})}

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
