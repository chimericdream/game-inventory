// Demo data + procedural cover art (abstract, colour-coded by type, motif per game)
const GAMES = [
 {id:'catan',t:'Catan',ty:'Board',p:[3,4],m:90,c:2,a:10,tags:['strategy','trading','family'],bg:'#c7612b',fg:'#f6e3c2',mo:'hex',loan:{who:'Aunt Dana',due:'Nov 20'},partial:true},
 {id:'pandemic',t:'Pandemic',ty:'Board',p:[2,4],m:45,c:2,a:8,tags:['co-op','family'],bg:'#1d2d44',fg:'#e8504a',mo:'cross'},
 {id:'wingspan',t:'Wingspan',ty:'Board',p:[1,5],m:70,c:3,a:10,tags:['strategy','engine-building'],bg:'#2f6f73',fg:'#f3d9a4',mo:'wing'},
 {id:'ttr',t:'Ticket to Ride',ty:'Board',p:[2,5],m:60,c:2,a:8,tags:['family','trains'],bg:'#a63d40',fg:'#f4ead2',mo:'rail'},
 {id:'carc',t:'Carcassonne',ty:'Board',p:[2,5],m:45,c:2,a:7,tags:['tile-laying'],bg:'#5b7f3a',fg:'#e9d8a6',mo:'tiles'},
 {id:'azul',t:'Azul',ty:'Board',p:[2,4],m:40,c:2,a:8,tags:['abstract','tile-laying'],bg:'#1f5fa8',fg:'#f2f0e6',mo:'azul'},
 {id:'codenames',t:'Codenames',ty:'Card',p:[2,8],m:15,c:1,a:10,tags:['party','word'],bg:'#2b2b33',fg:'#f2c14e',mo:'grid',loan:{who:'Priya',due:'Nov 16'}},
 {id:'kittens',t:'Exploding Kittens',ty:'Card',p:[2,5],m:15,c:1,a:7,tags:['party'],bg:'#e4572e',fg:'#1c1c1c',mo:'burst'},
 {id:'dominion',t:'Dominion',ty:'Card',p:[2,4],m:30,c:3,a:13,tags:['deck-building'],bg:'#6a4c93',fg:'#f1dca7',mo:'crown'},
 {id:'phb',t:"Player's Handbook",sub:'Dungeons & Dragons',ty:'RPG book',a:12,tags:['rulebook','fantasy'],bg:'#7a1f2b',fg:'#e9c46a',mo:'d20',sys:'D&D 5e'},
 {id:'coc',t:'Keeper Rulebook',sub:'Call of Cthulhu',ty:'RPG book',a:14,tags:['rulebook','horror'],bg:'#143d3a',fg:'#8fc9a9',mo:'eye',sys:'CoC 7e'},
 {id:'mk8',t:'Mario Kart 8 Deluxe',ty:'Video game',p:[1,4],a:3,tags:['racing','party'],bg:'#d7263d',fg:'#ffffff',mo:'kart',plat:'Switch'},
 {id:'totk',t:'Tears of the Kingdom',sub:'The Legend of Zelda',ty:'Video game',p:[1,1],a:12,tags:['adventure'],bg:'#3b6b5e',fg:'#e8e2b0',mo:'tri',plat:'Switch'},
 {id:'smash',t:'Super Smash Bros. Ultimate',ty:'Video game',p:[1,8],a:10,tags:['fighting','party'],bg:'#ef7d1a',fg:'#1a1a1a',mo:'burst',plat:'Switch'},
 {id:'alpine',t:'Alpine Lake',sub:'Ravensburger',ty:'Puzzle',a:12,tags:['landscape','1000 pc'],bg:'#5aa0c8',fg:'#f4f1e6',mo:'lake',loan:{who:'Uncle Ray',due:'Nov 14'}},
 {id:'splendor',t:'Splendor',ty:'Board',p:[2,4],m:30,c:2,a:10,tags:['engine-building','gems'],bg:'#2a2d6e',fg:'#e7c46a',mo:'gem'},
 {id:'7w',t:'7 Wonders',ty:'Board',p:[3,7],m:30,c:3,a:10,tags:['drafting','strategy'],bg:'#c19a3a',fg:'#2b2418',mo:'pyr'},
 {id:'sushi',t:'Sushi Go!',ty:'Card',p:[2,5],m:15,c:1,a:8,tags:['drafting','family'],bg:'#f08a8a',fg:'#4a1d28',mo:'dots'},
 {id:'kingdomino',t:'Kingdomino',ty:'Board',p:[2,4],m:15,c:1,a:8,tags:['family','tile-laying'],bg:'#8aa63a',fg:'#2f3a14',mo:'tiles'},
 {id:'cascadia',t:'Cascadia',ty:'Board',p:[1,4],m:45,c:2,a:10,tags:['tile-laying','nature'],bg:'#3e8a64',fg:'#e8f0d4',mo:'lake'},
 {id:'root',t:'Root',ty:'Board',p:[2,4],m:90,c:4,a:10,tags:['strategy','asymmetric'],bg:'#b5472b',fg:'#f0dcb0',mo:'wing'},
 {id:'gloomhaven',t:'Gloomhaven',ty:'Board',p:[1,4],m:120,c:4,a:14,tags:['campaign','co-op'],nocover:true},
 {id:'scythe',t:'Scythe',ty:'Board',p:[1,5],m:115,c:3,a:14,tags:['strategy','engine-building'],bg:'#9a8f6a',fg:'#2a2a24',mo:'gear'},
 {id:'tm',t:'Terraforming Mars',ty:'Board',p:[1,5],m:120,c:3,a:12,tags:['strategy','sci-fi'],bg:'#b24a2b',fg:'#f2d0b0',mo:'planet'}
];
const hexPts=(x,y,r)=>[0,1,2,3,4,5].map(i=>[x+r*Math.cos(Math.PI/3*i+Math.PI/6),y+r*Math.sin(Math.PI/3*i+Math.PI/6)].map(n=>n.toFixed(1)).join(',')).join(' ');
const M = {
 hex:f=>{let s='';for(let r=0;r<4;r++)for(let c=0;c<4;c++){const on=(r+c)%3==0;s+=`<polygon points="${hexPts(18+c*22+(r%2?11:0),26+r*19,11)}" fill="${on?f:'none'}" stroke="${f}" stroke-width="1.6" opacity="${on?.9:.55}"/>`}return s},
 cross:f=>`<circle cx="50" cy="52" r="30" fill="none" stroke="${f}" stroke-width="2"/><path d="M42 30h16v16h16v16H58v16H42V62H26V46h16z" fill="${f}"/>`,
 wing:f=>[0,1,2,3,4].map(i=>`<path d="M${14+i*4} ${74-i*9}Q50 ${20-i*2} ${90-i*4} ${72-i*9}" fill="none" stroke="${f}" stroke-width="${3.4-i*.4}" stroke-linecap="round" opacity="${1-i*.15}"/>`).join(''),
 rail:f=>`<path d="M-5 95Q30 80 40 56T105 20" fill="none" stroke="${f}" stroke-width="3"/><path d="M-5 105Q30 90 40 66T105 30" fill="none" stroke="${f}" stroke-width="3"/>`+[[18,80],[40,56],[66,38],[88,26]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="5" fill="${f}"/>`).join(''),
 tiles:f=>[.95,.5,.75,.35,.85,.6,.4,.9,.55].map((o,i)=>`<rect x="${16+(i%3)*24}" y="${22+Math.floor(i/3)*24}" width="22" height="22" fill="${f}" opacity="${o}"/>`).join(''),
 azul:f=>{let s='';for(let r=0;r<4;r++)for(let c=0;c<4;c++){s+=`<g transform="translate(${17+c*17} ${24+r*17})"><rect width="15" height="15" fill="${f}" opacity="${(r+c)%2?.95:.35}"/><path d="M7.5 2L13 7.5 7.5 13 2 7.5z" fill="none" stroke="#1f5fa8" stroke-width="1.2"/></g>`}return s},
 grid:f=>{let s='';for(let r=0;r<4;r++)for(let c=0;c<4;c++)s+=`<rect x="${18+c*18}" y="${24+r*14}" width="16" height="11" rx="1" fill="${(r*4+c)%5==1?f:'none'}" stroke="${f}" stroke-width="1.4"/>`;return s},
 burst:f=>{let p=[];for(let i=0;i<16;i++){const a=Math.PI/8*i,r=i%2?18:38;p.push((50+r*Math.cos(a)).toFixed(1)+','+(54+r*Math.sin(a)).toFixed(1))}return `<polygon points="${p.join(' ')}" fill="${f}"/>`},
 crown:f=>`<path d="M20 78L24 38l16 18 10-22 10 22 16-18 4 40z" fill="${f}"/><rect x="20" y="82" width="60" height="7" fill="${f}"/>`,
 d20:f=>`<polygon points="50,18 80,36 80,68 50,86 20,68 20,36" fill="none" stroke="${f}" stroke-width="2.6"/><polygon points="50,28 70,62 30,62" fill="${f}" opacity=".9"/><path d="M50 18v10M80 36L70 62M20 36l10 26M50 86V62" stroke="${f}" stroke-width="1.6"/>`,
 eye:f=>`<path d="M12 54Q50 14 88 54Q50 94 12 54z" fill="none" stroke="${f}" stroke-width="2.6"/><circle cx="50" cy="54" r="15" fill="${f}"/><circle cx="50" cy="54" r="6" fill="#143d3a"/>`+[0,1,2,3,4,5].map(i=>`<path d="M${18+i*13} 100q4-14 0-24" stroke="${f}" stroke-width="2" fill="none" opacity=".6"/>`).join(''),
 kart:f=>`<g fill="${f}">${[0,1,2,3,4,5,6].map(i=>`<rect x="${10+i*13}" y="${74-i*7}" width="8" height="8" opacity="${i%2?1:.35}"/>`).join('')}</g><circle cx="66" cy="62" r="14" fill="${f}"/><circle cx="66" cy="62" r="5" fill="#d7263d"/>`,
 tri:f=>`<polygon points="50,22 66,50 34,50" fill="${f}"/><polygon points="34,54 50,82 18,82" fill="${f}" opacity=".8"/><polygon points="66,54 82,82 50,82" fill="${f}" opacity=".8"/>`,
 lake:f=>`<polygon points="-5,70 25,34 45,58 62,28 105,72" fill="${f}" opacity=".9"/><rect x="-5" y="70" width="110" height="40" fill="${f}" opacity=".35"/><circle cx="78" cy="20" r="8" fill="${f}"/>`,
 gem:f=>`<polygon points="50,24 78,44 50,84 22,44" fill="${f}" opacity=".95"/><path d="M22 44h56M50 24L38 44l12 40 12-40z" stroke="#2a2d6e" stroke-width="1.6" fill="none"/>`,
 pyr:f=>[0,1,2,3].map(i=>`<rect x="${20+i*8}" y="${75-i*13}" width="${60-i*16}" height="11" fill="${f}" opacity="${1-i*.12}"/>`).join(''),
 dots:f=>{let s='';for(let i=0;i<9;i++)s+=`<circle cx="${24+(i%3)*26}" cy="${30+Math.floor(i/3)*24}" r="${i%2?9:11}" fill="${f}" opacity="${i%2?.55:.95}"/>`;return s},
 gear:f=>{let s='';for(let i=0;i<10;i++)s+=`<rect x="46" y="14" width="8" height="14" fill="${f}" transform="rotate(${i*36} 50 54)"/>`;return s+`<circle cx="50" cy="54" r="26" fill="none" stroke="${f}" stroke-width="7"/><circle cx="50" cy="54" r="7" fill="${f}"/>`},
 planet:f=>`<circle cx="50" cy="52" r="28" fill="${f}"/><path d="M26 60q24 14 50-6" stroke="#b24a2b" stroke-width="3" fill="none"/><ellipse cx="50" cy="52" rx="44" ry="10" fill="none" stroke="${f}" stroke-width="2" transform="rotate(-18 50 52)"/>`
};
function cover(g){
  if(g.nocover) return `<div class="cover nocover"><span class="ph-l">${g.t[0]}</span><span class="ph-t">${g.t}</span><span class="ph-n">No cover yet</span></div>`;
  return `<div class="cover" style="--cbg:${g.bg};--cfg:${g.fg}"><svg viewBox="0 0 100 125" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="100" height="125" fill="${g.bg}"/>${M[g.mo](g.fg)}</svg><span class="ct">${g.sub?`<small>${g.sub}</small>`:''}${g.t}</span></div>`;
}
const pl=g=>g.p?(g.p[0]==g.p[1]?`${g.p[0]} player`:`${g.p[0]}–${g.p[1]} players`):'';
function meta(g){
  if(g.ty==='RPG book') return g.sys;
  if(g.ty==='Puzzle') return '1,000 pieces';
  if(g.ty==='Video game') return `${g.plat} · ${g.p[0]==g.p[1]?'1p':g.p[0]+'–'+g.p[1]+'p'}`;
  return `${g.p[0]==g.p[1]?g.p[0]:g.p[0]+'–'+g.p[1]}p · ${g.m} min`;
}
const I = {
 search:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
 plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
 filter:'<svg viewBox="0 0 24 24"><path d="M4 7h16M7 12h10M10 17h4"/></svg>',
 book:'<svg viewBox="0 0 24 24"><path d="M5 4h10a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h10"/></svg>',
 loan:'<svg viewBox="0 0 24 24"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>',
 dice:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/></svg>',
 heart:'<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.400-7-10a4 4 0 017-2.600A4 4 0 0119 10c0 5.600-7 10-7 10z"/></svg>',
 more:'<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.200" fill="currentColor"/><circle cx="12" cy="12" r="1.200" fill="currentColor"/><circle cx="18" cy="12" r="1.200" fill="currentColor"/></svg>',
 back:'<svg viewBox="0 0 24 24"><path d="M14 6l-6 6 6 6"/></svg>',
 pin:'<svg viewBox="0 0 24 24"><path d="M12 21s6-5.500 6-11a6 6 0 10-12 0c0 5.500 6 11 6 11z"/><circle cx="12" cy="10" r="2"/></svg>',
 edit:'<svg viewBox="0 0 24 24"><path d="M5 19l1-4L16 5l3 3L9 18z"/></svg>',
 trash:'<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',
 upload:'<svg viewBox="0 0 24 24"><path d="M12 16V5M7 9l5-5 5 5M5 19h14"/></svg>',
 cog:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.600 5.600l2.100 2.100M16.300 16.300l2.100 2.100M5.600 18.400l2.100-2.100M16.300 7.700l2.100-2.100"/></svg>',
 close:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 star:'<svg viewBox="0 0 24 24"><path d="M12 3.500l2.700 5.500 6 .9-4.400 4.200 1 6-5.300-2.900-5.300 2.900 1-6L3.300 9.900l6-.9z"/></svg>'
};
function header(active){
  const links=[['Library',0],['Loans',4],['Plays',0],['Wishlist',7],['Import',0],['Settings',0]];
  return `<header class="top"><a class="brand" href="catalog.html"><svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="5" width="6" height="22" rx="1" fill="var(--accent)"/><rect x="11" y="9" width="6" height="18" rx="1" fill="var(--oak)"/><rect x="19" y="4" width="6" height="23" rx="1" fill="var(--loan)" transform="rotate(8 22 27)"/><rect x="2" y="27" width="28" height="3" fill="var(--ink)"/></svg><span>The Shelf</span></a>
  <nav class="mainnav" aria-label="Main">${links.map(([n,c])=>`<a href="${n==='Library'?'catalog.html':'#'}" ${n===active?'aria-current="page"':''}>${n}${c?`<b>${c}</b>`:''}</a>`).join('')}</nav>
  <div class="who"><a class="btn primary" href="#"><i class="ic">${I.plus}</i>Add game</a><span class="me"><span class="av">S</span><span class="mename">Sam</span></span></div></header>`;
}
function tabbar(active){
  const t=[['Library','book',0],['Loans','loan',4],['Plays','dice',0],['Wishlist','heart',0],['More','more',0]];
  return `<nav class="tabbar" aria-label="Main">${t.map(([n,ic,c])=>`<a href="#" ${n===active?'aria-current="page"':''}><i class="ic">${I[ic]}</i>${n}${c?`<b>${c}</b>`:''}</a>`).join('')}</nav>`;
}

/* ---- round 2 additions ---- */
M.house=f=>`<polygon points="14,60 50,28 86,60" fill="${f}"/><rect x="24" y="60" width="52" height="32" fill="${f}" opacity=".85"/><rect x="44" y="72" width="12" height="20" fill="#3b2f4a"/><rect x="30" y="66" width="9" height="9" fill="#3b2f4a"/><rect x="61" y="66" width="9" height="9" fill="#3b2f4a"/><circle cx="82" cy="24" r="7" fill="${f}" opacity=".6"/>`;
const BETRAYAL={id:'betrayal',t:'Betrayal at House on the Hill',ty:'Board',p:[3,6],m:60,c:2,a:12,tags:['co-op','horror'],bg:'#3b2f4a',fg:'#c9a0dc',mo:'house'};
const TODAY=new Date(2026,10,9);
const PEOPLE={'Grandma Jo':140,'Uncle Ray':30,'Priya':280,'Aunt Dana':200,'Jonas':340,'Sam':160,'Mia':320,'Dad':60};
function person(n,sz){return `<span class="av pp" style="--h:${PEOPLE[n]||0};${sz?`width:${sz}px;height:${sz}px;font-size:${sz*.42}px`:''}">${n[0]}</span>`}
const LOANS=[
 {g:BETRAYAL,who:'Grandma Jo',since:'Oct 22',due:5,copy:'Dad’s copy'},
 {g:GAMES.find(g=>g.id==='alpine'),who:'Uncle Ray',since:'Oct 31',due:14,copy:'Shared copy'},
 {g:GAMES.find(g=>g.id==='codenames'),who:'Priya',since:'Nov 2',due:16,copy:'Mia’s copy'},
 {g:GAMES.find(g=>g.id==='catan'),who:'Aunt Dana',since:'Oct 30',due:20,copy:'Mia’s copy'}
];
const RETURNED=[
 {g:GAMES.find(g=>g.id==='splendor'),who:'Jonas',back:'Nov 3',kept:'14 days'},
 {g:GAMES.find(g=>g.id==='dominion'),who:'Priya',back:'Oct 27',kept:'9 days'},
 {g:GAMES.find(g=>g.id==='azul'),who:'Uncle Ray',back:'Oct 12',kept:'21 days'}
];
