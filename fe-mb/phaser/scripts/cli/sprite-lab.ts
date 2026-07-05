/**
 * sprite-lab — a tiny local gallery for rating sprite variants FAST. Serves the
 * variants generated into public/sprites/lab/ and lets you tag each ★ best / ✓ ok
 * / ✕ no with a note. Ratings POST straight to public/sprites/lab/ratings.json,
 * which the assistant reads to bias the next generated batch toward what you like.
 * Zero dependencies (node:http).
 *
 *   npm run gen-variants && npm run sprite-lab   -> open http://localhost:5180
 */
import { createServer } from 'node:http'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const LAB = join(HERE, '..', '..', 'public', 'sprites', 'lab')
const RATINGS = join(LAB, 'ratings.json')
const PORT = 5180

function readJson<T>(path: string, fallback: T): T {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T } catch { return fallback }
}

const HTML = `<!doctype html><html><head><meta charset="utf8"><title>sprite-lab</title>
<style>
*{box-sizing:border-box} body{margin:0;background:#15110d;color:#e8d8c0;font:14px/1.5 system-ui,sans-serif}
header{padding:16px 20px;border-bottom:1px solid #3a2e22;position:sticky;top:0;background:#15110dee;backdrop-filter:blur(4px)}
h1{margin:0 0 4px;font-size:18px;color:#e8a93a;letter-spacing:.5px}
.sub{color:#a89a86;font-size:12px}
#count{float:right;color:#a89a86;font-size:12px}
#grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;padding:18px}
.card{background:#211b14;border:1px solid #3a2e22;border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:8px}
.card.best{border-color:#e8a93a;box-shadow:0 0 0 1px #e8a93a55}
.card.ok{border-color:#5a9a5a55}.card.bad{opacity:.5}
.thumb{background-color:#2a2622;background-image:linear-gradient(45deg,#322c26 25%,transparent 25%),linear-gradient(-45deg,#322c26 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#322c26 75%),linear-gradient(-45deg,transparent 75%,#322c26 75%);background-size:12px 12px;background-position:0 0,0 6px,6px -6px,-6px 0;border-radius:5px;display:flex;align-items:center;justify-content:center;min-height:170px}
.thumb img{image-rendering:pixelated;max-width:100%;max-height:240px}
.label{font-size:11px;color:#a89a86}.label b{color:#e8d8c0}
.btns{display:flex;gap:6px}
.b{flex:1;cursor:pointer;border:1px solid #3a2e22;background:#2a2218;color:#c9bba6;border-radius:5px;padding:5px 0;font-size:12px}
.b.best.on{background:#e8a93a;color:#1a1410;border-color:#e8a93a}
.b.ok.on{background:#5a9a5a;color:#0c1a0c;border-color:#5a9a5a}
.b.bad.on{background:#b5384a;color:#fff;border-color:#b5384a}
.note{background:#15110d;border:1px solid #3a2e22;color:#e8d8c0;border-radius:5px;padding:5px;font-size:12px}
</style></head><body>
<header><span id="count"></span><h1>sprite-lab — rate the variants</h1>
<div class="sub">Tag each one. ★ = nail this direction, ✓ = acceptable, ✕ = wrong. Add a note for any change. Saves automatically; tell the assistant when you've gone through them.</div></header>
<div id="grid"></div>
<script>
function rate(id,rating,note){fetch('/api/rate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:id,rating:rating,note:note||''})}).then(load)}
function load(){fetch('/api/state').then(function(r){return r.json()}).then(function(s){
  var grid=document.getElementById('grid');grid.innerHTML='';var nb=0,no=0,nx=0;
  s.manifest.forEach(function(m){
    var cur=s.ratings[m.id]||{};if(cur.rating==='best')nb++;else if(cur.rating==='ok')no++;else if(cur.rating==='bad')nx++;
    var card=document.createElement('div');card.className='card'+(cur.rating?' '+cur.rating:'');
    var t=document.createElement('div');t.className='thumb';t.innerHTML='<img src="/img/'+m.id+'@review.png?t='+Date.now()+'">';
    var l=document.createElement('div');l.className='label';l.innerHTML='<b>'+m.id+'</b> — '+m.label;
    var bs=document.createElement('div');bs.className='btns';
    [['best','★'],['ok','✓'],['bad','✕']].forEach(function(p){
      var b=document.createElement('button');b.textContent=p[1];b.className='b '+p[0]+(cur.rating===p[0]?' on':'');
      b.onclick=function(){rate(m.id,p[0],cur.note)};bs.appendChild(b)});
    var n=document.createElement('input');n.className='note';n.placeholder='note…';n.value=cur.note||'';
    n.onchange=function(){rate(m.id,cur.rating||'',n.value)};
    card.appendChild(t);card.appendChild(l);card.appendChild(bs);card.appendChild(n);grid.appendChild(card)});
  document.getElementById('count').textContent='★ '+nb+'   ✓ '+no+'   ✕ '+nx+'   /  '+s.manifest.length;
})}
load();
</script></body></html>`

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (req.method === 'POST' && url.pathname === '/api/rate') {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      try {
        const { id, rating, note } = JSON.parse(body) as { id: string; rating: string; note?: string }
        const ratings = readJson<Record<string, { rating: string; note: string }>>(RATINGS, {})
        if (rating) ratings[id] = { rating, note: note ?? '' }
        else delete ratings[id]
        writeFileSync(RATINGS, JSON.stringify(ratings, null, 2) + '\n')
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end('{"ok":true}')
      } catch { res.writeHead(400); res.end('bad request') }
    })
    return
  }
  if (url.pathname === '/api/state') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ manifest: readJson(join(LAB, 'manifest.json'), []), ratings: readJson(RATINGS, {}) }))
    return
  }
  if (url.pathname.startsWith('/img/')) {
    const f = join(LAB, decodeURIComponent(url.pathname.slice(5)))
    if (f.startsWith(LAB) && existsSync(f)) {
      res.writeHead(200, { 'content-type': 'image/png' })
      res.end(readFileSync(f))
      return
    }
    res.writeHead(404); res.end(); return
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(HTML)
})
server.listen(PORT, () => console.log(`sprite-lab -> http://localhost:${PORT}  (rating ${readJson(join(LAB, 'manifest.json'), [] as unknown[]).length} variants; ratings -> ${RATINGS})`))
