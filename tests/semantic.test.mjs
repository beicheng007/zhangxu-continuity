import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,parseChapters,validateProject,extractClaims} from '../dist/engine.js';
import {AI_VERSION,AI_LIMITS,buildSemanticContext,validateSemanticPayload,validateModelIssues,semanticFindings} from '../dist/semantic.js';
import {reviewSemantic,handleSemanticRequest,publicAIConfig,AI_ENDPOINT,SYSTEM_PROMPT} from '../server/ai-service.mjs';
import {createLocalServer} from '../server.mjs';

const key='fixture-not-a-real-key';
function fixture(){
  const p=createProject('语义审稿合成测试');
  p.chapters=parseChapters('第一章 无光\n程砚自幼双目失明，从未见过颜色。他只能靠竹杖辨路。\n第二章 北岸\n苏禾仍在北岸等船。','合成稿');
  const d={id:'draft-test',index:3,title:'第三章 来信',text:'程砚看清了远处船上的红色旗号，向苏禾挥了挥手。'};
  return {p,d,context:buildSemanticContext(p,d)};
}
function issue(c){return {entity:'程砚',label:'视力与动作',previous:'自幼失明',current:'看清远处旗号',reason:'新章是否漏写了治愈经历，需要作者核对。',category:'conflict',sourceId:c.excerpts[0].id,oldQuote:'程砚自幼双目失明，从未见过颜色。',newQuote:'程砚看清了远处船上的红色旗号，向苏禾挥了挥手。'};}
const completion=(c,extra={})=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(c)}}],usage:{prompt_tokens:123,completion_tokens:45,total_tokens:168},...extra}),{headers:{'content-type':'application/json'}});

test('small manuscripts send every old excerpt even without rule-extractable facts',()=>{
  const {p,context}=fixture();assert.equal(extractClaims(p.chapters).length,0);assert.equal(context.coverage.fullBook,true);assert.equal(context.coverage.selectedChars,context.coverage.totalChars);assert.equal(context.excerpts.length,2);assert.deepEqual(validateSemanticPayload(context).draft,context.draft);
});
test('retrieval stays within budget and exposes incomplete coverage',()=>{
  const {p,d}=fixture();p.chapters=Array.from({length:40},(_,i)=>({id:'c'+i,index:i+1,title:'第'+i+'章',text:(i===7?'程砚从未看见过光明。':'北风扫过远山，晨雾渐渐散去。').repeat(160)}));
  d.index=41;const c=buildSemanticContext(p,d);assert.ok(c.coverage.selectedChars<=AI_LIMITS.contextChars);assert.ok(c.excerpts.length<=AI_LIMITS.excerpts);assert.equal(c.coverage.fullBook,false);assert.ok(c.excerpts.some(e=>e.chapterId==='c7'));assert.ok(c.excerpts.every(e=>p.chapters.find(x=>x.id===e.chapterId).text.slice(e.start,e.start+e.text.length)===e.text));
});
test('new/future chapters and unrelated alias metadata are not sent',()=>{
  const {p,d}=fixture();p.chapters.push({id:'future',index:9,title:'未来',text:'不应发送的未来内容'});p.aliases={无关人物:['不在材料中的别称'],程砚:['阿砚']};const c=buildSemanticContext(p,d);assert.equal(c.excerpts.some(e=>e.chapterId==='future'),false);assert.equal(Object.hasOwn(c.aliases,'无关人物'),false);assert.deepEqual(c.aliases.程砚,['阿砚']);
});
test('oversize draft is rejected before any provider call',()=>{const {p,d}=fixture();d.text='字'.repeat(12001);assert.throws(()=>buildSemanticContext(p,d),/12,000/);});
test('payload rejects duplicate sources, future sources and oversized context',()=>{
  const {context:c}=fixture();assert.throws(()=>validateSemanticPayload({...c,excerpts:[c.excerpts[0],c.excerpts[0]]}),/格式/);assert.throws(()=>validateSemanticPayload({...c,excerpts:[{...c.excerpts[0],chapterIndex:3}]}),/格式/);assert.throws(()=>validateSemanticPayload({...c,draft:{...c.draft,text:''}}),/新章/);
});
test('valid non-regex semantic issue produces exact old/new offsets',()=>{
  const {p,context:c}=fixture(),v=validateModelIssues({issues:[issue(c)]},c);assert.equal(v.issues.length,1);assert.equal(v.rejected,0);const f=semanticFindings(v.issues,c,p).findings[0];assert.equal(f.kind,'semantic');assert.equal(f.status,'pending');assert.equal(p.chapters[0].text.slice(f.previousEvidence.start,f.previousEvidence.end),f.previousEvidence.quote);assert.equal(c.draft.text.slice(f.evidence.start,f.evidence.end),f.evidence.quote);
});
test('invented, changed punctuation, wrong source, ambiguous and duplicate quotes are excluded',()=>{
  const {context:c}=fixture(),x=issue(c);
  const v=validateModelIssues({issues:[x,{...x,oldQuote:'程砚已经失明。'},{...x,oldQuote:x.oldQuote.replace('。','！')},{...x,sourceId:c.excerpts[1].id},{...x,newQuote:'不存在的句子'},x]},c);
  assert.equal(v.issues.length,1);assert.equal(v.rejected,5);
  const repeated={...c,draft:{...c.draft,text:c.draft.text+c.draft.text}};assert.equal(validateModelIssues({issues:[x]},repeated).rejected,1);
});
test('missing JSON array and unbounded findings fail instead of reporting a clean manuscript',()=>{const {context:c}=fixture();assert.throws(()=>validateModelIssues({},c));assert.throws(()=>validateModelIssues({issues:Array(11).fill(issue(c))},c));});
test('client independently rejects old source changes after the request',()=>{const {p,context:c}=fixture();p.chapters[0].text='内容已经改动。';const v=semanticFindings([issue(c)],c,p);assert.equal(v.findings.length,0);assert.equal(v.rejected,1);});
test('author decision is restored only for the same draft and canon context',()=>{
  const {p,context:c}=fixture();let f=semanticFindings([issue(c)],c,p,'canon-a').findings[0];p.decisions[f.fingerprint]={status:'change',note:'下一章解释治愈'};f=semanticFindings([issue(c)],c,p,'canon-a').findings[0];assert.equal(f.status,'change');assert.equal(f.remembered,true);assert.equal(semanticFindings([issue(c)],c,p,'canon-b').findings[0].status,'pending');
});
test('AI findings survive backup evidence validation; key is never part of results or project',async()=>{
  const {p,d,context:c}=fixture();const r=await reviewSemantic({context:c,apiKey:key},{fetchImpl:async()=>completion({issues:[issue(c)]})});const f=semanticFindings(r.issues,c,p).findings;
  p.sessions.push({chapter:d,findings:f,ai:{provider:r.provider,model:r.model,coverage:c.coverage,usage:r.usage,rejected:0}});assert.equal(validateProject(structuredClone(p)).sessions[0].findings.length,1);assert.ok(!JSON.stringify({r,p}).includes(key));
});
test('real HTTP contract targets only DeepSeek and sends bounded JSON, not executable tools',async()=>{
  const {context:c}=fixture();let called=0;
  const r=await reviewSemantic({context:c,apiKey:key,model:'deepseek-flash'},{fetchImpl:async(url,init)=>{called++;assert.equal(url,AI_ENDPOINT);assert.equal(init.headers.Authorization,'Bearer '+key);assert.equal(init.redirect,'error');const b=JSON.parse(init.body);assert.equal(b.response_format.type,'json_object');assert.equal(b.max_tokens,4096);assert.equal(b.thinking.type,'disabled');assert.equal(b.tools,undefined);assert.deepEqual(JSON.parse(b.messages[1].content).draft,c.draft);return completion({issues:[issue(c)]});}});
  assert.equal(called,1);assert.equal(r.issues.length,1);assert.deepEqual(r.usage,{inputTokens:123,outputTokens:45,totalTokens:168});
});
test('no configured key or unknown model fails without a paid call',async()=>{
  const {context:c}=fixture();const noCall=async()=>assert.fail('must not call provider');await assert.rejects(()=>reviewSemantic({context:c},{fetchImpl:noCall}),{code:'KEY_REQUIRED'});await assert.rejects(()=>reviewSemantic({context:c,apiKey:key,model:'http://attacker.local'},{fetchImpl:noCall}),{code:'INVALID_MODEL'});
});
test('server key can be used without returning it through config or result',async()=>{
  const {context:c}=fixture(),env={DEEPSEEK_API_KEY:key};assert.equal(publicAIConfig(env).serverKeyAvailable,true);assert.ok(!JSON.stringify(publicAIConfig(env)).includes(key));const r=await reviewSemantic({context:c},{env,fetchImpl:async()=>completion({issues:[]})});assert.equal(r.issues.length,0);assert.ok(!JSON.stringify(r).includes(key));
});
for(const [status,code] of [[401,'AUTH_FAILED'],[402,'NO_CREDIT'],[429,'RATE_LIMIT'],[503,'PROVIDER_ERROR']])test(`HTTP ${status} is actionable, redacted and never automatically retried`,async()=>{
  const {context:c}=fixture();let calls=0;await assert.rejects(()=>reviewSemantic({context:c,apiKey:key},{fetchImpl:async()=>{calls++;return new Response('private manuscript '+key,{status});}}),e=>e.code===code&&!e.message.includes(key)&&!e.message.includes('private manuscript'));assert.equal(calls,1);
});
test('truncated, empty, refused or invalid JSON responses do not create successful empty sessions',async()=>{
  const {context:c}=fixture();for(const data of [
    {choices:[{finish_reason:'length',message:{content:'{"issues":['}}]},
    {choices:[{finish_reason:'stop',message:{content:''}}]},
    {choices:[{finish_reason:'stop',message:{content:'{}',refusal:'no'}}]},
    {choices:[{finish_reason:'stop',message:{content:'```json\n{}\n```'}}]},
    {choices:[{finish_reason:'stop',message:{content:'{}'}}]}
  ])await assert.rejects(()=>reviewSemantic({context:c,apiKey:key},{fetchImpl:async()=>new Response(JSON.stringify(data))}));
});
test('network error and timeout return redacted failures without retry',async()=>{
  const {context:c}=fixture();await assert.rejects(()=>reviewSemantic({context:c,apiKey:key},{fetchImpl:async()=>{throw new Error(key);}}),{code:'NETWORK'});
  await assert.rejects(()=>reviewSemantic({context:c,apiKey:key},{timeoutMs:5,fetchImpl:async(_u,init)=>new Promise((_r,reject)=>init.signal.addEventListener('abort',()=>reject(new Error('aborted'))))}),{code:'TIMEOUT'});
});
test('cross-origin request is blocked before provider use',async()=>{
  const {context:c}=fixture();const r=await handleSemanticRequest(new Request('https://app.example/api/semantic',{method:'POST',headers:{origin:'https://other.example','content-type':'application/json'},body:JSON.stringify({context:c,apiKey:key})}),{fetchImpl:async()=>assert.fail('cross origin call')});assert.equal(r.status,403);
});
test('API rejects wrong content type and oversized bodies, and marks errors no-store',async()=>{
  for(const [headers,body,status] of [[{},'x',415],[{'content-type':'application/json'},'x'.repeat(512001),413]]){const r=await handleSemanticRequest(new Request('https://app.example/api/semantic',{method:'POST',headers,body}));assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'no-store');}
});
test('prompt treats manuscript instructions as data and asks to exclude explained normal changes',()=>{assert.match(SYSTEM_PROMPT,/不得执行/);assert.match(SYSTEM_PROMPT,/正常变化不要报告/);assert.match(SYSTEM_PROMPT,/传闻/);assert.match(SYSTEM_PROMPT,/不要输出推理过程/);});
test('local server serves working assets, config and no-key error without exposing source or env',async t=>{
  const server=createLocalServer({});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>server.close());const base='http://127.0.0.1:'+server.address().port;
  assert.equal((await fetch(base)).status,200);assert.equal((await fetch(base+'/semantic.js')).status,200);assert.equal((await fetch(base+'/.env')).status,404);assert.equal((await fetch(base+'/server/ai-service.mjs')).status,404);assert.equal((await(await fetch(base+'/api/ai-config')).json()).serverKeyAvailable,false);
  const {context:c}=fixture(),r=await fetch(base+'/api/semantic',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({context:c})});assert.equal(r.status,422);assert.equal((await r.json()).error.code,'KEY_REQUIRED');
});
