// Code-drawn little book spirit; no remote assets, sound or model calls.
let illustrationId=0;
export function bookBuddySvg(){
  const id=`little-book-${++illustrationId}`;
  return `<svg class="buddy-svg" viewBox="0 0 240 220" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="${id}-cover" x1="65" y1="45" x2="184" y2="186" gradientUnits="userSpaceOnUse"><stop stop-color="#c4d9ac"/><stop offset="1" stop-color="#8eae7b"/></linearGradient>
      <radialGradient id="${id}-cream" cx="0" cy="0" r="1" gradientTransform="translate(116 92) rotate(75) scale(103 83)" gradientUnits="userSpaceOnUse"><stop stop-color="#fffef4"/><stop offset=".65" stop-color="#fff6da"/><stop offset="1" stop-color="#f3e4be"/></radialGradient>
      <radialGradient id="${id}-blush"><stop stop-color="#eda897" stop-opacity=".85"/><stop offset="1" stop-color="#f6c7b0" stop-opacity=".2"/></radialGradient>
    </defs>
    <ellipse cx="122" cy="123" rx="91" ry="79" fill="#ecefdc" opacity=".55"/>
    <ellipse class="buddy-shadow" cx="121" cy="204" rx="56" ry="8" fill="#cfd9bc" opacity=".65"/>
    <g class="buddy-character">
      <g class="buddy-feet" fill="#b4cda2" stroke="#7b936d" stroke-width="2.3"><path d="M82 180c-9 2-16 9-12 15 4 8 29 7 31-1l-1-13"/><path d="M145 181c-3 9 0 17 10 18 10 1 19-1 19-7 0-6-8-11-15-12"/></g>
      <path d="M48 89c0-24 13-40 37-42l64-2c28-1 46 14 47 43l1 60c1 28-17 45-45 46l-60 1c-28 0-43-15-44-42Z" fill="url(#${id}-cover)" stroke="#7f986c" stroke-width="2.5"/>
      <path d="M61 75c9-20 29-24 49-24h44c17 0 28 10 30 25" stroke="#e5efd5" stroke-width="5" stroke-linecap="round"/>
      <path d="M66 87c0-22 14-32 35-33h43c26 0 40 13 41 35l1 52c1 27-15 42-42 43h-41c-25 0-40-15-40-39Z" fill="url(#${id}-cream)" stroke="#a4ad82" stroke-width="1.8"/>
      <path d="M75 74c4-8 14-12 28-12h37" stroke="#fffef5" stroke-width="4" stroke-linecap="round"/>
      <path d="M54 84v64c0 17 7 28 19 33" stroke="#d6e3bf" stroke-width="4" stroke-linecap="round"/>
      <g class="buddy-sprout"><path d="M123 52c-3-12-1-20 4-25" stroke="#809e65" stroke-width="2.5" stroke-linecap="round"/><path d="M125 39c-18 3-23-8-22-16 15-2 24 5 22 16Z" fill="#b1cd93" stroke="#89a774" stroke-width="1.5"/><path d="M125 38c-1-14 11-23 23-20 1 13-8 23-23 20Z" fill="#d1e1b4" stroke="#8ea977" stroke-width="1.5"/><path d="m128 34 12-9" stroke="#a0bd82" stroke-width="1.7" stroke-linecap="round"/></g>
      <g class="buddy-ribbon"><path d="M157 53h18v36l-9-6-9 6Z" fill="#edb4a3" stroke="#c89481" stroke-width="1.6"/><path d="M162 58h8v17" stroke="#f9d7c6" stroke-width="2" stroke-linecap="round"/></g>
      <ellipse class="buddy-cheek" cx="83" cy="129" rx="16" ry="10" fill="url(#${id}-blush)"/>
      <ellipse class="buddy-cheek" cx="167" cy="129" rx="16" ry="10" fill="url(#${id}-blush)"/>
      <path d="m77 129 1 3m6-2 1 3m78-3 1 3m6-4 1 3" stroke="#dba28c" stroke-width="1.5" stroke-linecap="round" opacity=".55"/>
      <g class="buddy-eyes">
        <ellipse cx="100" cy="111" rx="8.5" ry="11" fill="#4b5b42"/><ellipse cx="151" cy="111" rx="8.5" ry="11" fill="#4b5b42"/>
        <ellipse cx="101" cy="116" rx="5.4" ry="4" fill="#74835e"/><ellipse cx="152" cy="116" rx="5.4" ry="4" fill="#74835e"/>
        <circle cx="97" cy="107" r="3.2" fill="#fffef4"/><circle cx="148" cy="107" r="3.2" fill="#fffef4"/><circle cx="103" cy="113" r="1.5" fill="#fffef4"/><circle cx="154" cy="113" r="1.5" fill="#fffef4"/>
      </g>
      <g class="buddy-happy-eyes" stroke="#657451" stroke-width="3" stroke-linecap="round"><path d="M92 112q8-11 16 0M143 112q8-11 16 0"/></g>
      <path class="buddy-mouth" d="M118 129c1 8 13 8 15 0" stroke="#8c7960" stroke-width="2.6" stroke-linecap="round"/>
      <path class="buddy-delighted-mouth" d="M115 128q11-5 22 0c-1 17-21 17-22 0Z" fill="#8e735e"/><path class="buddy-delighted-mouth" d="M120 138q6-6 13 0c-4 5-9 5-13 0Z" fill="#efb7a6"/>
      <g class="buddy-pocket"><path d="M107 153c9-2 15 0 20 4 5-4 12-6 21-4v18c-9-2-15 0-21 3-6-4-12-5-20-3Z" fill="#dce6c8" stroke="#9bae84" stroke-width="1.7" stroke-linejoin="round"/><path d="M127 157v17m-15-15 8 2m-8 3 8 2m14-5 8-2m-8 7 8-2" stroke="#a1b18b" stroke-width="1.5" stroke-linecap="round"/></g>
      <g class="buddy-arm left"><path d="M61 128c-7-6-20-2-20 7-1 9 10 17 18 13 6-2 8-14 2-20Z" fill="#fff4d8" stroke="#9eab80" stroke-width="2"/><path d="m46 137 3 2m2-7 2 2" stroke="#e2cba2" stroke-width="1.6" stroke-linecap="round"/></g>
      <g class="buddy-arm right"><path d="M185 127c3-8 13-14 19-9 7 7 4 18-4 23-7 4-17-6-15-14Z" fill="#fff4d8" stroke="#9eab80" stroke-width="2"/><path d="m198 122 2 3m-7 0 2 3" stroke="#e2cba2" stroke-width="1.6" stroke-linecap="round"/></g>
    </g>
    <g class="buddy-affection" fill="#e4a497"><path d="M54 56c-10-14-25 2 0 17 25-15 10-31 0-17Z"/><path d="M198 69c-7-10-18 1 0 12 18-11 7-22 0-12Z"/><path d="M178 26c-6-8-15 1 0 10 15-9 6-18 0-10Z"/></g>
    <g class="buddy-treat"><path d="m124 142 6 10 12 3-9 9 1 12-11-6-11 5 2-12-8-9 12-2Z" fill="#f1d18f" stroke="#ceaa68" stroke-width="1.8" stroke-linejoin="round"/><circle cx="120" cy="158" r="1.5" fill="#a98e5c"/><circle cx="129" cy="159" r="1.5" fill="#a98e5c"/></g>
    <path class="buddy-spark s1" d="m39 82 2-7 2 7 7 2-7 2-2 7-2-7-7-2Z" fill="#dcc28b"/>
    <path class="buddy-spark s2" d="m204 46 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z" fill="#ceb9db"/>
    <circle class="buddy-spark s3" cx="63" cy="35" r="3" fill="#d8c7de"/>
  </svg>`;
}
const tips={
  library:['先把前文放进小书包，我来帮你找设定。','可以先点「载入测试样稿」，陪我练习一遍。','别忘了备份，小书包也需要留一份副本。'],
  facts:['这条设定是真的吗？最后一票由你来投。','点一下章节名字，就能回到原文啦。','回忆和传闻，记得多看一眼上下文。'],
  check:['我来翻旧账，你来续写新故事。','举剑的手，未必就是惯用手哦。','有差异就一起看出处，故事由你做主。'],
  history:['你的核对笔记，我都收好啦。','相同原文再次检查，会记得你的判断。','导出一份备份，安心去写下一章吧。'],
};
const reactions={
  pet:['嘿嘿，脑袋摸到了，今天也要一起加油呀。','再摸一下嘛。小章已经乖乖坐好啦。','收到你的摸摸，开心得冒出小叶子！'],
  snack:['啊呜，一颗灵感小饼干！陪你慢慢把故事写完。','咔嚓，灵感补给收到。今天的故事会是什么味道？','小饼干收好啦，下一颗留给写累的你。'],
  highfive:['啪！和你击掌，下一章也一起努力。','小短手举高高！今天写一点，也很棒。','击掌成功！故事里的大冒险，咱们慢慢来。'],
};
let taps=0,reactionTimer;
export function buddyMessage(page){return tips[page]?.[0]||tips.library[0];}
export function petBuddy(page,gesture='pet'){
  const button=document.querySelector('.book-buddy'),message=document.querySelector('.buddy-message');
  if(!button||!message)return;
  const action=Object.hasOwn(reactions,gesture)?gesture:'pet';
  message.textContent=reactions[action][taps++%reactions[action].length];
  clearTimeout(reactionTimer);
  button.classList.remove('is-pet','is-snack','is-highfive');void button.offsetWidth;button.classList.add(`is-${action}`);
  message.classList.remove('bubble-pop');void message.offsetWidth;message.classList.add('bubble-pop');
  reactionTimer=setTimeout(()=>{button.classList.remove(`is-${action}`);message.classList.remove('bubble-pop');},2600);
}
export function celebrate(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const layer=document.createElement('div');layer.className='celebration';layer.setAttribute('aria-hidden','true');
  for(let i=0;i<18;i++){
    const piece=document.createElement('i');piece.style.setProperty('--x',`${(i-8.5)*25}px`);piece.style.setProperty('--spin',`${(i%2?1:-1)*(90+i*17)}deg`);piece.style.setProperty('--delay',`${i%4*35}ms`);piece.style.background=['#acc99c','#e8b5a7','#d5c1e6','#e7d18c'][i%4];if(i%3===0)piece.className='star';layer.append(piece);
  }
  document.body.append(layer);setTimeout(()=>layer.remove(),1600);
}
