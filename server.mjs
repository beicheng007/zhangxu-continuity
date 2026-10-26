// Local-only server: npm start. No framework or third-party dependencies required.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {Readable} from 'node:stream';
import {handleSemanticRequest,publicAIConfig} from './server/ai-service.mjs';

const root=resolve(fileURLToPath(new URL('./dist/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
export function createLocalServer(env=process.env){return http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  try{
    if(url.pathname==='/api/ai-config'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(publicAIConfig(env)));return;}
    if(url.pathname==='/api/semantic'){
      const abort=new AbortController();res.on('close',()=>{if(!res.writableEnded)abort.abort();});
      const request=new Request(`http://${req.headers.host}${req.url}`,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Readable.toWeb(req),duplex:'half',signal:abort.signal});
      const response=await handleSemanticRequest(request,{env});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!path.startsWith(root+sep)||!types[extname(path)]){res.writeHead(404);res.end('Not found');return;}
    const data=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)],'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404);res.end('Not found');}
});}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||8080);
  createLocalServer().listen(port,'127.0.0.1',()=>console.log(`章序 http://127.0.0.1:${port} · AI 仅在手动确认后调用`));
}
