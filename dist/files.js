export const MAX_FILE_BYTES=8*1024*1024;
export async function readManuscript(file) {
  if(file.size>MAX_FILE_BYTES) throw new Error('单个文件最多 8 MB，请按卷拆分后再导入。');
  const ext=file.name.split('.').pop().toLowerCase();
  const buffer=await file.arrayBuffer();
  if(ext==='docx') return docxToText(buffer);
  if(!['txt','md','text'].includes(ext)) throw new Error('支持 TXT、Markdown、DOCX；旧版 DOC 请先另存为 DOCX。');
  try {return new TextDecoder('utf-8',{fatal:true}).decode(buffer);}
  catch {return new TextDecoder('gb18030',{fatal:true}).decode(buffer);}
}
export async function unzipDocument(buffer) {
  const bytes=new Uint8Array(buffer),view=new DataView(buffer);
  if(bytes.length<22) throw new Error('DOCX 文件不完整。');
  let eocd=-1;
  for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--) if(view.getUint32(p,true)===0x06054b50){eocd=p;break;}
  if(eocd<0) throw new Error('无法读取 DOCX，请确认文件没有加密。');
  const count=view.getUint16(eocd+10,true),central=view.getUint32(eocd+16,true);
  if(count>10000||central>=eocd) throw new Error('DOCX 目录超出支持范围。');
  let pos=central;
  for(let i=0;i<count;i++) {
    if(pos+46>bytes.length||view.getUint32(pos,true)!==0x02014b50) throw new Error('DOCX 目录已损坏。');
    const flags=view.getUint16(pos+8,true),method=view.getUint16(pos+10,true);
    const compressed=view.getUint32(pos+20,true),size=view.getUint32(pos+24,true);
    const nameLen=view.getUint16(pos+28,true),extraLen=view.getUint16(pos+30,true),commentLen=view.getUint16(pos+32,true),local=view.getUint32(pos+42,true);
    const name=new TextDecoder().decode(bytes.slice(pos+46,pos+46+nameLen));
    if(name==='word/document.xml') {
      if(flags&1) throw new Error('暂不支持加密 DOCX。');
      if(size>24*1024*1024||compressed>8*1024*1024) throw new Error('DOCX 正文过大，请拆分后导入。');
      if(local+30>bytes.length||view.getUint32(local,true)!==0x04034b50) throw new Error('DOCX 正文目录无效。');
      const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
      if(start+compressed>bytes.length) throw new Error('DOCX 正文不完整。');
      const content=bytes.slice(start,start+compressed);
      if(method===0) return new TextDecoder().decode(content);
      if(method!==8) throw new Error('暂不支持这种 DOCX 压缩格式。');
      let stream;
      try {stream=new Blob([content]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}
      catch {throw new Error('当前浏览器无法解压 DOCX，请使用新版 Chrome / Edge，或转为 TXT。');}
      const reader=stream.getReader(),chunks=[];let total=0;
      try {
        while(true) {
          const {done,value}=await reader.read();if(done)break;
          total+=value.byteLength;
          if(total>24*1024*1024){await reader.cancel();throw new Error('DOCX 解压内容过大，请拆分。');}
          chunks.push(value);
        }
      } finally {reader.releaseLock();}
      if(total!==size) throw new Error('DOCX 正文长度不正确，文件可能已损坏。');
      const result=new Uint8Array(total);let cursor=0;for(const c of chunks){result.set(c,cursor);cursor+=c.length;}
      return new TextDecoder('utf-8',{fatal:true}).decode(result);
    }
    pos+=46+nameLen+extraLen+commentLen;
  }
  throw new Error('DOCX 中没有可读取的正文。');
}
export async function docxToText(buffer) {
  const xml=await unzipDocument(buffer);
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror')) throw new Error('DOCX 正文 XML 无效。');
  const paragraphs=[...doc.getElementsByTagNameNS('*','p')];
  const lines=paragraphs.map(p=>{
    const nodes=[...p.getElementsByTagName('*')];let line='';
    for(const n of nodes) if(n.localName==='t')line+=n.textContent;else if(n.localName==='tab')line+='\t';else if(n.localName==='br')line+='\n';
    return line;
  });
  const text=lines.join('\n');
  if(!text.trim()) throw new Error('文件中未找到可编辑文字；图片扫描稿暂不支持。');
  return text;
}
