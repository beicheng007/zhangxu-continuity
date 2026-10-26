const DB_NAME='zhangxu-manuscripts-v1';
let db;
export function openDatabase() {
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{req.result.createObjectStore('projects',{keyPath:'id'});};
    req.onsuccess=()=>{db=req.result;db.onversionchange=()=>db.close();resolve(db);};
    req.onerror=()=>reject(new Error('浏览器存储无法打开，请检查隐私模式或空间设置。'));
  });
}
export function getProjects() {
  return new Promise((resolve,reject)=>{
    const req=db.transaction('projects','readonly').objectStore('projects').getAll();
    req.onsuccess=()=>resolve(req.result.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));req.onerror=()=>reject(req.error);
  });
}
export function saveProject(project,expectedRevision=0) {
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('projects','readwrite'),store=tx.objectStore('projects');
    let next;
    const req=store.get(project.id);
    req.onsuccess=()=>{
      const actual=req.result?.revision||0;
      if(actual!==expectedRevision){tx.abort();reject(new Error('这部作品已在另一个标签页更新。请先导出当前内容，再刷新页面载入最新版本。'));return;}
      next=actual+1;store.put({...project,revision:next});
    };
    tx.oncomplete=()=>resolve(next);
    tx.onerror=()=>reject(new Error('保存失败，可能是存储空间不足。请立即导出备份。'));
    tx.onabort=()=>reject(new Error('未能保存，请先导出备份以免丢失。'));
  });
}
export function deleteProject(id) {
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('projects','readwrite');tx.objectStore('projects').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
}
