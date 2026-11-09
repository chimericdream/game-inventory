// Round 3 shared helpers. Requires data.js.
const Q=new URLSearchParams(location.search);
Object.assign(I,{
 check:'<svg viewBox="0 0 24 24"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg>',
 warn:'<svg viewBox="0 0 24 24"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg>',
 link:'<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 005.700 0l3-3a4 4 0 00-5.700-5.700l-1 1M14 10a4 4 0 00-5.700 0l-3 3A4 4 0 0011 18.700l1-1"/></svg>',
 gift:'<svg viewBox="0 0 24 24"><rect x="4" y="9" width="16" height="11" rx="1"/><path d="M3 9h18v3H3zM12 9v11M12 9c-2.500 0-4-1-4-2.500S10 4 12 9zM12 9c2.500 0 4-1 4-2.500S14 4 12 9z"/></svg>',
 file:'<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6"/></svg>',
 copy:'<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/></svg>',
 lock:'<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
 eyeoff:'<svg viewBox="0 0 24 24"><path d="M3 12s3.500-6 9-6 9 6 9 6-3.500 6-9 6-9-6-9-6z"/><path d="M4 4l16 16"/></svg>',
 eye:'<svg viewBox="0 0 24 24"><path d="M3 12s3.500-6 9-6 9 6 9 6-3.500 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="3"/></svg>',
 user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c1-4 4-6 8-6s7 2 8 6"/></svg>',
 image:'<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M4 18l5-5 4 4 3-3 4 4"/></svg>',
 globe:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
 star2:'<svg viewBox="0 0 24 24"><path d="M12 3.500l2.700 5.500 6 .9-4.400 4.200 1 6-5.300-2.900-5.300 2.900 1-6L3.300 9.900l6-.9z"/></svg>',
 refresh:'<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0114-5.300L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.300L4 15M4 20v-5h5"/></svg>',
 down:'<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg>',
 right:'<svg viewBox="0 0 24 24"><path d="M10 6l6 6-6 6"/></svg>',
 tree:'<svg viewBox="0 0 24 24"><path d="M5 4v14h4M5 11h8M5 18h14"/></svg>'
});
Object.assign(PEOPLE,{'Leo':100,'Mia':320,'Sam':160,'Dad':60});
function boot(active,html,opts){
  opts=opts||{};
  document.getElementById('app').innerHTML=(opts.header===false?'':(opts.headerHTML||header(active)))+`<div class="pg ${opts.cls||''}">${html}</div>`+(opts.tab===false?'':(opts.tabHTML||tabbar(active)))+(opts.after||'');
  if(Q.get('theme'))document.documentElement.dataset.theme=Q.get('theme');
}
const gm=id=>GAMES.find(g=>g.id===id)||({betrayal:BETRAYAL})[id];
const field=(label,input,o={})=>`<label class="f ${o.err?'err':''}"><span class="l">${label}${o.opt?'<em>optional</em>':''}</span>${input}${o.msg?`<span class="msg">${o.msg}</span>`:''}</label>`;
const sw=(on,label)=>`<button class="sw" role="switch" aria-checked="${on}" aria-label="${label}"></button>`;
const stackAv=(names,win)=>`<span class="stk">${names.map(n=>`<span class="av pp sm ${n===win?'win':''}" style="--h:${PEOPLE[n]||0}" title="${n}">${n[0]}</span>`).join('')}</span>`;
// shelf illustration for empty states
const shelfArt=(n=4)=>`<svg class="art" viewBox="0 0 150 90" aria-hidden="true"><rect x="6" y="76" width="138" height="7" rx="1" fill="var(--plank)"/>${Array.from({length:n}).map((_,i)=>`<rect x="${14+i*32}" y="${34+(i%2)*10}" width="26" height="${42-(i%2)*10}" rx="2" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="5 4" opacity=".7"/>`).join('')}</svg>`;
const extraCss=document.createElement('style');extraCss.textContent=`.stk{display:inline-flex}.stk .av{border:2px solid var(--surface);margin-left:-5px}.stk .av:first-child{margin-left:0}.stk .av.win{outline:2px solid var(--oak);position:relative;z-index:1}`;document.head.appendChild(extraCss);
