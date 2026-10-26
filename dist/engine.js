// Pure, browser-local checking engine. No requests, AI simulation or hidden results.
export const ENGINE_VERSION = '0.1.0';
export const MAX_TEXT_LENGTH = 1_500_000;
export const ATTRIBUTES = {
  handedness: { label: '惯用手', stable: true },
  eyes: { label: '瞳色', stable: true },
  blood: { label: '血型', stable: true },
  father: { label: '生父', stable: true },
  mother: { label: '生母', stable: true },
  birthplace: { label: '出生地', stable: true },
  age: { label: '年龄', stable: false },
  faction: { label: '阵营', stable: false },
  status: { label: '生死状态', stable: false },
  capacity: { label: '固定编制', stable: true },
  length: { label: '长度', stable: true },
  alias: { label: '别名', stable: false },
};
const HAN = '[\\p{Script=Han}·]';
const NUM = '[零〇一二两三四五六七八九十百千万亿\\d]+';
const NAME = `${HAN}{2,12}`;
const PREFIX = '(?:^|[。！？!?；;\\n，,：:“”「」\\s])';
const specs = [
  ['handedness', '(?:的)?(?:惯用手|主用手)(?:是|为|：|:)\\s*(左手|右手|双手)'],
  ['handedness', '(?:一向|向来|一直)?惯用(左手|右手|双手)'],
  ['handedness', '(?:是|是个|是一个)(左撇子|右撇子)'],
  ['eyes', '(?:的)?(?:瞳色|眼睛颜色|双眼颜色|眼眸颜色)(?:是|为|：|:)\\s*(墨黑色|深蓝色|浅蓝色|深棕色|浅棕色|赤红色|黑色|蓝色|棕色|褐色|绿色|金色|灰色|红色|紫色|黑|蓝|棕|褐|绿|金|灰|红|紫)(?![\\p{Script=Han}])'],
  ['blood', '(?:的)?血型(?:是|为|：|:)\\s*(AB|A|B|O|ab|a|b|o)(?:型)?'],
  ['father', `(?:的)?(?:生父|亲生父亲)(?:是|为|：|:)\\s*(${NAME})`],
  ['mother', `(?:的)?(?:生母|亲生母亲)(?:是|为|：|:)\\s*(${NAME})`],
  ['birthplace', `(?:的)?出生地(?:是|为|：|:)\\s*(${NAME})`],
  ['age', `(?:的)?(?:年龄(?:是|为|：|:)?|年方|时年|今年|现年)\\s*(${NUM}岁)`],
  ['faction', `(?:的)?(?:阵营|所属阵营|所属势力)(?:是|为|：|:)\\s*(${NAME})`],
  ['faction', `(?:隶属于|隶属|效忠于|效忠|归属于|归属|改投|转投|投奔|加入)\\s*(${NAME})`],
  ['status', '(?:的)?(?:生死状态|状态)(?:是|为|：|:)\\s*(已经死亡|已经战死|已死亡|已战死|已死|死亡|战死|存活|活着|生还)'],
  ['status', '(已经战死|已经死去|已经死亡|已战死|已死去|仍然活着|尚在人世)'],
  ['capacity', `(?:的)?(?:固定编制|核定编制|固定名额|规定总数)(?:是|为|：|:)\\s*(${NUM}(?:人|名|个|位|支|枚))`],
  ['length', `(?:的)?(?:全长|长度)(?:是|为|：|:)\\s*(${NUM}(?:点${NUM})?(?:米|厘米|毫米|尺|寸|丈))`],
  ['alias', `(?:的)?(?:别名|绰号|别号)(?:是|为|叫|：|:)\\s*[“「]?(${NAME})`],
];
const BAD_SUBJECT = /^(?:他的|她的|他们|她们|这个|那个|有人|众人|不过|但是|只见|原来|据说|听说|传闻|其实|如果|假如|倘若|或许|可能|也许|不是|并非)/;
const CONTEXTS = [
  ['flashback', '回忆 / 过去', /(?:回忆|忆起|记起|想起|曾经|从前|当年|那年|幼年|童年|前世|昔日|[一二两三四五六七八九十百\d]+年前)/],
  ['uncertain', '传闻 / 不确定', /(?:据说|听说|传闻|谣言|谎称|佯称|假称|似乎|或许|也许|可能|未必|如果|假如|倘若|万一|难道|莫非)/],
  ['disguise', '梦境 / 伪装', /(?:梦中|梦见|梦境|幻境|幻觉|假死|佯死|伪装|冒充|易容|假扮|装扮|染成|染色|美瞳)/],
  ['transition', '明确变化', /(?:改投|转投|投奔|叛离|改为|变为|变成|从此|自此|加入|脱离|退出|不再|复活|起死回生|归顺|重新效忠)/],
  ['elapsed', '时间推进', /(?:[一二两三四五六七八九十百\d]+年后|[一二两三四五六七八九十百\d]+年过去|多年之后|数年之后|时隔|多年后)/],
];

export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
export function randomId() {
  if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
  const bytes=new Uint8Array(16);
  if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(bytes);
  else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
export function cleanText(text) {
  return String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
}
export function parseChapters(raw, sourceName = '粘贴稿件', offset = 0) {
  const text = cleanText(raw);
  if (!text.trim()) throw new Error('稿件为空，请粘贴或选择有内容的文件。');
  if (text.length > MAX_TEXT_LENGTH) throw new Error('本次导入上限为 150 万字符，请按卷分批导入。');
  const regex = /^[\t \u3000]*(?:#{1,6}\s*)?((?:第[零〇一二两三四五六七八九十百千万\d]+[章节回](?:[^\n]{0,70})|(?:Chapter|CHAPTER)\s+\d+[^\n]{0,70}))[\t ]*$/gm;
  const heads = [...text.matchAll(regex)];
  const segments = [];
  if (!heads.length) segments.push({ title: sourceName.replace(/\.(txt|md|docx)$/i, '') || '未分章稿件', text: text.trim() });
  else {
    const preface = text.slice(0, heads[0].index).trim();
    if (preface) segments.push({ title: '卷首 · 导入前言', text: preface });
    heads.forEach((h, i) => {
      segments.push({ title: h[1].trim(), text: text.slice(h.index + h[0].length, heads[i+1]?.index ?? text.length).trim() });
    });
  }
  if (segments.length > 1500) throw new Error('单次最多导入 1500 章，请按卷拆分。');
  return segments.map((s, i) => ({
    id: 'ch-' + hash(`${offset+i+1}|${s.title}|${s.text}`), index: offset+i+1,
    title: s.title, text: s.text, sourceName, importedAt: new Date().toISOString(),
  }));
}

export function chineseNumber(str) {
  if (/^\d+(?:\.\d+)?$/.test(str)) return Number(str);
  const digits = { 零:0, 〇:0, 一:1, 二:2, 两:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9 };
  if (/^[零〇一二两三四五六七八九]+$/.test(str)) return Number([...str].map(c=>digits[c]).join(''));
  let total=0, section=0, n=0;
  for (const c of str) {
    if (c in digits) n=digits[c];
    else if ('十百千'.includes(c)) { section+=(n||1)*({十:10,百:100,千:1000}[c]); n=0; }
    else if (c==='万') { section=(section+n)*10000; total+=section; section=0;n=0; }
    else if (c==='亿') { total=(total+section+n)*100000000; section=0;n=0; }
    else return NaN;
  }
  return total+section+n;
}
export function normalizeValue(attribute, raw) {
  let v=String(raw).trim().replace(/[“”「」\s]/g, '');
  if(attribute==='handedness') return ({左撇子:'左手',右撇子:'右手'})[v]||v;
  if(attribute==='eyes') return ({黑:'黑色',蓝:'蓝色',棕:'棕色',褐:'褐色',绿:'绿色',金:'金色',灰:'灰色',红:'红色',紫:'紫色',墨黑色:'黑色'})[v]||v;
  if(attribute==='blood') return v.toUpperCase().replace(/型$/, '');
  if(attribute==='status') return /死|死亡/.test(v)?'已死':'存活';
  if(['age','capacity','length'].includes(attribute)) {
    const m=v.match(/^([零〇一二两三四五六七八九十百千万亿\d]+)(?:点([零〇一二两三四五六七八九\d]+))?(.*)$/);
    if(m) {
      let n=chineseNumber(m[1]);
      if(m[2]) n+=Number('0.'+[...m[2]].map(c=>/\d/.test(c)?c:chineseNumber(c)).join(''));
      let unit=m[3];
      if(attribute==='length' && ['米','厘米','毫米'].includes(unit)) { n*=({米:1000,厘米:10,毫米:1})[unit];unit='毫米'; }
      if(attribute==='length' && ['丈','尺','寸'].includes(unit)) { n*=({丈:100,尺:10,寸:1})[unit];unit='寸'; }
      return `${n}${attribute==='age'?'岁':unit}`;
    }
  }
  return v;
}
function contextFor(text, start, end) {
  let a=start, b=end;
  while(a>0 && !/[。！？!?\n]/.test(text[a-1])) a--;
  while(b<text.length && !/[。！？!?\n]/.test(text[b])) b++;
  if(b<text.length) b++;
  // Carry explicit scene markers only within the current paragraph, not across a scene break.
  const paragraphBoundary=text.lastIndexOf('\n\n',start);
  const paragraphStart=paragraphBoundary<0?0:paragraphBoundary+2;
  const prior=text.slice(Math.max(paragraphStart,start-100),start);
  const sentence=text.slice(a,b);
  const scope=prior+text.slice(start,b);
  const flags=CONTEXTS.filter(([, ,re])=>re.test(scope)).map(([id,label])=>({id,label}));
  const quotePrefix=text.slice(a,start);
  const openQuotes=(quotePrefix.match(/[“「『]/g)||[]).length;
  const closeQuotes=(quotePrefix.match(/[”」』]/g)||[]).length;
  if(openQuotes>closeQuotes || /[“「『].*[”」』]/.test(sentence)) flags.push({id:'dialogue',label:'人物话语'});
  if(/[？?]/.test(sentence) && !flags.some(f=>f.id==='uncertain')) flags.push({id:'uncertain',label:'疑问句'});
  return { start:a,end:b,text:sentence,flags };
}
export function validateEvidence(chapters, evidence) {
  if(!evidence || !Number.isInteger(evidence.start) || !Number.isInteger(evidence.end) || evidence.start<0 || evidence.end<=evidence.start || !evidence.quote?.trim()) return false;
  const ch=chapters.find(c=>c.id===evidence.chapterId);
  return !!ch && ch.text.slice(evidence.start,evidence.end)===evidence.quote;
}
export function extractClaims(chapters, aliases = {}) {
  const out=[];
  const aliasMap=new Map();
  for(const [canonical,names] of Object.entries(aliases)) {
    aliasMap.set(canonical,canonical);
    for(const name of names) if(name?.trim()) aliasMap.set(name.trim(),canonical);
  }
  // Known names permit prose before the name and prevent greedy subject capture.
  const known=[...aliasMap.keys()].sort((a,b)=>b.length-a.length).map(escapeRegExp);
  const subject=known.length ? `(${known.join('|')})` : `(${HAN}{2,8}?)`;
  const prefix=known.length ? '' : PREFIX;
  for(const chapter of chapters) {
    const seen=new Set();
    for(const [attribute,pattern] of specs) {
      const re=new RegExp(prefix+subject+'\\s*'+pattern,'gu');
      let m;
      while((m=re.exec(chapter.text))) {
        const entity=aliasMap.get(m[1])||m[1];
        if(BAD_SUBJECT.test(entity)) continue;
        const local=m[0].indexOf(m[1]);
        const start=m.index+local, end=m.index+m[0].length;
        // Never turn a negated or quoted absence into a positive assertion.
        const before=chapter.text.slice(Math.max(0,start-8),start);
        if(/(?:并非|不是|并不是|并未|没有|不是说|不代表)\s*$/.test(before)) continue;
        const value=m[2]?.trim();
        if(!value || value.length>32) continue;
        const key=`${start}:${end}:${attribute}`;
        if(seen.has(key)) continue;
        seen.add(key);
        const context=contextFor(chapter.text,start,end);
        const evidence={chapterId:chapter.id,start,end,quote:chapter.text.slice(start,end)};
        if(!validateEvidence([chapter],evidence)) continue;
        out.push({
          id:'fact-'+hash(`${chapter.id}|${key}|${entity}|${value}`),
          entity, mentionedAs:m[1], attribute, label:ATTRIBUTES[attribute].label,
          value, normalizedValue:normalizeValue(attribute,value),
          evidence, context:context.text, flags:context.flags,
          chapterIndex:chapter.index, status:'pending',
        });
      }
    }
  }
  return out.sort((a,b)=>a.chapterIndex-b.chapterIndex || a.evidence.start-b.evidence.start);
}
export function aliasLookup(aliases) {
  const lookup=new Map();
  for(const [canonical,names] of Object.entries(aliases)) {
    for(const name of names) {
      if(lookup.has(name)&&lookup.get(name)!==canonical) throw new Error(`别名“${name}”对应多个对象，请先核对别名设定。`);
      lookup.set(name,canonical);
    }
  }
  const resolve=name=>{
    const seen=new Set();let current=name;
    while(lookup.has(current)&&lookup.get(current)!==current){if(seen.has(current))throw new Error('别名之间存在循环，请先核对。');seen.add(current);current=lookup.get(current);}
    return current;
  };
  const result=new Map();
  for(const [canonical,names] of Object.entries(aliases))for(const name of [canonical,...names])result.set(name,resolve(name));
  return result;
}
export function activeFacts(facts, atIndex=Infinity, aliases={}) {
  const map=new Map();
  const lookup=aliasLookup(aliases);
  for(const fact of [...facts].sort((a,b)=>a.chapterIndex-b.chapterIndex || a.evidence.start-b.evidence.start)) {
    if(fact.status!=='confirmed' || fact.attribute==='alias' || fact.chapterIndex>=atIndex) continue;
    map.set(`${lookup.get(fact.entity)||fact.entity}\0${fact.attribute}`,fact);
  }
  return map;
}
export function confirmedAliases(project) {
  const aliases=Object.create(null);
  const add=(entity,name)=>{ aliases[entity]??=[];if(name && name!==entity && !aliases[entity].includes(name)) aliases[entity].push(name); };
  for(const fact of project.facts||[]) if(fact.status==='confirmed') {add(fact.entity);if(fact.attribute==='alias')add(fact.entity,fact.value);}
  for(const [entity,names] of Object.entries(project.aliases||{})) {add(entity);for(const n of names)add(entity,n);}
  const lookup=aliasLookup(aliases),merged=Object.create(null);
  for(const [name,canonical] of lookup) {merged[canonical]??=[];if(name!==canonical&&!merged[canonical].includes(name))merged[canonical].push(name);}
  return merged;
}
export function checkDraft({chapters,facts,aliases={},draft,decisions={}}) {
  if(!draft.text?.trim()) throw new Error('新章为空，请先输入内容。');
  if(draft.text.length>100_000) throw new Error('单次新章上限为 10 万字符，请分章检查。');
  const verified=facts.filter(f=>f.status==='confirmed' && validateEvidence(chapters,f.evidence));
  const allAliases=confirmedAliases({facts:verified,aliases});
  const active=activeFacts(verified,draft.index,allAliases);
  const claims=Object.keys(allAliases).length?extractClaims([draft],allAliases):[];
  const findings=[];let matched=0;
  for(const claim of claims) {
    const fact=active.get(`${claim.entity}\0${claim.attribute}`);
    if(!fact) continue;
    matched++;
    if(normalizeValue(fact.attribute,fact.value)===claim.normalizedValue) continue;
    const flags=claim.flags;
    const contextual=flags.some(f=>['flashback','uncertain','disguise','dialogue','transition','elapsed'].includes(f.id));
    const hard=ATTRIBUTES[fact.attribute]?.stable && !contextual;
    const fingerprint=hash(`${fact.id}|${fact.value}|${draft.title}|${claim.context}|${claim.evidence.quote}`);
    let reason=hard?'同一对象的明确属性与已确认设定不同，请核对是否写错或需要更新设定。':'本次叙述与已确认设定不同，可能是剧情变化，请结合上下文判断。';
    if(flags.some(f=>f.id==='flashback')) reason='这段可能在叙述过去，当前设定未必适用，请按故事时间核对。';
    else if(flags.some(f=>f.id==='dialogue'||f.id==='uncertain')) reason='这段含人物话语、传闻或疑问，不能直接认定叙述事实错误。';
    else if(flags.some(f=>f.id==='transition')) reason='原文含明确变化线索，可能是正常剧情推进，请确认后再更新设定。';
    else if(flags.some(f=>f.id==='disguise')) reason='原文含梦境或伪装线索，请确认是否属于真实状态。';
    else if(fact.attribute==='age') reason='年龄不同可能来自时间推进，本轮没有自动换算故事时间。';
    const remembered=decisions[fingerprint];
    const rememberedStatus=remembered && ['error','change','ignore'].includes(remembered.status)?remembered.status:'pending';
    findings.push({
      id:'issue-'+hash(`${fact.id}|${draft.id}|${claim.id}`),fingerprint,
      entity:claim.entity,attribute:claim.attribute,label:claim.label,
      expected:fact.value,actual:claim.value,kind:hard?'contradiction':'review',
      evidence:claim.evidence,previousEvidence:fact.evidence,
      factId:fact.id,claim,flags,reason,status:rememberedStatus,
      remembered:rememberedStatus!=='pending',note:remembered?.note||'',
    });
  }
  return {
    findings,claims,checkedClaims:matched,recognizedClaims:claims.length,
    confirmedFacts:active.size,invalidFacts:facts.filter(f=>f.status==='confirmed').length-verified.length,
    hardCount:findings.filter(f=>f.kind==='contradiction').length,
    reviewCount:findings.filter(f=>f.kind==='review').length,
    version:ENGINE_VERSION,
  };
}
export function createProject(name) {
  return {schemaVersion:1,id:randomId(),name:name.trim()||'未命名作品',chapters:[],facts:[],aliases:{},decisions:{},sessions:[],draftTitle:'',draftText:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
}
export function validateProject(p) {
  if(!p || p.schemaVersion!==1 || typeof p.id!=='string' || typeof p.name!=='string' || !Array.isArray(p.chapters) || !Array.isArray(p.facts) || !Array.isArray(p.sessions)) throw new Error('备份格式不正确，或版本暂不支持。');
  if(p.chapters.length>3000 || p.facts.length>50000 || p.sessions.length>200) throw new Error('备份内容超过当前版本容量。');
  const ids=new Set();
  for(const c of p.chapters) {
    if(typeof c.id!=='string'||ids.has(c.id)||typeof c.title!=='string'||typeof c.text!=='string'||!Number.isInteger(c.index)||c.index<1) throw new Error('备份中有无效或重复章节。');
    ids.add(c.id);
  }
  if(p.chapters.reduce((n,c)=>n+c.text.length,0)>3_000_000) throw new Error('备份正文超过 300 万字符，请分卷保存。');
  for(const f of p.facts) {
    if(typeof f.id!=='string'||typeof f.entity!=='string'||!ATTRIBUTES[f.attribute]||typeof f.value!=='string'||!['confirmed','pending','rejected'].includes(f.status)||!Number.isInteger(f.chapterIndex)||!validateEvidence(p.chapters,f.evidence)) throw new Error('备份设定的原文引用无效，未导入。');
  }
  for(const s of p.sessions) {
    if(!s.chapter||typeof s.chapter.text!=='string'||typeof s.chapter.id!=='string'||!Array.isArray(s.findings)) throw new Error('备份检查记录无效。');
    if(s.ai){
      const c=s.ai.coverage,u=s.ai.usage,n=v=>Number.isSafeInteger(v)&&v>=0;
      if(!c||!u||s.ai.provider!=='DeepSeek'||!['deepseek-flash','deepseek-v4-pro'].includes(s.ai.model)||!['totalChapters','totalChars','selectedChapters','selectedChars'].every(k=>n(c[k]))||c.selectedChars>c.totalChars||c.selectedChapters>c.totalChapters||typeof c.fullBook!=='boolean'||!['inputTokens','outputTokens','totalTokens'].every(k=>u[k]===null||n(u[k]))||!n(s.ai.rejected))throw new Error('备份 AI 审稿信息无效。');
    }
    for(const f of s.findings) {
      if(!['pending','error','change','ignore'].includes(f.status)||!validateEvidence([s.chapter],f.evidence)||!validateEvidence(p.chapters,f.previousEvidence)) throw new Error('备份检查记录的引用无效。');
    }
  }
  // Do not permit imported prototype keys to become entity/alias maps.
  const aliases={};
  for(const [k,v] of Object.entries(p.aliases||{})) {
    if(['__proto__','constructor','prototype'].includes(k)||!Array.isArray(v)||!v.every(n=>typeof n==='string' && n.length<40)) throw new Error('备份别名格式无效。');
    aliases[k]=v;
  }
  confirmedAliases({...p,aliases});
  return {...p,aliases,decisions:p.decisions&&typeof p.decisions==='object'?p.decisions:{},draftText:String(p.draftText||''),draftTitle:String(p.draftTitle||'')};
}
