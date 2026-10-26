// Shared browser/server contract. This module never calls a model or stores a key.
import {activeFacts,confirmedAliases,validateEvidence,hash,randomId} from './engine.js';

export const AI_VERSION='semantic-0.2.0';
export const AI_LIMITS=Object.freeze({draftChars:12000,contextChars:24000,excerpts:40,issues:10,outputTokens:4096});
export const AI_MODELS=Object.freeze({'deepseek-flash':'DeepSeek Flash','deepseek-v4-pro':'DeepSeek V4 Pro'});
const fail=message=>{throw new Error(message);};
const string=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const grams=text=>{const t=text.toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');const set=new Set();for(let i=0;i<t.length-1;i++)set.add(t.slice(i,i+2));return set;};

export function buildSemanticContext(project,draft){
  if(!draft.text?.trim())fail('先填写新章正文。');
  if(draft.text.length>AI_LIMITS.draftChars)fail('AI 单次最多审阅 12,000 字符，请把新章拆成较短片段。规则检查仍可处理长章。');
  const chapters=project.chapters.filter(c=>c.index<draft.index);
  if(!chapters.length)fail('先导入旧稿，AI 才有可对照的前文。');
  const aliases=confirmedAliases(project),q=grams(draft.text),all=[];
  const canon=[...activeFacts(project.facts,draft.index,aliases).values()].filter(f=>validateEvidence(chapters,f.evidence));
  const names=[...new Set(canon.flatMap(f=>[f.entity,...(aliases[f.entity]||[])]))].filter(n=>draft.text.includes(n));
  for(const c of chapters){
    for(let start=0;start<c.text.length;){
      let end=Math.min(c.text.length,start+900);
      if(end<c.text.length){const stop=c.text.lastIndexOf('\n',end);if(stop>start+450)end=stop+1;}
      const text=c.text.slice(start,end),g=grams(text);
      let score=0;for(const word of g)if(q.has(word))score+=1;
      score/=Math.sqrt(Math.max(1,g.size));
      score+=names.filter(n=>text.includes(n)).length*4;
      score+=canon.filter(f=>f.evidence.chapterId===c.id&&f.evidence.start>=start&&f.evidence.start<end&&draft.text.includes(f.entity)).length*12;
      all.push({id:`source-${all.length+1}`,chapterId:c.id,chapterIndex:c.index,title:c.title,start,text,score});start=end;
    }
  }
  // Include recent context when lexical retrieval cannot resolve pronouns.
  const recent=new Set(chapters.slice(-2).map(c=>c.id));
  for(const e of all)if(recent.has(e.chapterId))e.score+=2;
  const ranked=[...all].sort((a,b)=>b.score-a.score||b.chapterIndex-a.chapterIndex||a.start-b.start);
  const selected=[];let chars=0;
  for(const e of ranked){if(selected.length>=AI_LIMITS.excerpts)break;if(chars+e.text.length>AI_LIMITS.contextChars)continue;selected.push(e);chars+=e.text.length;}
  selected.sort((a,b)=>a.chapterIndex-b.chapterIndex||a.start-b.start);
  const excerpts=selected.map(({score,...e})=>e);
  const confirmed=canon.map(f=>{const e=excerpts.find(e=>e.chapterId===f.evidence.chapterId&&f.evidence.start>=e.start&&f.evidence.end<=e.start+e.text.length);return e?{entity:f.entity,attribute:f.label,value:f.value,sourceId:e.id,quote:f.evidence.quote}:null;}).filter(Boolean).slice(0,80);
  const totalChars=chapters.reduce((n,c)=>n+c.text.length,0);
  const sentText=draft.text+'\n'+excerpts.map(e=>e.text).join('\n');
  const relevantAliases=Object.fromEntries(Object.entries(aliases).filter(([name,values])=>[name,...values].some(n=>sentText.includes(n))).slice(0,1000).map(([name,values])=>[name,values.slice(0,30)]));
  return {version:AI_VERSION,draft:{id:draft.id,index:draft.index,title:draft.title,text:draft.text},excerpts,canon:confirmed,aliases:relevantAliases,
    coverage:{totalChapters:chapters.length,totalChars,selectedChapters:new Set(excerpts.map(e=>e.chapterId)).size,selectedChars:chars,fullBook:chars===totalChars,method:'按字词重合、已确认对象和最近两章检索，最多 24,000 字符；未选前文不在本轮覆盖内。'}};
}

export function validateSemanticPayload(input){
  if(!input||input.version!==AI_VERSION)fail('AI 请求版本不匹配，请刷新页面。');
  const d=input.draft;
  if(!d||!string(d.id,100)||!string(d.title,200)||!string(d.text,AI_LIMITS.draftChars)||!Number.isInteger(d.index)||d.index<1)fail('新章内容无效或超过 AI 单次容量。');
  if(!Array.isArray(input.excerpts)||!input.excerpts.length||input.excerpts.length>AI_LIMITS.excerpts)fail('缺少有效的前文片段。');
  const ids=new Set();let chars=0;
  const excerpts=input.excerpts.map(e=>{
    if(!e||!string(e.id,100)||ids.has(e.id)||!string(e.chapterId,100)||!string(e.title,200)||!string(e.text,1500)||!Number.isInteger(e.start)||e.start<0||e.start>3_000_000||!Number.isInteger(e.chapterIndex)||e.chapterIndex<1||e.chapterIndex>=d.index)fail('前文片段格式无效。');
    ids.add(e.id);chars+=e.text.length;return {id:e.id,chapterId:e.chapterId,chapterIndex:e.chapterIndex,title:e.title,start:e.start,text:e.text};
  });
  if(chars>AI_LIMITS.contextChars)fail('前文片段超过 AI 单次容量。');
  if(!Array.isArray(input.canon)||input.canon.length>80)fail('设定数量无效。');
  const canon=input.canon.filter(f=>string(f?.entity,100)&&string(f.attribute,100)&&string(f.value,1000)&&string(f.quote,1000)&&excerpts.some(e=>e.id===f.sourceId&&e.text.includes(f.quote))).map(f=>({entity:f.entity,attribute:f.attribute,value:f.value,sourceId:f.sourceId,quote:f.quote}));
  const aliases={};const entries=Object.entries(input.aliases||{});
  if(entries.length>1000)fail('别名过多，请分卷检查。');
  for(const [name,values] of entries){if(['__proto__','constructor','prototype'].includes(name)||!string(name,100)||!Array.isArray(values)||values.length>30||!values.every(v=>string(v,100)))fail('别名格式无效。');aliases[name]=values;}
  return {version:AI_VERSION,draft:{id:d.id,index:d.index,title:d.title,text:d.text},excerpts,canon,aliases};
}

function locate(text,quote){
  const start=text.indexOf(quote);
  return start<0||text.indexOf(quote,start+1)>=0?-1:start;
}

// Only source-backed, uniquely locatable quote pairs are accepted. No fuzzy matching.
export function validateModelIssues(value,context){
  if(!value||!Array.isArray(value.issues)||value.issues.length>AI_LIMITS.issues)fail('AI 返回格式不完整，本轮未生成审稿记录。请缩短新章后重试。');
  const issues=[],seen=new Set();let rejected=0;
  for(const x of value.issues){
    const source=context.excerpts.find(e=>e.id===x?.sourceId);
    if(!source||!string(x.entity,80)||!string(x.label,80)||!string(x.previous,500)||!string(x.current,500)||!string(x.reason,1000)||!string(x.oldQuote,600)||!string(x.newQuote,600)||!['conflict','uncertain'].includes(x.category)){rejected++;continue;}
    const os=locate(source.text,x.oldQuote),ns=locate(context.draft.text,x.newQuote);
    if(os<0||ns<0){rejected++;continue;}
    const key=JSON.stringify([source.chapterId,source.start+os,x.oldQuote,ns,x.newQuote]);
    if(seen.has(key)){rejected++;continue;}seen.add(key);
    issues.push({entity:x.entity,label:x.label,previous:x.previous,current:x.current,reason:x.reason,category:x.category,sourceId:source.id,oldQuote:x.oldQuote,newQuote:x.newQuote,
      previousEvidence:{chapterId:source.chapterId,start:source.start+os,end:source.start+os+x.oldQuote.length,quote:x.oldQuote},
      evidence:{chapterId:context.draft.id,start:ns,end:ns+x.newQuote.length,quote:x.newQuote}});
  }
  return {issues,rejected};
}

export function semanticFindings(raw,context,project,canonSignature=''){
  const valid=validateModelIssues({issues:raw},context);
  let rejected=valid.rejected;
  const findings=valid.issues.flatMap(x=>{
    if(!validateEvidence(project.chapters,x.previousEvidence)||!validateEvidence([context.draft],x.evidence)){rejected++;return [];}
    const fingerprint='ai-'+hash(JSON.stringify([x.entity,x.label,x.previousEvidence,context.draft.title,context.draft.text,canonSignature]));
    const saved=Object.hasOwn(project.decisions||{},fingerprint)?project.decisions[fingerprint]:null;
    const remembered=saved&&['error','change','ignore'].includes(saved.status)?saved:null;
    return [{id:'ai-'+randomId(),fingerprint,entity:x.entity,attribute:'semantic',label:x.label,expected:x.previous,actual:x.current,kind:'semantic',evidence:x.evidence,previousEvidence:x.previousEvidence,
      flags:[{id:'ai',label:x.category==='uncertain'?'语境待确认':'AI 提出的疑点'}],reason:x.reason,status:remembered?.status||'pending',remembered:!!remembered,note:remembered?.note||'',origin:'ai'}];
  });
  return {findings,rejected};
}
