import {parseChapters,extractClaims,checkDraft} from './engine.js';
self.onmessage=({data})=>{
  const started=performance.now();
  try {
    let result;
    if(data.type==='import') {
      const chapters=parseChapters(data.text,data.name,data.offset);
      result={chapters,facts:extractClaims(chapters)};
    } else if(data.type==='check') result=checkDraft(data.input);
    else throw new Error('未知检查任务。');
    self.postMessage({id:data.id,result,elapsedMs:Math.round(performance.now()-started)});
  } catch(error) {self.postMessage({id:data.id,error:error.message});}
};
