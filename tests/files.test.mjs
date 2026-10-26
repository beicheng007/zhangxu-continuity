import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {readManuscript,unzipDocument} from '../dist/files.js';
function zipDocument(xml,{compressed=true,encrypted=false,advertisedSize}={}){
  const name=Buffer.from('word/document.xml'),raw=Buffer.from(xml),body=compressed?deflateRawSync(raw):raw;
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(encrypted?1:0,6);local.writeUInt16LE(compressed?8:0,8);local.writeUInt32LE(body.length,18);local.writeUInt32LE(advertisedSize??raw.length,22);local.writeUInt16LE(name.length,26);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(encrypted?1:0,8);central.writeUInt16LE(compressed?8:0,10);central.writeUInt32LE(body.length,20);central.writeUInt32LE(advertisedSize??raw.length,24);central.writeUInt16LE(name.length,28);
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(local.length+name.length+body.length,16);
  return Uint8Array.from(Buffer.concat([local,name,body,central,name,end])).buffer;
}
const xml='<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>陆沉惯用左手。</w:t></w:r></w:p></w:body></w:document>';
test('UTF-8 text import retains Chinese and line breaks',async()=>{assert.equal(await readManuscript(new File(['第一章\n正文'],'稿件.txt')),'第一章\n正文');});
test('GB18030 text falls back correctly when UTF-8 fails',async()=>{assert.equal(await readManuscript(new File([Uint8Array.from([0xd6,0xd0,0xce,0xc4])],'旧稿.txt')),'中文');});
test('legacy DOC and oversized files are rejected',async()=>{await assert.rejects(()=>readManuscript(new File(['x'],'稿件.doc')),/旧版 DOC/);await assert.rejects(()=>readManuscript(new File([new Uint8Array(8*1024*1024+1)],'稿件.txt')),/8 MB/);});
test('compressed DOCX document XML is extracted',async()=>{assert.equal(await unzipDocument(zipDocument(xml)),xml);});
test('stored DOCX document XML is extracted',async()=>{assert.equal(await unzipDocument(zipDocument(xml,{compressed:false})),xml);});
test('encrypted or oversized DOCX is rejected before decompression',async()=>{await assert.rejects(()=>unzipDocument(zipDocument(xml,{encrypted:true})),/加密/);await assert.rejects(()=>unzipDocument(zipDocument(xml,{advertisedSize:25*1024*1024})),/过大/);});
test('invalid or truncated DOCX does not return partial text',async()=>{await assert.rejects(()=>unzipDocument(new Uint8Array([1,2,3]).buffer),/不完整/);const buf=zipDocument(xml);await assert.rejects(()=>unzipDocument(buf.slice(0,60)),/读取 DOCX/);});
