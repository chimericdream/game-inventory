// Restricted-profile helpers. Requires data.js and ui.js.
const KID_HIDDEN=['phb','coc','gloomhaven','scythe'];      // hidden entirely
const KID_NOIMG=['pandemic','root'];                         // details visible, image hidden
const TYPE_WORD={Board:'Board game',Card:'Card game','RPG book':'RPG book','Video game':'Video game',Puzzle:'Puzzle'};
// A calm, deliberate "no picture" tile: soft tint from the title, big letterform, the game's kind. No dashes, no "missing" wording.
function plainTile(g){
  const h=[...g.t].reduce((a,c)=>a+c.charCodeAt(0),0)%360;
  return `<div class="cover plain" style="--ph:${h}"><span class="pl">${g.t[0]}</span><span class="pt"><small>${TYPE_WORD[g.ty]||g.ty}</small>${g.t}</span></div>`;
}
const kidCss=document.createElement('style');kidCss.textContent=`
.cover.plain{background:color-mix(in srgb,hsl(var(--ph) 42% 52%) 30%,var(--surface));color:var(--ink);display:flex;flex-direction:column;justify-content:flex-end;padding:0}
.cover.plain::before{content:"";position:absolute;left:0;right:0;top:0;height:7cqw;background:color-mix(in srgb,hsl(var(--ph) 45% 48%) 70%,var(--surface))}
.cover.plain .pl{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font:700 62cqw/1 var(--serif);color:color-mix(in srgb,hsl(var(--ph) 45% 40%) 55%,var(--surface));letter-spacing:-.04em}
.cover.plain .pt{position:relative;font:700 11.5cqw/1.08 var(--serif);padding:8cqw;color:var(--ink)}
.cover.plain .pt small{display:block;font:600 6.5cqw/1.2 var(--sans);color:color-mix(in srgb,var(--ink) 65%,transparent);margin-bottom:1.5cqw}
@container (max-width:100px){.cover.plain .pt{display:none}.cover.plain .pl{font-size:70cqw}}
.who2{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 14px;border-radius:999px;background:var(--tint);color:var(--accent);font-weight:700;font-size:14px}
`;document.head.appendChild(kidCss);
function headerKid(active){
  const links=[['Library',0],['Plays',0],['Wishlist',0]];
  return `<header class="top"><a class="brand" href="kid.html"><svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="5" width="6" height="22" rx="1" fill="var(--accent)"/><rect x="11" y="9" width="6" height="18" rx="1" fill="var(--oak)"/><rect x="19" y="4" width="6" height="23" rx="1" fill="var(--loan)" transform="rotate(8 22 27)"/><rect x="2" y="27" width="28" height="3" fill="var(--ink)"/></svg><span>The Shelf</span></a>
  <nav class="mainnav" aria-label="Main">${links.map(([n])=>`<a href="${n==='Library'?'kid.html':'#'}" ${n===active?'aria-current="page"':''}>${n}</a>`).join('')}</nav>
  <div class="who"><span class="me"><span class="av pp" style="--h:100">L</span><span class="mename">Leo</span></span></div></header>`;
}
function tabKid(active){
  const t=[['Library','book'],['Plays','dice'],['Wishlist','heart']];
  return `<nav class="tabbar" aria-label="Main">${t.map(([n,ic])=>`<a href="#" ${n===active?'aria-current="page"':''}><i class="ic">${I[ic]}</i>${n}</a>`).join('')}</nav>`;
}
