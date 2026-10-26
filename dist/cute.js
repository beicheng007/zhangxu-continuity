// Small code-drawn companion; no remote images, sound, telemetry or model calls.
export function bookBuddySvg(){return `<svg class="buddy-svg" viewBox="0 0 160 148" fill="none" aria-hidden="true"><ellipse class="buddy-shadow" cx="80" cy="133" rx="37" ry="7" fill="#dddfcd"/><g class="buddy-character"><path class="buddy-arm left" d="M43 84c-15-4-19 5-14 12 4 4 11 1 15-3" fill="#b2c9a0" stroke="#789070" stroke-width="2"/><path class="buddy-arm right" d="M117 82c15-6 20 1 17 8-3 5-10 3-16 1" fill="#b2c9a0" stroke="#789070" stroke-width="2"/><path d="M59 119v10c0 7 15 7 15 1v-9m14 0v8c0 7 15 7 15 0v-11" fill="#91b18a" stroke="#789070" stroke-width="2"/><path d="M43 37c0-7 5-12 12-12h52c7 0 12 5 12 12v77c0 7-5 12-12 12H53c-7 0-12-5-12-12Z" fill="#9db88a" stroke="#789070" stroke-width="2"/><path d="M51 28h49c8 0 13 4 13 11v70c0 6-4 10-11 10H53c-6 0-10-4-10-9V37c0-5 3-9 8-9Z" fill="#fff9df" stroke="#789070" stroke-width="2"/><path d="M51 35h49M51 41h48" stroke="#e9dfb7" stroke-width="2" stroke-linecap="round"/><path d="M43 36c0-5 3-8 7-8h4v91h-5c-4 0-7-4-7-9Z" fill="#bfd0a5" stroke="#789070" stroke-width="2"/><path d="M95 26V51l8-6 8 6V28c-6-2-11-2-16-2Z" fill="#eab4a6" stroke="#be8579" stroke-width="1.7"/><g class="buddy-eyes"><ellipse cx="69" cy="76" rx="3.2" ry="4.7" fill="#4d6046"/><ellipse cx="95" cy="76" rx="3.2" ry="4.7" fill="#4d6046"/><circle cx="70" cy="74" r="1" fill="white"/><circle cx="96" cy="74" r="1" fill="white"/></g><path d="M77 86c2 4 7 4 10 0" stroke="#7a8061" stroke-width="2" stroke-linecap="round"/><ellipse cx="63" cy="86" rx="7" ry="4" fill="#f4c8b2" opacity=".8"/><ellipse cx="103" cy="86" rx="7" ry="4" fill="#f4c8b2" opacity=".8"/><path d="m72 101 4 2 3-4 2 5 5-1" stroke="#d9cfa6" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></g><path class="buddy-spark s1" d="m24 32 2-7 2 7 7 2-7 2-2 7-2-7-7-2Z" fill="#dec587"/><path class="buddy-spark s2" d="m134 48 1.5-5 1.5 5 5 1.5-5 1.5-1.5 5-1.5-5-5-1.5Z" fill="#d7b6ce"/><circle class="buddy-spark s3" cx="122" cy="22" r="3" fill="#d9ccef"/></svg>`;}
const tips={
  library:['先把前文放进小书包，我来帮你找设定。','可以先点「载入测试样稿」，陪我练习一遍。','别忘了备份，小书包也需要留一份副本。'],
  facts:['这条设定是真的吗？最后一票由你来投。','点一下章节名字，就能回到原文啦。','回忆和传闻，记得多看一眼上下文。'],
  check:['我来翻旧账，你来续写新故事。','举剑的手，未必就是惯用手哦。','有差异就一起看出处，故事由你做主。'],
  history:['你的核对笔记，我都收好啦。','相同原文再次检查，会记得你的判断。','导出一份备份，安心去写下一章吧。'],
};
let taps=0;
export function buddyMessage(page){return tips[page]?.[0]||tips.library[0];}
export function petBuddy(page){
  const button=document.querySelector('.book-buddy'),message=document.querySelector('.buddy-message');
  if(!button||!message)return;
  taps++;message.textContent=tips[page][taps%tips[page].length];
  button.classList.remove('boop');void button.offsetWidth;button.classList.add('boop');
  message.classList.remove('bubble-pop');void message.offsetWidth;message.classList.add('bubble-pop');
  setTimeout(()=>button.classList.remove('boop'),900);
}
export function celebrate(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const layer=document.createElement('div');layer.className='celebration';layer.setAttribute('aria-hidden','true');
  for(let i=0;i<18;i++){
    const piece=document.createElement('i');piece.style.setProperty('--x',`${(i-8.5)*25}px`);piece.style.setProperty('--spin',`${(i%2?1:-1)*(90+i*17)}deg`);piece.style.setProperty('--delay',`${i%4*35}ms`);piece.style.background=['#acc99c','#e8b5a7','#d5c1e6','#e7d18c'][i%4];if(i%3===0)piece.className='star';layer.append(piece);
  }
  document.body.append(layer);setTimeout(()=>layer.remove(),1600);
}
