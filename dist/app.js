import {ATTRIBUTES,ENGINE_VERSION,createProject,validateProject,validateEvidence,confirmedAliases,activeFacts,hash,normalizeValue,parseChapters,extractClaims,checkDraft,randomId} from './engine.js';
import {openDatabase,getProjects,saveProject,deleteProject} from './storage.js';
import {readManuscript} from './files.js';
import {SAMPLE_NAME,SAMPLE_OLD,SAMPLE_NEW,SAMPLE_NEW_TITLE} from './sample.js';
import {bookBuddySvg,buddyMessage,petBuddy,celebrate} from './cute.js';
import {AI_VERSION,AI_LIMITS,AI_MODELS,buildSemanticContext,semanticFindings} from './semantic.js';

const paths={
  book:'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 3H20v19H6.5A2.5 2.5 0 0 1 4 19.5v-14A2.5 2.5 0 0 1 6.5 3Z M8 7h8M8 10h6',
  pages:'M8 3h11v15H8zM5 6H3v15h12v-2M11 7h5M11 10h5M11 13h3',
  settings:'M4 5h16M4 12h16M4 19h16M8 3v4M16 10v4M9 17v4',
  check:'M9 12l2 2 4-5M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z',
  history:'M3 11a9 9 0 1 1 2.5 7M3 4v7h7M12 7v5l3 2',
  upload:'M12 16V3m-5 5 5-5 5 5M4 16v4h16v-4',
  arrow:'M4 12h16m-5-5 5 5-5 5',
  chevron:'m9 5 7 7-7 7',
  plus:'M12 4v16M4 12h16',
  close:'m6 6 12 12M6 18 18 6',
  tick:'m5 12 4 4L19 6',
  external:'M14 3h7v7m0-7L10 14M10 3H4v17h17v-6',
  download:'M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4',
  lock:'M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3M12 14v3',
  info:'M12 11v6M12 7v.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  alert:'M12 8v5m0 4v.01M10 3 2 19h20L14 3Z',
  trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  edit:'m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z',
  search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
};
const icon=(name,size=18)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.book}"/></svg>`;
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>new Intl.NumberFormat('zh-CN').format(n||0);
const date=s=>new Date(s).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
const nextIndex=p=>Math.max(0,...p.chapters.map(c=>c.index))+1;
const uid=randomId;
const $=s=>document.querySelector(s);
const state={projects:[],project:null,page:'library',factTab:'pending',query:'',factPage:0,chapterPage:0,filter:'all',sessionId:null,addImport:false,importText:'',busy:false,busyLabel:'',storageError:'',saved:true,reader:null,manual:null};
let saveTimer,toastTimer,saveQueue=Promise.resolve(),worker,taskNo=0;
// Credentials stay in this tab's memory. Never attach them to a project/backup.
let aiKey='',aiModel='deepseek-flash',aiPending=null,aiAbort=null;
const REVIEW_AREAS=[
  {name:'人物基础设定',detail:'年龄、惯用手、瞳色、血型、出生地等是否前后一致。',example:'前文惯用左手，新章却写成惯用右手。'},
  {name:'关系与身份',detail:'父母关系、别名、所属阵营与身份描述是否对应。',example:'同一人物的生父在前后章节中变成两个人。'},
  {name:'能力与身体状态',detail:'人物已有的能力、伤病与新章动作是否相容。',example:'前文双目失明，新章看清远处旗号，却未交代康复。'},
  {name:'物品状态与归属',detail:'物品交给了谁、是否丢失或毁坏，后续使用是否衔接。',example:'已经熔毁的原钥匙再次出现，且没有重铸解释。'},
  {name:'关键数值',detail:'固定编制、长度等已明确的数值与单位是否对得上。',example:'固定编制从三百人变成五百人，需核对是否调整了设定。'},
  {name:'地点与事件衔接',detail:'地点描述、事件先后和因果是否出现前后冲突线索。',example:'新章把前文尚未完成的事件当作已经完成，需核对叙述时间。'},
];
const REVIEW_BOUNDARY='当前聚焦前后文一致性；暂不提供错别字校对、文笔打分、商业潜力评估、抄袭或版权鉴定、发布合规审核。';
const REVIEW_RULE_CRITERIA='对同一对象、同一属性做规范化比较；稳定属性不同标为明确属性差异，年龄、阵营、生死状态或带语境线索的差异交由作者判断。';
const REVIEW_AI_CRITERIA='只比较本轮材料，先核对对象、时间与语境，排除已有解释的正常变化；两处描述难以同时成立时提出疑点，时间或指代不确定时说明限制。';
const tasks=new Map();
try {
  worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{const task=tasks.get(data.id);if(!task)return;clearTimeout(task.timeout);tasks.delete(data.id);data.error?task.reject(new Error(data.error)):task.resolve(data);};
  worker.onerror=()=>{for(const task of tasks.values()){clearTimeout(task.timeout);task.reject(new Error('检查进程未能启动，请刷新后重试。'));}tasks.clear();};
} catch {worker=null;}
async function runTask(data) {
  if(!worker) {
    await new Promise(resolve=>setTimeout(resolve,30));
    const start=performance.now();let result;
    if(data.type==='import'){const chapters=parseChapters(data.text,data.name,data.offset);result={chapters,facts:extractClaims(chapters)};}
    else result=checkDraft(data.input);
    return {result,elapsedMs:Math.round(performance.now()-start)};
  }
  const id=++taskNo;
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{tasks.delete(id);reject(new Error('本次处理超过一分钟，请分卷或分章后重试。'));},60000);
    tasks.set(id,{resolve,reject,timeout});worker.postMessage({...data,id});
  });
}
function toast(message,error=false) {
  const el=$('#toast');el.textContent=message;el.className='visible'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.className='',error?7000:3800);
}
async function persist(p=state.project) {
  if(!p)return;
  state.saved=false;updateSaveStatus();
  // Serialize saves and take the snapshot when the previous write has finished.
  saveQueue=saveQueue.catch(()=>{}).then(async()=>{
    const revision=await saveProject(structuredClone(p),p.revision||0);p.revision=revision;
    state.saved=true;state.storageError='';updateSaveStatus();
  }).catch(error=>{state.storageError=error.message;state.saved=false;updateSaveStatus();toast(error.message,true);});
  await saveQueue;
}
function touch(immediate=false) {
  const p=state.project;p.updatedAt=new Date().toISOString();state.saved=false;updateSaveStatus();clearTimeout(saveTimer);
  if(immediate)return persist(p);
  saveTimer=setTimeout(()=>persist(p),450);
}
async function flush(){clearTimeout(saveTimer);await persist();}
function updateSaveStatus(){const el=$('#save-status');if(el)el.textContent=state.storageError?'未保存 · 请导出备份':state.saved?'已保存到此浏览器':'正在保存…';const err=$('#storage-error');if(err){err.hidden=!state.storageError;err.textContent=state.storageError;}}
async function busy(label,fn) {
  if(state.busy)return;state.busy=true;state.busyLabel=label;render();
  try{return await fn();}catch(error){toast(error.message||'操作未完成，请重试。',true);}
  finally{state.busy=false;state.busyLabel='';render();}
}
const btn=(label,action,cls='',extra='')=>`<button class="btn ${cls}" data-action="${action}" ${extra}>${label}</button>`;
const pill=(text,cls='')=>`<span class="pill ${cls}">${h(text)}</span>`;
function currentSession(){return state.project.sessions.find(s=>s.id===state.sessionId)||null;}
function canonSignature(p){return hash(JSON.stringify({facts:p.facts.filter(f=>f.status==='confirmed').map(f=>[f.id,f.entity,f.attribute,f.value]),aliases:p.aliases}));}
function render() {
  const p=state.project;if(!p)return;
  const navs=[['library','pages','稿件库',p.chapters.length],['facts','settings','设定确认',p.facts.filter(f=>f.status==='pending').length],['check','check','新章检查',null],['history','history','检查记录',p.sessions.length]];
  const nav=navs.find(n=>n[0]===state.page);
  $('#app').innerHTML=`${state.busy?'<div class="progress-bar" role="progressbar" aria-label="'+h(state.busyLabel)+'"></div>':''}<div class="shell" aria-busy="${state.busy}">
    <aside class="sidebar"><div class="brand"><div class="brand-mark">${icon('book',23)}</div><div><div class="brand-name">章序</div><div class="brand-sub">STORY CONTINUITY</div></div></div>
      <div class="project-block"><div class="eyebrow">我的作品 / WORKSPACE</div><label class="visually-hidden" for="project-select">切换作品</label><select id="project-select" class="project-select" ${state.busy?'disabled':''}>${state.projects.map(x=>`<option value="${h(x.id)}" ${x.id===p.id?'selected':''}>${h(x.name)}</option>`).join('')}</select>${btn(icon('plus',13)+' 新建作品','new-project','text small','style="margin-top:8px"')}</div>
      <nav class="sidebar-nav" aria-label="工作台导航">${navs.map(n=>`<button class="nav-button ${state.page===n[0]?'active':''}" data-action="navigate" data-page="${n[0]}" ${state.page===n[0]?'aria-current="page"':''}>${icon(n[1],17)}<span>${n[2]}</span>${n[3]?`<span class="count">${n[3]}</span>`:''}</button>`).join('')}</nav>
      <div class="sidebar-bottom"><div><span class="local-dot"></span>稿件保存在本机</div><p style="margin-top:8px">正文与判断记录保存在当前浏览器，请定期导出备份。</p><div class="sidebar-divider"></div><button class="source-link" data-action="about">${icon('info',13)} 检查范围与使用说明</button><div style="margin-top:14px;font-size:9px;letter-spacing:1px">章序 0.2.0 · AI 语义审稿</div></div>
    </aside>
    <div class="main"><header class="topbar"><div class="breadcrumb"><span>写作工作台</span>${icon('chevron',12)}<strong>${nav[2]}</strong></div><div class="row gap8"><span id="save-status" class="save-status">${state.saved?'已保存到此浏览器':'正在保存…'}</span>${btn(icon('spark',14)+' AI 审稿','open-ai','sm')}${btn(icon('download',14)+' 备份','backup','sm')}${btn(icon('info',14),'about','text','aria-label="检查范围与帮助" title="检查范围与帮助"')}</div></header>
      <div id="storage-error" class="app-error" ${state.storageError?'':'hidden'}>${h(state.storageError)}</div>
      <main class="workspace">${state.page==='library'?renderLibrary():state.page==='facts'?renderFacts():state.page==='check'?renderCheck():renderHistory()}</main>
    </div></div>`;
}
function pageHead(eyebrow,title,description,actions='') {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div><div class="heading-extra">${actions?`<div class="heading-actions row wrap gap8">${actions}</div>`:''}<div class="buddy-stage"><button class="book-buddy" data-action="pet-buddy" aria-label="摸摸小章" title="点点小章，收下一点小开心">${bookBuddySvg()}</button><div class="buddy-message" role="status" aria-live="polite" aria-atomic="true">${buddyMessage(state.page)}</div><span class="buddy-name">小章 · 你的书桌搭子</span><div class="buddy-actions" role="group" aria-label="和小章互动"><button class="buddy-gesture" data-action="pet-buddy" data-gesture="pet">摸摸头</button><button class="buddy-gesture" data-action="pet-buddy" data-gesture="snack">喂灵感</button><button class="buddy-gesture" data-action="pet-buddy" data-gesture="highfive">击个掌</button></div></div></div></div>`;
}
function steps(index) {
  const p=state.project,complete=[p.chapters.length>0,p.facts.some(f=>f.status==='confirmed'),p.sessions.length>0];
  return `<nav class="steps" aria-label="使用流程">${['导入旧稿','确认设定','检查新章','保留判断'].map((x,i)=>`<button class="step ${index===i?'current':complete[i]?'complete':''}" data-action="navigate" data-page="${['library','facts','check','history'][i]}" aria-label="第${i+1}步：${x}"><i>${complete[i]&&index!==i?'✓':i+1}</i>${x}</button>`).join('')}</nav>`;
}
function scopeLine(){return `<div class="scope-line">${icon('info',12)}本地规则检查支持 ${Object.keys(ATTRIBUTES).length} 类设定；AI 审稿按所选前文进行语义对照。两者均需作者判断，未检出不代表全稿无误。</div>`;}
function reviewScope(compact=false){
  return `<section class="review-scope ${compact?'compact':'card'}" aria-label="小说审稿范围">
    <div class="review-scope-heading">${icon('book',17)}<h3>我们主要审什么？小说前后文一致性。</h3></div>
    <p>把新章与前文放在一起，找出“设定变了、关系对不上、事情接不起来”的疑点。</p>
    <div class="review-area-tags">${REVIEW_AREAS.map(a=>pill(a.name,'gray')).join('')}</div>
    <p><strong>审核依据：</strong>作者确认的设定、旧稿原文，以及本次新章的上下文。</p>
    <details class="review-scope-details"><summary>展开六类核对示例与能力边界</summary>
      <div class="review-area-grid">${REVIEW_AREAS.map(a=>`<div><h4>${h(a.name)}</h4><p>${h(a.detail)}</p><p class="review-example">例如：${h(a.example)}</p></div>`).join('')}</div>
      <p><strong>本地规则检查：</strong>核对已确认的 12 类设定中的有限明确句式，别名用于归并对象。<strong>AI 审稿：</strong>尝试从上述六类方向理解自然语言与语境；需要模型密钥，实际识别效果尚待真实模型验收。</p>
      <p>回忆、传闻、梦境和已有解释的正常变化需要结合剧情判断。每个疑点均附新旧原文、出处与说明，由作者最终确认。</p>
      <p>${h(REVIEW_BOUNDARY)}AI 只对比本轮发送的前文片段，当前没有完整的全书时间线推演。</p>
    </details>
    <details class="review-scope-details"><summary>审核标准从哪里来？查看判断依据</summary>
      <p>这是章序公开的产品准则，依据作品自身的设定与叙述判断。作者确认的设定必须保留原文出处，未确认的候选不会成为规则基准。</p>
      <div class="review-area-grid">
        <div><h4>1 · 比较相同对象与属性</h4><p>${h(REVIEW_RULE_CRITERIA)}</p><p>确认后的别名用于归并对象；中文数词和同一度量体系的长度会先换算，再比较。</p></div>
        <div><h4>2 · 核对时间和变化解释</h4><p>AI 提示词要求：${h(REVIEW_AI_CRITERIA)}</p><p>回忆、梦境、传闻、伪装、康复和阵营转变需结合剧情。规则仅识别有限文字线索，AI 也可能误解。</p></div>
        <div><h4>3 · 附双侧原文，由作者裁定</h4><p>每条疑点附旧稿原文、新章原文、出处和原因。AI 引文须逐字存在且能唯一定位，无法通过校验的返回会剔除。</p><p>引文存在只证明有出处，不代表判断正确。作者可标记确有错误、正常变化或误报。</p></div>
      </div>
      <p><strong>举个例子：</strong>旧稿“他的双眼已经失明”，新章“他看清了远处的旗号”。AI 应先找康复、特殊能力或叙述时间的解释；有明确解释应跳过，解释缺失才作为疑点。这里只说明准则，尚非真实模型验收案例。</p>
      <p><strong>当前限制：</strong>规则以最近收录章节中的已确认设定为基准，尚未自动推演故事时间；AI 只读本轮发送的材料，片段未提及不等于事情没有发生。没有引用外部行业审稿规范，也尚未经过真实作者样稿的误报、漏检评估。</p>
    </details>
  </section>`;
}
function importCard(){
  return `<section class="card"><div class="card-pad"><div class="row between"><h3>导入已有稿件</h3><span class="split-note">旧稿只需导入一次</span></div>
    <div class="upload-box" id="upload-drop" role="button" tabindex="0" data-action="choose-manuscript" aria-label="选择 TXT、Markdown 或 DOCX 文件"><div class="upload-icon">${icon('upload',26)}</div><strong>选择文件，或将文件拖到这里</strong><span>TXT / Markdown / DOCX · 单个文件不超过 8 MB</span></div>
    <input type="file" id="manuscript-file" class="visually-hidden" accept=".txt,.md,.docx" tabindex="-1">
    <div class="or-line">也可以直接粘贴</div><label for="import-text" class="visually-hidden">旧稿正文</label><textarea id="import-text" class="import-text" placeholder="粘贴你的旧稿…&#10;&#10;支持「第一章 雨夜来客」「第1章」等独占一行的章标题。">${h(state.importText)}</textarea>
    <div class="field-note">按独占一行的「第一章 / 第1章 / Chapter 1」分章；未分章的稿件会保留为单章。</div></div>
    <div class="import-footer"><span class="small muted">${icon('lock',13)} 正文不上传到检查服务器</span>${btn((state.busy?state.busyLabel:'导入并提取设定')+' '+icon('arrow',15),'import-text','primary',state.busy?'disabled':'')}</div>
  </section>`;
}
function demoCard(){return `<div class="demo-card"><div class="demo-art"><div><div class="eyebrow" style="color:#849575;margin-bottom:9px;font-size:9px">FIRST CHAPTER</div><div class="serif">先用一份样稿<br>走完整个流程。</div></div><div class="book-art">渡鸦城纪事</div></div><div class="demo-info"><h3 style="font-size:12px;color:#5d7550">3 章旧稿 + 1 章待检查新稿</h3><p>样稿包含惯用手、瞳色与编制差异，也含回忆和传闻，方便观察检查边界。</p>${btn(icon('spark',14)+' 载入测试样稿','demo')}</div></div><div class="side-note"><h3>从这份旧稿开始积累</h3><div class="note-line">${icon('settings',14)}<span>提取候选设定，由你确认哪些有效。</span></div><div class="note-line">${icon('check',14)}<span>之后只需提交新章，对照已有设定。</span></div><div class="note-line">${icon('history',14)}<span>保存原文证据与判断，方便反复修改。</span></div></div>`;}
function renderLibrary(){
  const p=state.project,chars=p.chapters.reduce((n,c)=>n+c.text.length,0),confirmed=p.facts.filter(f=>f.status==='confirmed').length;
  let html=pageHead('YOUR LITTLE STORY DESK',p.chapters.length?h(p.name):'把故事装进小书包。','导入旧稿，和小章一起收好设定，再安心写下一章。',p.chapters.length?btn(icon('edit',14)+' 作品设置','project-settings','sm'):'')+steps(0);
  if(!p.chapters.length)return html+`<div class="two-columns">${importCard()}<aside>${demoCard()}</aside></div>`+scopeLine()+`<div class="mt16">${btn('从备份恢复作品','restore','text small')}</div>`;
  html+=`<div class="stats"><div class="stat"><strong>${p.chapters.length}</strong><span>已导入章节</span></div><div class="stat"><strong>${fmt(chars)}</strong><span>已收录字符 · 含标点</span></div><div class="stat"><strong>${confirmed}</strong><span>作者已确认的设定</span></div></div>`;
  html+=`<div class="two-columns"><section class="stack"><div class="card"><div class="card-head row between"><h3>章节目录</h3>${btn(icon('plus',13)+' 追加稿件','toggle-import','sm')}</div><div class="chapter-list">${p.chapters.slice(state.chapterPage*50,state.chapterPage*50+50).map(c=>`<div class="chapter-item"><div class="chapter-index">${String(c.index).padStart(2,'0')}</div><div class="grow"><div class="chapter-title">${h(c.title)}</div><div class="chapter-meta">${fmt(c.text.length)} 字符 · ${h(c.sourceName)}</div></div>${btn('阅读 '+icon('chevron',12),'read-chapter','text small',`data-id="${h(c.id)}"`)}</div>`).join('')}</div></div>${p.chapters.length>50?pagination('chapter',state.chapterPage,Math.ceil(p.chapters.length/50)):''}${state.addImport?importCard():''}</section><aside><div class="card card-pad"><div class="eyebrow">NEXT STEP</div><h2 style="margin-top:10px;font-size:20px">${confirmed?'开始核对下一章':'确认你的故事设定'}</h2><p class="muted small" style="margin-top:13px;line-height:1.9">${confirmed?'设定已准备好。提交新章后，章序会把差异和原文放在一起，交由你判断。':`共提取 ${p.facts.length} 条候选设定。确认后才会用于新章检查，带回忆或传闻的句子请仔细核对。`}</p><div class="mt24">${btn((confirmed?'检查新章':'去确认设定')+' '+icon('arrow',14),'navigate','primary',`data-page="${confirmed?'check':'facts'}"`)}</div></div><div class="side-note"><h3>稿件与设定相互独立</h3><div class="note-line">${icon('info',14)}<span>导入不会改写原稿。确认“正常变化”也不会自动改动旧设定；收录新章后再确认新的设定。</span></div></div>${btn('从备份恢复另一部作品','restore','text small')}</aside></div>`;
  return html+scopeLine();
}
function pagination(kind,index,total){return `<div class="pagination">${btn('上一页','paginate','sm',`data-kind="${kind}" data-delta="-1" ${index===0?'disabled':''}`)}<span>${index+1} / ${total}</span>${btn('下一页','paginate','sm',`data-kind="${kind}" data-delta="1" ${index>=total-1?'disabled':''}`)}</div>`;}
function batchEligible(){
  const groups=new Map();
  for(const f of state.project.facts.filter(x=>x.status!=='rejected')) {
    const k=f.entity+'|'+f.attribute;if(!groups.has(k))groups.set(k,new Set());groups.get(k).add(normalizeValue(f.attribute,f.value));
  }
  return state.project.facts.filter(f=>f.status==='pending'&&!f.flags.length&&(f.attribute==='alias'||groups.get(f.entity+'|'+f.attribute)?.size===1));
}
function renderFacts(){
  const p=state.project,eligible=batchEligible(),confirmed=p.facts.filter(f=>f.status==='confirmed').length;
  let list=p.facts.filter(f=>f.status===state.factTab);
  if(state.query)list=list.filter(f=>[f.entity,f.value,f.label,f.evidence.quote].some(s=>s.includes(state.query)));
  const pages=Math.max(1,Math.ceil(list.length/30));state.factPage=Math.min(state.factPage,pages-1);
  let html=pageHead('STORY STICKERS','给故事贴上设定小标签。','先确认哪些是真的，小章才会把它们用在下一次检查里。',btn(icon('plus',14)+' 手动添加','manual-fact','sm')+(confirmed?btn('检查新章 '+icon('arrow',14),'navigate','primary sm','data-page="check"'):''))+steps(1);
  if(!p.chapters.length)return html+empty('pages','还没有旧稿','先导入已写好的章节，再提取设定。','导入旧稿','navigate','data-page="library"');
  html+=`<div class="toolbar"><div class="tabbar">${[['pending','待确认'],['confirmed','已确认'],['rejected','已忽略']].map(([id,label])=>`<button class="tab ${state.factTab===id?'active':''}" data-action="fact-tab" data-tab="${id}">${label} <span class="small">${p.facts.filter(f=>f.status===id).length}</span></button>`).join('')}</div><label class="visually-hidden" for="fact-search">搜索人物、属性或设定</label><input type="search" id="fact-search" value="${h(state.query)}" placeholder="搜索人物、属性或设定…"></div>`;
  if(state.factTab==='pending'&&eligible.length)html+=`<div class="notice mb16 row between wrap"><span>有 ${eligible.length} 条候选没有识别到特殊语境，且同类取值一致。请先浏览原文。</span>${btn('确认这 '+eligible.length+' 条','batch-confirm','soft sm')}</div>`;
  if(state.factTab==='confirmed')html+=`<div class="new-fact-hint">同一对象同一属性出现多个已确认设定时，按收录章节顺序使用最后一条。回忆中的过去状态应保留为“忽略”，避免覆盖当前设定。</div>`;
  if(!list.length)return html+empty('settings',state.query?'没有匹配的设定':state.factTab==='pending'?'当前没有待确认设定':state.factTab==='confirmed'?'还没有确认的设定':'还没有忽略的候选',state.factTab==='pending'?'可以从原文手动补充，或开始检查新章。':'切换上方标签查看其他候选。');
  html+=`<div class="fact-list">${list.slice(state.factPage*30,state.factPage*30+30).map(f=>{
    const chapter=p.chapters.find(c=>c.id===f.evidence.chapterId);
    return `<article class="fact-card ${f.status}"><div class="row between wrap"><div class="row gap8 wrap"><span class="entity-name">${h(f.entity)}</span><span class="muted">/</span><span class="fact-property">${h(f.label)}</span><span class="fact-value">${h(f.value)}</span></div><div class="row gap8">${f.flags.map(x=>pill(x.label,'orange')).join('')}${f.status==='confirmed'?pill('已确认'):''}</div></div><div class="fact-quote">“${h(f.evidence.quote)}”</div><div class="fact-bottom"><button class="source-link" data-action="fact-source" data-id="${h(f.id)}">${icon('book',12)} ${h(chapter?.title)} ${icon('external',11)}</button><div class="row gap8">${f.status!=='confirmed'?btn(icon('tick',12)+' 确认有效','confirm-fact','sm soft',`data-id="${h(f.id)}"`):btn('撤回确认','pending-fact','text small',`data-id="${h(f.id)}"`)}${f.status==='pending'?btn('忽略','reject-fact','text small',`data-id="${h(f.id)}"`):f.status==='rejected'?btn('恢复待确认','pending-fact','text small',`data-id="${h(f.id)}"`):''}${btn(icon('edit',13),'edit-fact','text',`data-id="${h(f.id)}" aria-label="编辑${h(f.entity)}的${h(f.label)}"`)}</div></div></article>`;
  }).join('')}</div>`;
  if(pages>1)html+=pagination('fact',state.factPage,pages);
  return html+scopeLine();
}
function empty(i,title,desc,label='',action='',extra=''){return `<div class="card empty">${icon(i,32)}<h3>${h(title)}</h3><p>${h(desc)}</p>${label?btn(label,action,'primary',extra):''}</div>`;}
function renderCheck(){
  const p=state.project,s=currentSession(),confirmed=activeFacts(p.facts,nextIndex(p),confirmedAliases(p)).size;
  let html=pageHead('ONE MORE CHAPTER','小章来帮你翻翻前文。','小说前后文一致性审稿：核对人物、关系、物品、数值与事件衔接，每个疑点都有原文依据。')+steps(2)+reviewScope();
  if(!p.chapters.length)return html+empty('pages','先放入一些前文','导入旧稿后，可选择本地规则核对或 AI 语义审稿。','导入旧稿','navigate','data-page="library"');
  html+=`<div class="check-layout"><section class="card"><div class="editor-title row between"><span>待检查的新章</span><span class="budget-count">${confirmed} 条生效设定</span></div><div class="editor-body"><label for="draft-title" class="visually-hidden">新章标题</label><input id="draft-title" type="text" maxlength="120" placeholder="例如：第${nextIndex(p)}章 雨夜来客" value="${h(p.draftTitle)}"><label for="draft-text" class="visually-hidden">新章正文</label><textarea class="draft-text serif" id="draft-text" placeholder="在这里粘贴刚写好的新章节…">${h(p.draftText)}</textarea><div class="row between mt16"><span id="draft-count" class="small muted">${fmt(p.draftText.length)} 字符</span><button class="source-link" data-action="choose-draft">${icon('upload',12)} 从文件读入</button><input type="file" id="draft-file" class="visually-hidden" accept=".txt,.md,.docx" tabindex="-1"></div></div><div class="editor-footer"><span class="small muted">${state.busy?h(state.busyLabel):'规则免费 · AI 按供应商用量计费'}</span><div class="row gap8 wrap">${aiAbort?btn('停止等待','cancel-ai','sm'):btn('本地规则检查','run-check','sm',state.busy||!confirmed?'disabled':'')}${btn(icon('spark',14)+' AI 语义审稿','open-ai','primary',state.busy?'disabled':'')}</div></div></section><section id="results-column">${s?renderResults(s):`<div class="check-empty">${icon('check',39)}<div class="serif">每一个差异，都有出处。</div><p>点击检查后，已确认的旧设定与新章原文<br>会并排显示在这里，供你逐条判断。</p><div style="margin-top:20px">${pill('明确事实核对')}${pill('不自动改写正文','gray')}</div></div><div class="side-note"><h3>检查结果由什么构成？</h3><div class="note-line">${icon('alert',14)}<span>明确属性不同：优先核对是否写错。</span></div><div class="note-line">${icon('info',14)}<span>回忆、对话、阵营变化或年龄变化：保留为人工判断提示。</span></div></div>`}</section></div>`;
  return html+scopeLine();
}
function renderResults(s,history=false){
  const changed=!history&&(s.chapter.text!==state.project.draftText||s.chapter.title!==state.project.draftTitle||s.canonSignature!==canonSignature(state.project));
  const pending=s.findings.filter(f=>f.status==='pending').length;
  let findings=s.findings.filter(f=>state.filter==='all'||state.filter==='pending'&&f.status==='pending'||state.filter==='hard'&&f.kind==='contradiction'||state.filter==='review'&&['review','semantic'].includes(f.kind));
  return `${changed?'<div class="notice warn mb16">正文、标题或设定已修改。下面保留上次结果，请重新检查以更新。</div>':''}<div class="results-intro"><div class="result-header"><div class="row gap8"><span class="result-number">${s.findings.length}</span><h3>${s.ai?'处 AI 疑点待核对':'处差异已检出'}</h3></div>${pill(pending?`${pending} 条未处理`:'本轮已处理',pending?'orange':'')}</div>${s.ai?renderAIMeta(s):`<div class="result-summary">${pill(`${s.hardCount} 条明确属性差异`,'red')}${pill(`${s.reviewCount} 条需结合剧情`,'orange')}</div><p>本轮匹配到 ${s.checkedClaims} 处可比较表述，对照 ${s.confirmedFacts} 条有效设定。${s.recognizedClaims===0?'未识别到支持的表述，请确认人物名称、别名和句式。':'不覆盖隐含关系、指代、完整时间线或其他未识别表述。'}${s.invalidFacts?` ${s.invalidFacts} 条引用无效的设定已排除。`:''}</p>`}<div class="row gap8 mt16 wrap">${btn(icon('download',13)+' 导出报告','report','sm',`data-session="${h(s.id)}"`)}${!s.archived?btn(icon('book',13)+' 收录本章','archive-draft','sm soft',`data-session="${h(s.id)}" ${changed?'disabled':''}`):pill('本章已收录')}${s.findings.some(f=>f.remembered)?pill('含已记住的判断','gray'):''}</div></div><div class="result-filters">${(s.ai?[['all','全部'],['pending','未处理']]:[['all','全部'],['pending','未处理'],['hard','明确属性差异'],['review','结合剧情']]).map(([id,label])=>`<button class="tab ${state.filter===id?'active':''}" data-action="result-filter" data-filter="${id}" ${history?`data-history="${h(s.id)}"`:''}>${label}</button>`).join('')}</div>${!findings.length?`<div class="notice">${s.findings.length?'当前筛选下没有待查看的差异。':(s.ai?'AI 在本轮发送的片段内未返回可举证的疑点。请继续人工审稿；未选前文未被检查。':'本轮未发现支持范围内的差异。请继续人工审稿；未识别到的表达不在本轮结论中。')}</div>`:findings.map(f=>renderIssue(f,s.id)).join('')}<div class="report-note">${icon('history',12)} 判断会保存在这部作品中；相同标题、原文语境与设定再次检查时会恢复。同一句换了语境，会重新交由你判断。</div>`;
}
function renderIssue(f,sessionId){
  const old=state.project.chapters.find(c=>c.id===f.previousEvidence.chapterId);
  return `<article class="issue-card"><div class="issue-top"><div class="issue-heading"><span class="issue-kind ${f.kind==='review'?'review':''}"></span>${h(f.entity)} <span style="color:#b4bba8;font-weight:400">/</span> ${h(f.label)}</div>${pill(f.kind==='semantic'?'AI 疑点':f.kind==='contradiction'?'明确属性差异':'需结合剧情',f.kind==='contradiction'?'red':'orange')}</div><div class="issue-body"><div class="comparison"><div class="evidence-box"><div class="evidence-label"><span>${f.kind==='semantic'?'前文':'已确认'} · ${h(old?.title)}</span><button data-action="issue-source" data-side="old" data-id="${h(f.id)}" data-session="${h(sessionId)}" aria-label="定位旧稿原文" class="source-link">${icon('external',12)}</button></div><div class="evidence-value">${h(f.expected)}</div><div class="evidence-quote">“${h(f.previousEvidence.quote)}”</div></div><div class="evidence-box new"><div class="evidence-label"><span>本次新章</span><button data-action="issue-source" data-side="new" data-id="${h(f.id)}" data-session="${h(sessionId)}" aria-label="定位新章原文" class="source-link">${icon('external',12)}</button></div><div class="evidence-value">${h(f.actual)}</div><div class="evidence-quote">“${h(f.evidence.quote)}”</div></div></div><div class="issue-reason">${h(f.reason)}</div>${f.flags.length?`<div class="row gap8 wrap" style="margin-top:8px">${f.flags.map(x=>pill(x.label,'gray')).join('')}</div>`:''}</div><div class="issue-actions">${[['error','确有错误'],['change','正常变化'],['ignore','误报 / 不适用']].map(([id,label])=>`<button class="decision-btn ${f.status===id?'selected '+id:''}" data-action="decide" data-status="${id}" data-id="${h(f.id)}" data-session="${h(sessionId)}" aria-pressed="${f.status===id}">${f.status===id?'✓ ':''}${label}</button>`).join('')}${f.status!=='pending'?`<button class="btn text small" data-action="decide" data-status="pending" data-id="${h(f.id)}" data-session="${h(sessionId)}" aria-label="撤回判断">撤回</button>`:''}<button class="decision-note" data-action="issue-note" data-id="${h(f.id)}" data-session="${h(sessionId)}">${f.note?'备注：'+h(f.note):f.remembered?'已恢复上次判断':'添加备注'}</button></div></article>`;
}
function renderHistory(){
  const p=state.project;
  let html=pageHead('YOUR STORY SCRAPBOOK','核对过的故事，都收好啦。','原文、差异和你的判断，都放进这本小小的检查手账。');
  if(!p.sessions.length)return html+empty('history','还没有检查记录','完成一次新章检查，结果就会保存在这里。','检查新章','navigate','data-page="check"');
  const total=p.sessions.reduce((n,s)=>n+s.findings.length,0),resolved=p.sessions.reduce((n,s)=>n+s.findings.filter(f=>f.status!=='pending').length,0);
  html+=`<div class="stats"><div class="stat"><strong>${p.sessions.length}</strong><span>检查次数</span></div><div class="stat alert"><strong>${total}</strong><span>差异记录 · 含重复检查</span></div><div class="stat"><strong>${resolved}</strong><span>已有作者判断的记录</span></div></div><div class="card">${[...p.sessions].reverse().map(s=>`<div class="history-item"><div class="grow"><div class="history-title">${h(s.chapter.title)} ${s.archived?pill('已收录'):''}</div><div class="history-meta">${h(date(s.createdAt))} · ${fmt(s.chapter.text.length)} 字符 · ${s.ai?'AI · '+h(s.ai.model):'规则引擎 '+h(s.version)}</div><div class="history-stats">${s.ai?`<span>${s.findings.length} 条 AI 疑点</span>`:`<span>${s.hardCount} 条明确属性差异</span><span>${s.reviewCount} 条结合剧情</span>`}<span>${s.findings.filter(f=>f.status==='pending').length} 条未处理</span></div></div><div class="row gap8">${btn('查看结果','view-session','sm',`data-session="${h(s.id)}"`)}${btn(icon('trash',13),'delete-session','text',`data-session="${h(s.id)}" aria-label="删除本次检查记录"`)}</div></div>`).join('')}</div>`;
  return html+`<div class="scope-line">${icon('lock',12)}检查记录保存在本浏览器。导出作品备份可以一并保留旧稿、设定与所有判断。</div>`;
}

function modal(title,body,footer='',wide=false){
  $('#modal-root').innerHTML=`<div class="modal-overlay" data-modal-overlay><section role="dialog" aria-modal="true" aria-labelledby="modal-title" class="modal ${wide?'wide':''}"><div class="modal-header"><h2 id="modal-title">${title}</h2>${btn(icon('close',18),'close-modal','text','aria-label="关闭对话框"')}</div><div class="modal-body">${body}</div>${footer?`<div class="modal-footer">${footer}</div>`:''}</section></div>`;
  document.body.style.overflow='hidden';setTimeout(()=>$('#modal-root input:not([type=file]),#modal-root textarea,#modal-root button')?.focus(),0);
}
function closeModal(){ $('#modal-root').innerHTML='';document.body.style.overflow='';state.reader=null; }
function openReader(chapter,evidence=null){
  if(evidence&&!validateEvidence([chapter],evidence)){toast('原文引用校验失败，无法定位。',true);return;}
  state.reader=chapter;
  let content=h(chapter.text);
  if(evidence)content=h(chapter.text.slice(0,evidence.start))+`<mark id="evidence-highlight">${h(evidence.quote)}</mark>`+h(chapter.text.slice(evidence.end));
  modal(h(chapter.title),`<div class="reader-tip">第 ${chapter.index} 个收录章节 · ${fmt(chapter.text.length)} 字符${evidence?' · 高亮处为检查证据':''}</div><div class="reader" id="source-reader">${content}</div>`,btn('关闭','close-modal','sm')+(state.project.chapters.some(c=>c.id===chapter.id)?btn('从本章补充设定','manual-from-reader','soft sm'):''),true);
  requestAnimationFrame(()=>$('#evidence-highlight')?.scrollIntoView({block:'center',behavior:'instant'}));
}
function manualFact(existing=null,chapter=null,quote=''){
  const p=state.project;
  if(!p.chapters.length){toast('先导入旧稿，再添加有原文依据的设定。');return;}
  state.manual={existingId:existing?.id||null};
  const selected=existing?p.chapters.find(c=>c.id===existing.evidence.chapterId):chapter||p.chapters[0];
  modal(existing?'编辑候选设定':'补充一条有原文依据的设定',`<p class="muted small">只补充原文明示的设定。新章会按本版支持的表达方式核对对应属性。</p><div class="field-row"><div><label for="manual-entity">人物 / 对象名称</label><input id="manual-entity" type="text" maxlength="20" value="${h(existing?.entity||'')}" placeholder="例如：陆沉"></div><div><label for="manual-attribute">属性</label><select id="manual-attribute">${Object.entries(ATTRIBUTES).map(([k,v])=>`<option value="${k}" ${existing?.attribute===k?'selected':''}>${h(v.label)}</option>`).join('')}</select></div></div><label for="manual-value">设定值</label><input id="manual-value" type="text" maxlength="32" value="${h(existing?.value||'')}" placeholder="例如：左手"><label for="manual-chapter">原文章节</label><select id="manual-chapter">${p.chapters.map(c=>`<option value="${h(c.id)}" ${selected?.id===c.id?'selected':''}>${h(c.title)}</option>`).join('')}</select><label for="manual-quote">原文证据（逐字引用）</label><textarea id="manual-quote" rows="3" maxlength="800" placeholder="粘贴一句包含对象名称和设定值的原文">${h(existing?.evidence.quote||quote)}</textarea><div class="field-note">引用必须在所选章节中找到，且包含对象名称（或已确认别名）与设定值；相同引文重复出现时定位到第一次。</div>`,btn('取消','close-modal','sm')+btn('保存为待确认','save-manual-fact','primary sm'));
}
function about(){
  modal('检查范围与稿件存储',`<div class="notice">本版提供本地规则检查和可选的 DeepSeek AI 语义审稿。AI 疑点通过双侧引文校验后显示，仍可能误判或漏检；尚未经过真实作者准确率验证。</div>${reviewScope(true)}<h3 class="mt24">本地规则具体支持哪些表述？</h3><table class="support-table"><thead><tr><th>设定</th><th>支持的表达示例</th></tr></thead><tbody><tr><td>惯用手、瞳色、血型</td><td>陆沉惯用左手。陆沉的瞳色是黑色。</td></tr><tr><td>生父、生母、出生地</td><td>顾宁的生父是顾远山。</td></tr><tr><td>年龄</td><td>陆沉年方二十岁。陆沉的年龄是20岁。</td></tr><tr><td>阵营、生死状态</td><td>陆沉效忠北境军。沈砚已经战死。</td></tr><tr><td>固定编制、长度</td><td>银鸦卫的固定编制为三百人。</td></tr><tr><td>别名</td><td>陆沉的别名是青鸦。确认后与陆沉合并核对。</td></tr></tbody></table><p class="small muted">共 ${Object.keys(ATTRIBUTES).length} 类设定，其中别名用于统一对象。数字支持常见中文数词；长度仅在同一度量体系内换算。阵营、年龄、生死状态不同均保留为人工判断。</p><h3 class="mt24">哪些还做不到？</h3><p class="small muted">无法理解所有自然语言写法、代词指向、隐含因果、完整历史知识或故事时间线。未发现差异，表示在本轮识别到的表述里没有差异。回忆、对话、伪装等标记也可能漏识别，作者需要继续审稿。</p><h3 class="mt24">如何保留下一章的判断？</h3><p class="small muted">每条差异可标记“确有错误”“正常变化”或“误报 / 不适用”。相同章节标题、原文语境和原设定再次检查时恢复判断；改写内容后重新检查。收录新章后，新设定仍要到设定页确认。</p><h3 class="mt24">稿件存在哪里？</h3><p class="small muted">导入、规则提取与规则检查在浏览器内完成。只有在 AI 审稿窗口确认发送后，新章、所选前文、相关已确认设定与别名才会经章序服务转发给 DeepSeek。发送内容可在窗口展开查看；服务器代码不持久化正文或密钥，也不记录请求正文。供应商的数据处理以其政策为准。API Key 只保留在当前标签页内存中，刷新即清除，不写入作品备份。正文、设定和检查记录写入当前浏览器的本地数据库；同一站点、同一浏览器资料中的作品可访问，不等于加密保险箱。换设备、清理站点数据、浏览器私密模式或更换网址都可能导致数据不可用。请定期导出 JSON 备份，恢复时会检查引用。</p><p class="small muted mt16">TXT 支持 UTF-8 及 GB18030；DOCX 读取可编辑正文，不含图片文字、批注、页眉页脚或完整排版。单文件 8 MB，单次导入 150 万字符，单部作品正文 300 万字符；单次新章 10 万字符。AI 单次新章最多 12,000 字符、前文最多 24,000 字符，超出部分不覆盖。当前无账号云同步、平台收费或自动全书审稿；DeepSeek 按其用量计费。</p>`,btn('知道了','close-modal','primary sm'),true);
}

async function importText(text,name){
  const p=state.project;
  const {result}=await runTask({type:'import',text,name,offset:nextIndex(p)-1});
  const unique=result.chapters.filter(c=>!p.chapters.some(old=>old.title===c.title&&old.text===c.text));
  if(!unique.length){toast('这份稿件已导入，未重复添加。');return;}
  if(p.chapters.length+unique.length>3000||p.chapters.reduce((n,c)=>n+c.text.length,0)+unique.reduce((n,c)=>n+c.text.length,0)>3_000_000)throw new Error('单部作品正文上限为 300 万字符、3000 章，请分卷新建作品。');
  const ids=new Set(unique.map(c=>c.id));
  p.chapters.push(...unique);p.facts.push(...result.facts.filter(f=>ids.has(f.evidence.chapterId)));
  state.importText='';state.addImport=false;state.page='facts';state.factTab='pending';state.factPage=0;state.query='';
  await touch(true);toast(`已导入 ${unique.length} 章，提取 ${result.facts.filter(f=>ids.has(f.evidence.chapterId)).length} 条候选设定。`);
}
async function loadDemo(){
  const existing=state.projects.find(p=>p.isDemo);
  if(existing){await flush();state.project=existing;state.page='facts';state.factTab=existing.facts.some(f=>f.status==='pending')?'pending':'confirmed';state.sessionId=existing.sessions.at(-1)?.id||null;rememberProject();return;}
  await flush();const p=createProject(SAMPLE_NAME);p.isDemo=true;p.draftTitle=SAMPLE_NEW_TITLE;p.draftText=SAMPLE_NEW;
  state.projects.unshift(p);state.project=p;rememberProject();
  await importText(SAMPLE_OLD,'内置测试样稿.txt');
}
function rememberProject(){try{localStorage.setItem('zhangxu-current-project',state.project.id);}catch{}}
function aliasConflict(fact,extra=[]){
  if(fact.attribute!=='alias')return '';
  const confirmed=[...state.project.facts.filter(f=>f.status==='confirmed'),...extra];
  const other=confirmed.find(f=>f.attribute==='alias'&&f.value===fact.value&&f.entity!==fact.entity);
  if(other)return `“${fact.value}”已被确认为“${other.entity}”的别名，无法同时归给另一对象。`;
  if(fact.entity===fact.value)return '别名与对象名称相同，无需添加。';
  return '';
}
async function runCheck(){
  const p=state.project;
  if(!p.draftText.trim())throw new Error('先粘贴新章正文，再点击检查。');
  if(!activeFacts(p.facts,nextIndex(p),confirmedAliases(p)).size)throw new Error('本地规则检查需要先确认设定，也可选择 AI 语义审稿直接对照前文。');
  if(p.sessions.length>=200)throw new Error('已保存 200 次检查，请导出备份后删除不需要的旧记录。');
  p.draftTitle=p.draftTitle.trim()||`第${nextIndex(p)}章 待核对新章`;
  const chapter={id:'draft-'+uid(),index:nextIndex(p),title:p.draftTitle,text:p.draftText,sourceName:'新章检查',importedAt:new Date().toISOString()};
  const {result,elapsedMs}=await runTask({type:'check',input:{chapters:p.chapters,facts:p.facts,aliases:confirmedAliases(p),draft:chapter,decisions:p.decisions}});
  const session={...result,id:uid(),chapter,createdAt:new Date().toISOString(),elapsedMs,archived:false,canonSignature:canonSignature(p)};
  p.sessions.push(session);state.sessionId=session.id;state.filter='all';await touch(true);
  toast(`本轮核对 ${result.checkedClaims} 处明确表述，检出 ${result.findings.length} 处差异。`);
}
function renderAIMeta(s){
  const a=s.ai,c=a.coverage,u=a.usage;
  return `<div class="result-summary">${pill('AI 语义审稿','ai-pill')}${pill(a.model,'gray')}</div><p>本轮关注${REVIEW_AREAS.map(a=>a.name).join('、')}。</p><p>前文覆盖 ${fmt(c.selectedChars)} / ${fmt(c.totalChars)} 字符（${c.selectedChapters} / ${c.totalChapters} 章）。${c.fullBook?'本轮前文已全部发送。':'本轮仅检索片段，未覆盖整部旧稿。'} AI 疑点需作者核对。</p><p class="small muted">本轮输入 ${u.inputTokens===null?'供应商未返回':fmt(u.inputTokens)} token · 输出 ${u.outputTokens===null?'供应商未返回':fmt(u.outputTokens)} token。费用以 DeepSeek 账单为准。</p>${a.rejected?`<div class="notice warn mt16">${a.rejected} 项返回内容未通过引文或格式校验，已剔除。本轮结果不完整；请人工复查相关内容。</div>`:''}`;
}
async function openAIDialog(){
  const p=state.project;
  if(p.sessions.length>=200)throw new Error('检查记录已达 200 次，请备份后清理旧记录。');
  if(!p.draftText.trim()){state.page='check';throw new Error('先在“新章检查”填入待审正文。');}
  p.draftTitle=p.draftTitle.trim()||`第${nextIndex(p)}章 待核对新章`;
  const chapter={id:'draft-'+uid(),index:nextIndex(p),title:p.draftTitle,text:p.draftText,sourceName:'AI 语义审稿',importedAt:new Date().toISOString()};
  const context=buildSemanticContext(p,chapter);
  let config;
  try{const r=await fetch('/api/ai-config',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error();config=await r.json();if(config.version!==AI_VERSION)throw new Error();}
  catch{throw new Error('AI 服务未启动或版本不匹配。请用 npm start 运行完整工作台；纯静态部署只支持本地规则检查。');}
  aiPending={context,chapter,projectId:p.id,canonSignature:canonSignature(p),serverKeyAvailable:config.serverKeyAvailable};
  const c=context.coverage;
  modal('让小章再读深一点',`<div class="ai-dialog-intro">${bookBuddySvg('check')}<div><h3>AI 语义审稿</h3><p>小说前后文一致性审稿。每条疑点附新旧原文，由你最终判断。</p></div></div>${reviewScope(true)}<div class="ai-scope"><strong>本轮发送范围</strong><p>新章 ${fmt(chapter.text.length)} 字符；前文 ${fmt(c.selectedChars)} / ${fmt(c.totalChars)} 字符，来自 ${c.selectedChapters} / ${c.totalChapters} 章；另含 ${context.canon.length} 条相关已确认设定与作者确认的别名。</p><p>${c.fullBook?'这部作品的前文在本轮容量内。':'前文超出容量，仅发送检索片段。未选片段中的矛盾可能漏检。'}</p></div><details class="ai-preview"><summary>查看将发送的原文与设定</summary><h4>${h(chapter.title)} · 新章</h4><pre>${h(chapter.text)}</pre>${context.excerpts.map(e=>`<h4>${h(e.title)} · 字符 ${e.start+1}—${e.start+e.text.length}</h4><pre>${h(e.text)}</pre>`).join('')}<h4>确认设定与别名</h4><pre>${h(context.canon.map(f=>`${f.entity} / ${f.attribute}：${f.value}\n原文：${f.quote}`).join('\n\n')+'\n\n'+Object.entries(context.aliases).filter(([,names])=>names.length).map(([name,names])=>`${name}的别名：${names.join('、')}`).join('\n'))}</pre></details><div class="field-row"><div><label for="ai-model">审稿模型</label><select id="ai-model">${Object.entries(AI_MODELS).map(([id,name])=>`<option value="${id}" ${id===aiModel?'selected':''}>${name}</option>`).join('')}</select></div><div><label for="ai-key">DeepSeek API Key</label><input id="ai-key" type="password" autocomplete="off" spellcheck="false" maxlength="256" placeholder="${config.serverKeyAvailable?'可留空：使用服务器密钥':'仅在此标签页内存保留'}"></div></div><p class="field-note">密钥经当前服务器转发给 DeepSeek 官方接口，不写入作品、备份或浏览器持久存储。刷新即清除。${btn('清除本页密钥','clear-ai-key','text small')}</p><div class="notice mt16">每次确认发起 1 次模型请求，输出最多 ${AI_LIMITS.outputTokens} token，不自动付费重试。费用由 DeepSeek 按用量收取；可到 <a href="https://platform.deepseek.com/" target="_blank" rel="noopener noreferrer">DeepSeek 平台</a>管理密钥与余额。</div><label class="ai-consent" for="ai-consent"><input id="ai-consent" type="checkbox"><span>我确认将上述稿件内容发送给 DeepSeek，并了解本次调用可能产生费用。AI 结果由我逐条核对。</span></label>`,btn('先不发送','close-modal','sm')+btn(icon('spark',14)+' 发送并开始审稿','confirm-ai','primary sm'),true);
  $('#ai-key').value=aiKey;
}
async function runAIReview(pending,key,model){
  const p=state.project,start=performance.now();state.page='check';aiAbort=new AbortController();render();
  const timer=setTimeout(()=>aiAbort?.abort(),100000);
  let data;
  try{
    let response;
    try{response=await fetch('/api/semantic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({context:pending.context,model,apiKey:key||undefined}),signal:aiAbort.signal});}
    catch(error){throw new Error(error.name==='AbortError'?'已停止等待，本轮未保存结果。已发出的请求可能仍会计费。':'无法连接 AI 服务，本轮未自动重试；请求可能已计费。');}
    try{data=await response.json();}catch{throw new Error('AI 服务没有返回可读取的响应，本轮未保存结果。');}
    if(!response.ok||data.error)throw new Error(data.error?.message||'AI 审稿未完成。');
    if(data.version!==AI_VERSION||data.model!==model||!data.usage)throw new Error('AI 返回版本或模型信息无效，本轮未保存结果。');
    const validated=semanticFindings(data.issues,pending.context,p,pending.canonSignature);
    const session={id:uid(),chapter:pending.chapter,createdAt:new Date().toISOString(),elapsedMs:Math.round(performance.now()-start),archived:false,canonSignature:pending.canonSignature,
      findings:validated.findings,claims:[],checkedClaims:0,recognizedClaims:0,confirmedFacts:pending.context.canon.length,invalidFacts:0,hardCount:0,reviewCount:0,version:AI_VERSION,
      ai:{provider:'DeepSeek',model,coverage:pending.context.coverage,usage:data.usage,rejected:(data.rejected||0)+validated.rejected}};
    p.sessions.push(session);state.page='check';state.sessionId=session.id;state.filter='all';await touch(true);
    toast(`AI 审稿完成：${session.findings.length} 条可举证疑点，请逐条核对。`);
  }finally{clearTimeout(timer);aiAbort=null;}
}
function download(name,text,type='text/plain;charset=utf-8'){
  const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name.replace(/[\\/:*?"<>|]/g,'_');a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function backup(){const p=state.project;download(`${p.name}_作品备份_${new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'})}.json`,JSON.stringify(p,null,2),'application/json;charset=utf-8');toast('已开始下载作品备份，请妥善保留文件。');}
function report(sessionId){
  const p=state.project,s=p.sessions.find(s=>s.id===sessionId);if(!s)return;
  const statuses={pending:'未处理',error:'确有错误',change:'正常变化',ignore:'误报 / 不适用'};
  const coverage=s.ai?.coverage,usage=s.ai?.usage;
  let lines=[`# ${p.name} · 检查报告`,``,`- 审稿目标：小说前后文一致性核对。`,`- 本轮关注：${s.ai?REVIEW_AREAS.map(a=>a.name).join('、'):'已确认设定中的惯用手、瞳色、血型、生父、生母、出生地、年龄、阵营、生死状态、固定编制、长度；别名用于归并对象。'}`,`- 审核依据：${s.ai?'本轮选取的旧稿片段、相关已确认设定及别名、本次新章。':'附原文的已确认设定及别名、本次新章中可识别的表述。'}`,`- 判断原则：${s.ai?'AI 提示词要求：'+REVIEW_AI_CRITERIA:REVIEW_RULE_CRITERIA}`,`- 证据要求：每条疑点附双侧原文和出处；引文存在不代表判断正确，由作者裁定。`,`- 范围边界：${REVIEW_BOUNDARY}`,`- 章节：${s.chapter.title}`,`- 检查时间（北京时间）：${new Date(s.createdAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}`,
    ...(s.ai?[`- AI 语义审稿：${s.ai.provider} / ${s.ai.model} / ${s.version}`,`- 前文覆盖：${coverage.selectedChars} / ${coverage.totalChars} 字符，${coverage.selectedChapters} / ${coverage.totalChapters} 章；${coverage.fullBook?'前文已全部发送':'仅检索片段，未覆盖全书'}`,`- 用量：输入 ${usage.inputTokens??'未返回'} token，输出 ${usage.outputTokens??'未返回'} token；费用以供应商账单为准。`,`- 双侧引文校验后保留 ${s.findings.length} 条 AI 疑点，剔除 ${s.ai.rejected} 项无效或重复返回。`]:[`- 规则引擎：${s.version}`,`- 核对 ${s.checkedClaims} 处可比较表述；明确属性差异 ${s.hardCount} 处，需结合剧情 ${s.reviewCount} 处。`]),``,s.ai?'AI 只对比本轮发送的材料；可能误判或漏检，未发现疑点不代表全稿无误。':'本报告仅覆盖可识别的明确表述；未检出差异不代表全稿无误。',`每条差异由作者判断，不自动改写原稿。`,``];
  for(const [i,f] of s.findings.entries()) {
    const old=p.chapters.find(c=>c.id===f.previousEvidence.chapterId);
    lines.push(`## ${i+1}. ${f.entity} / ${f.label}`,``,`- 类型：${f.kind==='semantic'?'AI 疑点':f.kind==='contradiction'?'明确属性差异':'需结合剧情'}`,`- 作者判断：${statuses[f.status]}`,`- 旧设定：${f.expected}`,`- 新表述：${f.actual}`,``,`旧稿证据（${old?.title}，字符 ${f.previousEvidence.start+1}—${f.previousEvidence.end}）：`,``,...f.previousEvidence.quote.split('\n').map(l=>'> '+l),``,`新章证据（字符 ${f.evidence.start+1}—${f.evidence.end}）：`,``,...f.evidence.quote.split('\n').map(l=>'> '+l),``,f.reason,``);
    if(f.note)lines.push(`作者备注：${f.note}`,``);
  }
  state.reportPayload={name:`${p.name}_${s.chapter.title}_检查报告.txt`,text:lines.join('\n')};
  modal('检查报告',`<p class="muted small mb16">报告包含新旧原文、所在章节、差异说明与作者判断。可复制下方内容，或下载为 TXT。</p><label for="report-preview" class="visually-hidden">检查报告全文</label><textarea id="report-preview" readonly rows="16" class="small">${h(state.reportPayload.text)}</textarea>`,btn('关闭','close-modal','sm')+btn(icon('download',13)+' 下载 TXT 报告','download-report','primary sm'),true);
}
function chooseRestore(){
  const input=document.createElement('input');input.type='file';input.accept='.json';
  input.addEventListener('change',async()=>{
    const file=input.files[0];if(!file)return;
    await busy('正在恢复备份',async()=>{
      if(file.size>40*1024*1024)throw new Error('备份文件过大，当前最多恢复 40 MB。');
      let parsed;try{parsed=JSON.parse(await file.text());}catch{throw new Error('无法解析备份，请选择章序导出的 JSON 文件。');}
      const p=validateProject(parsed);p.id=uid();p.revision=0;p.isDemo=false;p.name+=' · 恢复';p.updatedAt=new Date().toISOString();
      await flush();state.projects.unshift(p);state.project=p;state.page='library';state.sessionId=p.sessions.at(-1)?.id||null;state.importText='';rememberProject();await persist();toast('备份已恢复为独立作品，原有作品仍保留。');
    });
  },{once:true});input.click();
}
function archiveDraft(s){
  if(!s||s.archived)return;
  if(s.chapter.text!==state.project.draftText||s.chapter.title!==state.project.draftTitle||s.canonSignature!==canonSignature(state.project)){toast('内容或设定已变动，请重新检查后再收录。',true);return;}
  const errors=s.findings.filter(f=>f.status==='error').length,pending=s.findings.filter(f=>f.status==='pending').length;
  if(errors){toast(`还有 ${errors} 条被标为“确有错误”，请修改正文并重新检查后再收录。`,true);return;}
  const body=`<p>将“${h(s.chapter.title)}”加入稿件库，作为后续新章的前文。</p>${pending?`<div class="notice warn mt16">本轮还有 ${pending} 条差异未处理，请确认确实要保留当前正文。</div>`:''}<p class="small muted mt16">本章识别到的设定会进入“待确认”。只有你确认后，它们才会影响下一章。回忆、传闻与人物话语请保留为忽略。</p>`;
  modal('收录本章',body,btn('返回核对','close-modal','sm')+btn('确认收录','confirm-archive','primary sm',`data-session="${h(s.id)}"`));
}
function openSession(id){
  const s=state.project.sessions.find(s=>s.id===id);if(!s)return;state.filter='all';
  modal(h(s.chapter.title)+' · 检查记录',renderResults(s,true),btn('关闭','close-modal','sm')+btn('载入编辑区','edit-session','primary sm',`data-session="${h(id)}"`),true);
}
async function handleAction(button){
  const a=button.dataset.action,p=state.project,id=button.dataset.id,sid=button.dataset.session;
  if(state.busy&&!['close-modal','cancel-ai'].includes(a)){toast('正在处理，请稍候。');return;}
  if(a==='navigate'){state.page=button.dataset.page;state.query='';render();window.scrollTo(0,0);return;}
  if(a==='close-modal'){closeModal();return;}
  if(a==='about'){about();return;}
  if(a==='pet-buddy'){petBuddy(state.page,button.dataset.gesture);return;}
  if(a==='choose-manuscript'){$('#manuscript-file')?.click();return;}
  if(a==='choose-draft'){$('#draft-file')?.click();return;}
  if(a==='import-text'){await busy('正在提取设定',()=>importText(state.importText,'粘贴旧稿'));return;}
  if(a==='demo'){await busy('正在载入样稿',loadDemo);return;}
  if(a==='backup'){backup();return;}
  if(a==='restore'){chooseRestore();return;}
  if(a==='toggle-import'){state.addImport=!state.addImport;render();if(state.addImport)$('#upload-drop')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
  if(a==='new-project'){modal('新建作品','<label for="new-project-name">作品名称</label><input id="new-project-name" type="text" maxlength="80" placeholder="例如：长夜来信">',btn('取消','close-modal','sm')+btn('创建作品','create-project','primary sm'));return;}
  if(a==='create-project'){
    const name=$('#new-project-name').value.trim();if(!name){toast('为作品起一个名字。');return;}
    await flush();const np=createProject(name);state.projects.unshift(np);state.project=np;state.page='library';state.sessionId=null;state.importText='';rememberProject();closeModal();await persist();render();return;
  }
  if(a==='project-settings'){
    modal('作品设置',`<label for="rename-project">作品名称</label><input id="rename-project" type="text" maxlength="80" value="${h(p.name)}"><div class="delete-area"><h3 style="color:#aa654d;font-size:13px">删除这部作品的本机数据</h3><p class="muted small mt16">包含本浏览器内的稿件、设定和检查记录。删除前建议先导出备份。</p><label for="delete-project-name">如需删除，请输入完整作品名</label><input id="delete-project-name" type="text" autocomplete="off" placeholder="${h(p.name)}"><div class="mt16">${btn(icon('trash',12)+' 删除本机作品','delete-project','danger sm')}</div></div>`,btn('导出备份','backup','sm')+btn('保存名称','rename-project','primary sm'));return;
  }
  if(a==='rename-project'){const name=$('#rename-project').value.trim();if(!name){toast('名称不能为空。');return;}p.name=name;closeModal();await touch(true);render();return;}
  if(a==='delete-project'){
    if($('#delete-project-name').value!==p.name){toast('输入的作品名不匹配，未删除。',true);return;}
    clearTimeout(saveTimer);await saveQueue;await deleteProject(p.id);state.projects=state.projects.filter(x=>x.id!==p.id);if(!state.projects.length){const np=createProject('我的第一部作品');state.projects.push(np);state.project=np;await persist(np);}else state.project=state.projects[0];state.page='library';state.sessionId=null;state.importText='';rememberProject();closeModal();render();toast('已删除这部作品的本机数据。');return;
  }
  if(a==='fact-tab'){state.factTab=button.dataset.tab;state.factPage=0;render();return;}
  if(a==='paginate'){if(button.dataset.kind==='fact')state.factPage+=Number(button.dataset.delta);else state.chapterPage+=Number(button.dataset.delta);render();return;}
  if(a==='batch-confirm'){
    const eligible=batchEligible();const conflicts=eligible.map(f=>aliasConflict(f,eligible.filter(x=>x.id!==f.id))).filter(Boolean);if(conflicts.length){toast(conflicts[0],true);return;}
    for(const f of eligible)f.status='confirmed';await touch(true);render();celebrate();toast(`${eligible.length} 条设定收好啦，可以写下一章了。`);return;
  }
  if(['confirm-fact','reject-fact','pending-fact'].includes(a)){
    const f=p.facts.find(f=>f.id===id);if(!f)return;
    if(a==='confirm-fact'){const conflict=aliasConflict(f);if(conflict){toast(conflict,true);return;}}
    f.status=a==='confirm-fact'?'confirmed':a==='reject-fact'?'rejected':'pending';await touch(true);render();return;
  }
  if(a==='manual-fact'){manualFact();return;}
  if(a==='manual-from-reader'){const chapter=state.reader,selection=window.getSelection()?.toString()||'';manualFact(null,chapter,selection);return;}
  if(a==='edit-fact'){manualFact(p.facts.find(f=>f.id===id));return;}
  if(a==='save-manual-fact'){
    const entity=$('#manual-entity').value.trim(),attribute=$('#manual-attribute').value,value=$('#manual-value').value.trim(),chapter=p.chapters.find(c=>c.id===$('#manual-chapter').value),quote=$('#manual-quote').value.trim();
    if(!entity||!value||!quote){toast('请填写名称、设定值和原文证据。');return;}
    if(['__proto__','constructor','prototype'].includes(entity)){toast('请使用有效的对象名称。',true);return;}
    const names=[entity,...(confirmedAliases(p)[entity]||[])];
    if(!names.some(n=>quote.includes(n))||!quote.includes(value)){toast('证据需逐字包含对象名称（或已确认别名）与设定值。',true);return;}
    const start=chapter.text.indexOf(quote);if(start<0){toast('在所选章节中找不到这段原文，请逐字引用。',true);return;}
    const f={id:state.manual.existingId||'manual-'+uid(),entity,mentionedAs:entity,attribute,label:ATTRIBUTES[attribute].label,value,normalizedValue:normalizeValue(attribute,value),evidence:{chapterId:chapter.id,start,end:start+quote.length,quote},context:quote,flags:[{id:'manual',label:'作者补充'}],chapterIndex:chapter.index,status:'pending'};
    const existingIndex=p.facts.findIndex(x=>x.id===f.id);if(existingIndex>=0)p.facts[existingIndex]=f;else p.facts.push(f);state.factTab='pending';state.factPage=0;state.query='';closeModal();await touch(true);render();toast('设定已保存为待确认。');return;
  }
  if(a==='read-chapter'){openReader(p.chapters.find(c=>c.id===id));return;}
  if(a==='fact-source'){const f=p.facts.find(f=>f.id===id);if(f)openReader(p.chapters.find(c=>c.id===f.evidence.chapterId),f.evidence);return;}
  if(a==='open-ai'){await busy('正在准备 AI 审稿',openAIDialog);return;}
  if(a==='cancel-ai'){aiAbort?.abort();toast('已停止等待；已发出的请求可能仍会计费。');return;}
  if(a==='clear-ai-key'){aiKey='';if($('#ai-key'))$('#ai-key').value='';toast('当前标签页的密钥已清除。');return;}
  if(a==='confirm-ai'){
    const key=$('#ai-key').value.trim(),model=$('#ai-model').value,consent=$('#ai-consent').checked;
    if(!consent){toast('请先勾选确认发送与费用说明。',true);return;}
    if(!key&&!aiPending?.serverKeyAvailable){toast('请在此窗口填写 DeepSeek API Key，不要发送到聊天。',true);$('#ai-key').focus();return;}
    if(!aiPending||aiPending.projectId!==p.id||aiPending.context.draft.text!==p.draftText||aiPending.context.draft.title!==p.draftTitle||aiPending.canonSignature!==canonSignature(p)){closeModal();throw new Error('稿件或设定已变化，请重新打开 AI 审稿窗口。');}
    aiKey=key;aiModel=model;const pending=aiPending;aiPending=null;closeModal();await busy('AI 正在阅读所选前文…',()=>runAIReview(pending,key,model));return;
  }
  if(a==='run-check'){await busy('正在核对原文',runCheck);return;}
  if(a==='result-filter'){
    state.filter=button.dataset.filter;if(button.dataset.history){const s=p.sessions.find(s=>s.id===button.dataset.history);$('#modal-root .modal-body').innerHTML=renderResults(s,true);}else render();return;
  }
  if(a==='issue-source'){
    const s=p.sessions.find(s=>s.id===sid),f=s?.findings.find(f=>f.id===id);if(!f)return;
    const old=button.dataset.side==='old';openReader(old?p.chapters.find(c=>c.id===f.previousEvidence.chapterId):s.chapter,old?f.previousEvidence:f.evidence);return;
  }
  if(a==='decide'){
    const s=p.sessions.find(s=>s.id===sid),f=s?.findings.find(f=>f.id===id);if(!f)return;
    f.status=button.dataset.status;f.remembered=false;
    if(f.status==='pending')delete p.decisions[f.fingerprint];else p.decisions[f.fingerprint]={status:f.status,note:f.note,updatedAt:new Date().toISOString()};
    const inHistory=!!$('#modal-root .issue-card');await touch(true);
    if(inHistory)$('#modal-root .modal-body').innerHTML=renderResults(s,true);else render();return;
  }
  if(a==='issue-note'){
    const f=p.sessions.find(s=>s.id===sid)?.findings.find(f=>f.id===id);if(!f)return;
    modal('记录判断依据',`<p class="muted small">${h(f.entity)} / ${h(f.label)}：${h(f.expected)} → ${h(f.actual)}</p><label for="issue-note">作者备注</label><textarea id="issue-note" rows="3" maxlength="400" placeholder="例如：第三卷已投奔南川盟，这是正常剧情变化。">${h(f.note)}</textarea>`,btn('取消','close-modal','sm')+btn('保存备注','save-note','primary sm',`data-id="${h(id)}" data-session="${h(sid)}"`));return;
  }
  if(a==='save-note'){
    const f=p.sessions.find(s=>s.id===sid)?.findings.find(f=>f.id===id);if(!f)return;f.note=$('#issue-note').value.trim();if(f.status!=='pending')p.decisions[f.fingerprint]={status:f.status,note:f.note,updatedAt:new Date().toISOString()};closeModal();await touch(true);render();return;
  }
  if(a==='report'){report(sid);return;}
  if(a==='download-report'){if(state.reportPayload){download(state.reportPayload.name,state.reportPayload.text);toast('已开始下载检查报告。');}return;}
  if(a==='archive-draft'){archiveDraft(p.sessions.find(s=>s.id===sid));return;}
  if(a==='confirm-archive'){
    const s=p.sessions.find(s=>s.id===sid);if(!s||s.archived)return;
    if(p.chapters.reduce((n,c)=>n+c.text.length,0)+s.chapter.text.length>3_000_000){toast('作品正文超过容量，请分卷新建作品。',true);return;}
    const chapter={...s.chapter,index:nextIndex(p)};p.chapters.push(chapter);
    const additions=extractClaims([chapter],confirmedAliases(p));
    const current=activeFacts(p.facts,chapter.index,confirmedAliases(p));
    const filtered=additions.filter(f=>f.attribute!=='alias'&&normalizeValue(f.attribute,current.get(f.entity+'\0'+f.attribute)?.value||'')!==f.normalizedValue);
    p.facts.push(...filtered);s.archived=true;state.page='facts';state.factTab='pending';state.factPage=0;state.query='';state.project.draftText='';state.project.draftTitle='';state.sessionId=null;closeModal();await touch(true);render();celebrate();toast(`新的一章收好啦。新增 ${filtered.length} 条候选设定，记得确认。`);return;
  }
  if(a==='view-session'){openSession(sid);return;}
  if(a==='edit-session'){
    const s=p.sessions.find(s=>s.id===sid);if(!s)return;p.draftTitle=s.chapter.title;p.draftText=s.chapter.text;state.sessionId=s.id;state.page='check';state.filter='all';closeModal();await touch(true);render();return;
  }
  if(a==='delete-session'){
    modal('删除这次检查记录',`<p>删除记录会移除本轮原文快照和本轮判断。稿件库中的已收录章节与作品内已记住的判断仍会保留。</p>`,btn('取消','close-modal','sm')+btn('删除记录','confirm-delete-session','danger sm',`data-session="${h(sid)}"`));return;
  }
  if(a==='confirm-delete-session'){p.sessions=p.sessions.filter(s=>s.id!==sid);if(state.sessionId===sid)state.sessionId=null;closeModal();await touch(true);render();return;}
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
  handleAction(button).catch(error=>toast(error.message||'未能完成，请重试。',true));
});
document.addEventListener('input',event=>{
  const el=event.target,p=state.project;if(!p)return;
  if(el.id==='import-text')state.importText=el.value;
  if(el.id==='draft-text'||el.id==='draft-title'){
    if(el.id==='draft-text'){p.draftText=el.value;const count=$('#draft-count');if(count)count.textContent=fmt(el.value.length)+' 字符';}else p.draftTitle=el.value;
    touch();const s=currentSession();if(s)$('#results-column').innerHTML=renderResults(s);
  }
  if(el.id==='fact-search'){
    const position=el.selectionStart;state.query=el.value;state.factPage=0;render();const next=$('#fact-search');next.focus();next.setSelectionRange(position,position);
  }
});
document.addEventListener('change',async event=>{
  const el=event.target;
  if(el.id==='project-select'){
    await flush();const p=state.projects.find(p=>p.id===el.value);if(!p)return;state.project=p;state.page='library';state.sessionId=p.sessions.at(-1)?.id||null;state.importText='';state.query='';state.chapterPage=0;rememberProject();render();
  }
  if(el.id==='manuscript-file'||el.id==='draft-file'){
    const file=el.files?.[0];if(!file)return;
    await busy('正在读取文件',async()=>{const text=await readManuscript(file);if(el.id==='manuscript-file')await importText(text,file.name);else{state.project.draftText=text;state.project.draftTitle=state.project.draftTitle||file.name.replace(/\.(txt|md|docx)$/i,'');await touch(true);toast('新章已读入，点击“检查本章”开始。');}});
  }
});
document.addEventListener('dragover',event=>{if(event.target.closest('#upload-drop')){event.preventDefault();$('#upload-drop').classList.add('dragging');}});
document.addEventListener('dragleave',event=>{if(event.target.closest('#upload-drop'))$('#upload-drop')?.classList.remove('dragging');});
document.addEventListener('drop',async event=>{
  if(!event.target.closest('#upload-drop'))return;event.preventDefault();const file=event.dataTransfer.files?.[0];if(!file||state.busy)return;
  await busy('正在读取文件',async()=>importText(await readManuscript(file),file.name));
});
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&$('#modal-root').children.length){closeModal();return;}
  if(['Enter',' '].includes(event.key)&&event.target.id==='upload-drop'){event.preventDefault();$('#manuscript-file')?.click();}
  if(event.key==='Tab'&&$('#modal-root').children.length){
    const nodes=[...$('#modal-root').querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')].filter(e=>e.offsetParent!==null);
    const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&!state.saved)flush();});
window.addEventListener('beforeunload',event=>{if(!state.saved){event.preventDefault();event.returnValue='';}});
async function init(){
  try{await openDatabase();state.projects=await getProjects();}
  catch(error){state.storageError=error.message;toast(error.message,true);}
  if(!state.projects.length){const p=createProject('我的第一部作品');state.projects.push(p);state.project=p;await persist(p);}
  let current;try{current=localStorage.getItem('zhangxu-current-project');}catch{}
  state.project=state.projects.find(p=>p.id===current)||state.projects[0];state.sessionId=state.project.sessions.at(-1)?.id||null;
  render();
}
init().catch(error=>{$('#app').innerHTML=`<div class="boot">暂时无法打开<span>${h(error.message)}</span></div>`;});
