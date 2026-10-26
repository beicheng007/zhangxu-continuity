import test from 'node:test';
import assert from 'node:assert/strict';
import {parseChapters,extractClaims,checkDraft,validateEvidence,confirmedAliases,normalizeValue,chineseNumber,createProject,validateProject,activeFacts} from '../dist/engine.js';
import {SAMPLE_OLD,SAMPLE_NEW,SAMPLE_NEW_TITLE} from '../dist/sample.js';

function fixture(old=SAMPLE_OLD){const chapters=parseChapters(old);const facts=extractClaims(chapters).map(f=>({...f,status:'confirmed'}));return {chapters,facts,aliases:confirmedAliases({facts})};}
function check(old,text,options={}){const input=typeof old==='string'?fixture(old):old;return checkDraft({...input,draft:{id:'test-new',index:Math.max(0,...input.chapters.map(c=>c.index))+1,title:'下一章',text},...options});}
const sentence='陆沉的惯用手是左手。';

test('mixed Chinese, Arabic and English headings preserve chapters',()=>{
  const chapters=parseChapters('第一章 初来\r\n甲。\r\n第2章 再会\n乙。\nChapter 3 End\n丙。');
  assert.deepEqual(chapters.map(c=>c.title),['第一章 初来','第2章 再会','Chapter 3 End']);assert.equal(chapters[0].text,'甲。');
});
test('preface is retained as a source chapter',()=>{const c=parseChapters('故事前言\n第一章 夜\n正文');assert.equal(c[0].text,'故事前言');assert.equal(c.length,2);});
test('unheaded manuscripts retain text and source name',()=>{const c=parseChapters(sentence,'旧稿.txt');assert.equal(c.length,1);assert.equal(c[0].title,'旧稿');assert.equal(c[0].text,sentence);});
test('repeated chapter titles get distinct identities',()=>{const c=parseChapters('第一章 夜\n正文\n第一章 夜\n正文');assert.notEqual(c[0].id,c[1].id);});
test('empty and oversized import fails explicitly',()=>{assert.throws(()=>parseChapters(' \n '),/为空/);assert.throws(()=>parseChapters('字'.repeat(1_500_001)),/150 万/);});
test('a sentence mentioning a chapter is not a chapter header',()=>{const c=parseChapters('他翻开书，说起第一章的故事。\n这才是正文。');assert.equal(c.length,1);});

test('sample produces 3 explicit differences and 4 contextual reviews',()=>{
  const r=check(fixture(),SAMPLE_NEW);assert.equal(r.hardCount,3);assert.equal(r.reviewCount,4);assert.equal(r.checkedClaims,10);
  assert.deepEqual(r.findings.filter(x=>x.kind==='contradiction').map(x=>x.attribute),['handedness','eyes','capacity']);
});
test('every old and new sample quote resolves verbatim to its actual chapter',()=>{
  const input=fixture(),draft={id:'new',index:4,title:SAMPLE_NEW_TITLE,text:SAMPLE_NEW};
  const r=checkDraft({...input,draft});
  for(const f of r.findings){assert.ok(validateEvidence(input.chapters,f.previousEvidence));assert.ok(validateEvidence([draft],f.evidence));}
});
test('invented evidence cannot resolve',()=>{const {chapters,facts}=fixture(sentence);assert.equal(validateEvidence(chapters,{...facts[0].evidence,quote:'陆沉的惯用手是右手'}),false);});
test('wrong chapter cannot resolve',()=>{const {chapters,facts}=fixture(sentence);assert.equal(validateEvidence(chapters,{...facts[0].evidence,chapterId:'missing'}),false);});
test('wrong offset cannot resolve, even if quote appears elsewhere',()=>{const {chapters,facts}=fixture(sentence);assert.equal(validateEvidence(chapters,{...facts[0].evidence,start:1}),false);});
test('empty, reversed and noninteger evidence is rejected',()=>{
  const {chapters,facts}=fixture(sentence),e=facts[0].evidence;
  for(const bad of [{...e,quote:''},{...e,start:-1},{...e,end:0},{...e,start:.5}])assert.equal(validateEvidence(chapters,bad),false);
});
test('corrupted confirmed evidence is excluded from checking',()=>{const input=fixture(sentence);input.facts[0].evidence.quote='伪造';const r=check(input,'陆沉的惯用手是右手。');assert.equal(r.findings.length,0);assert.equal(r.invalidFacts,1);});
test('pending or rejected settings never become canon automatically',()=>{for(const status of ['pending','rejected']){const input=fixture(sentence);input.facts[0].status=status;assert.equal(check(input,'陆沉的惯用手是右手。').findings.length,0);}});
test('matching canon yields no difference',()=>{assert.equal(check(sentence,sentence).findings.length,0);});
test('using a right hand in action does not assert right handedness',()=>{const r=check(sentence,'陆沉用右手举起照夜剑，左手扶着城墙。');assert.equal(r.recognizedClaims,0);assert.equal(r.findings.length,0);});
test('left handed synonyms normalize to the same value',()=>{assert.equal(check(sentence,'陆沉是个左撇子。').findings.length,0);});
test('aliases are checked against their canonical entity',()=>{const r=check(fixture(),'青鸦的瞳色是蓝色。');assert.equal(r.findings.length,1);assert.equal(r.findings[0].entity,'陆沉');});
test('facts originally extracted under an alias join the canonical timeline',()=>{
  const input=fixture('第一章\n陆沉的别名是青鸦。\n陆沉的瞳色是黑色。\n第二章\n青鸦的瞳色是蓝色。');
  assert.equal(check(input,'陆沉的瞳色是蓝色。').findings.length,0);assert.equal(check(input,'陆沉的瞳色是黑色。').findings.length,1);
});
test('ambiguous aliases are rejected, not silently reassigned',()=>{assert.throws(()=>fixture('陆沉的别名是青鸦。\n顾宁的别名是青鸦。'),/多个对象/);});
test('newest confirmed chapter controls current canon',()=>{
  const input=fixture('第一章\n陆沉的阵营是北境军。\n第二章\n陆沉的阵营是南川盟。');
  assert.equal(check(input,'陆沉的阵营是南川盟。').findings.length,0);assert.equal(check(input,'陆沉的阵营是北境军。').findings.length,1);
});
test('facts from later chapters never leak into an earlier check',()=>{
  const input=fixture('第一章\n陆沉的阵营是北境军。\n第二章\n陆沉的阵营是南川盟。');
  const active=activeFacts(input.facts,2);assert.equal(active.get('陆沉\0faction').value,'北境军');
});
test('flashbacks are review prompts instead of definite static errors',()=>{const r=check(sentence,'三年前，陆沉的惯用手是右手。');assert.equal(r.hardCount,0);assert.equal(r.reviewCount,1);assert.ok(r.findings[0].flags.some(f=>f.id==='flashback'));});
test('quoted dialogue is reviewed without treating a character as a reliable narrator',()=>{const r=check(sentence,'守卫说：“陆沉的惯用手是右手。”');assert.equal(r.hardCount,0);assert.ok(r.findings[0].flags.some(f=>f.id==='dialogue'));});
test('rumor, hypothetical and dream wording lower the classification',()=>{
  for(const text of ['听说，陆沉的惯用手是右手。','假如陆沉的惯用手是右手。','梦中，陆沉的惯用手是右手。']){const r=check(sentence,text);assert.equal(r.hardCount,0);assert.equal(r.reviewCount,1);}
});
test('a question is not a definite narrator assertion',()=>{const r=check(sentence,'陆沉的惯用手是右手吗？');assert.equal(r.hardCount,0);assert.equal(r.reviewCount,1);});
test('explicit faction transitions remain review prompts',()=>{const r=check('陆沉效忠北境军。','陆沉改投南川盟。');assert.equal(r.hardCount,0);assert.equal(r.reviewCount,1);assert.ok(r.findings[0].flags.some(f=>f.id==='transition'));});
test('age differences are never assumed to be errors without a story clock',()=>{const r=check('陆沉年方二十岁。','三年后，陆沉的年龄是二十三岁。');assert.equal(r.hardCount,0);assert.equal(r.reviewCount,1);});
test('death and revival differences remain author reviews',()=>{const r=check('沈砚已经战死。','沈砚的生死状态为存活。');assert.equal(r.hardCount,0);assert.equal(r.reviewCount,1);});
test('negative claims are not treated as positive assertions',()=>{
  for(const text of ['陆沉的惯用手不是右手。','陆沉并非惯用右手。','陆沉不是右撇子。'])assert.equal(check(sentence,text).findings.length,0);
});
test('a separate paragraph does not inherit a previous flashback marker',()=>{const r=check(sentence,'他回忆起三年前的雨夜。\n\n陆沉的惯用手是右手。');assert.equal(r.hardCount,1);});
test('Chinese numerical amounts compare to Arabic numerals',()=>{assert.equal(check('银鸦卫的固定编制为三百人。','银鸦卫的固定编制为300人。').findings.length,0);});
test('Chinese numeral parser handles common unit groups',()=>{assert.equal(chineseNumber('两千零三十'),2030);assert.equal(chineseNumber('十二万三千'),123000);assert.equal(chineseNumber('一亿零三万'),100030000);});
test('length conversions compare within their own measure system',()=>{
  assert.equal(normalizeValue('length','三尺'),normalizeValue('length','三十寸'));assert.equal(normalizeValue('length','三米'),normalizeValue('length','三百厘米'));
  assert.equal(check('照夜剑的长度为三尺。','照夜剑的长度为三十寸。').findings.length,0);
});
test('blood type case and suffix are normalized',()=>{assert.equal(check('顾宁的血型是O型。','顾宁的血型是o型。').findings.length,0);});
test('same passage and canon restore the exact author decision',()=>{
  const input=fixture(sentence),text='陆沉的惯用手是右手。';const first=check(input,text),fp=first.findings[0].fingerprint;
  const next=check(input,text,{decisions:{[fp]:{status:'ignore',note:'作者确认'}}});assert.equal(next.findings[0].status,'ignore');assert.equal(next.findings[0].note,'作者确认');assert.equal(next.findings[0].remembered,true);
});
test('changed scene context does not inherit a prior ignore decision',()=>{
  const input=fixture(sentence),first=check(input,'陆沉的惯用手是右手。'),fp=first.findings[0].fingerprint;
  const next=check(input,'梦中，陆沉的惯用手是右手。',{decisions:{[fp]:{status:'ignore'}}});assert.equal(next.findings[0].status,'pending');
});
test('a changed canon value does not inherit an old author decision',()=>{
  const input=fixture(sentence),first=check(input,'陆沉的惯用手是右手。'),fp=first.findings[0].fingerprint;
  input.facts[0].value='双手';const next=check(input,'陆沉的惯用手是右手。',{decisions:{[fp]:{status:'ignore'}}});assert.equal(next.findings[0].status,'pending');
});
test('backup restores source text, findings and author decisions',()=>{
  const p=createProject('测试'),input=fixture();Object.assign(p,input);const draft={id:'draft',index:4,title:'第四章',text:SAMPLE_NEW};
  const result=checkDraft({...input,draft});p.sessions.push({...result,id:'s1',chapter:draft});const restored=validateProject(JSON.parse(JSON.stringify(p)));assert.equal(restored.chapters.length,3);assert.equal(restored.sessions[0].findings.length,7);
});
test('backup rejects a forged fact or finding quote',()=>{
  const p=createProject('测试');Object.assign(p,fixture());p.facts[0].evidence.quote='伪造';assert.throws(()=>validateProject(p),/引用/);
  const q=createProject('测试');Object.assign(q,fixture());const draft={id:'d',index:4,title:'四',text:SAMPLE_NEW};q.sessions=[{...checkDraft({...q,draft}),id:'s',chapter:draft}];q.sessions[0].findings[0].evidence.start=99;assert.throws(()=>validateProject(q),/引用/);
});
test('backup rejects duplicate source chapter identities',()=>{const p=createProject('测试');Object.assign(p,fixture());p.chapters[1].id=p.chapters[0].id;assert.throws(()=>validateProject(p),/重复章节/);});
test('empty and oversized new chapters fail explicitly',()=>{const input=fixture();assert.throws(()=>check(input,'  '),/为空/);assert.throws(()=>check(input,'字'.repeat(100001)),/10 万/);});
test('literal script-like text remains source text and is never interpreted by the engine',()=>{const input=fixture('<script>alert(1)</script>\n'+sentence);assert.equal(input.chapters[0].text.startsWith('<script>'),true);assert.equal(check(input,'陆沉的惯用手是右手。').hardCount,1);});
