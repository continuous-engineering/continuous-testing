/**
 * lib/bookmarklet.ts
 *
 * Generates the bookmarklet JS for browser action recording.
 *
 * Two communication modes:
 *   1. PRIMARY — window.opener.postMessage (real-time, zero CORS, preferred)
 *      Used when the CT app opened the target site via window.open().
 *      Each action is streamed live to the CT recording UI.
 *
 *   2. FALLBACK — HTTP POST to CT API (single save at the end)
 *      Used when the user clicks the bookmarklet independently (no opener).
 *      Requires the session ID + token embedded in the bookmark.
 *
 * Selector strategy (in priority order):
 *   aria-label → data-testid/cy/test → id → visible text → CSS path
 */

export function buildBookmarklet(sessionId: string, token: string, apiBase: string): string {
  const src = bookmarkletSource(sessionId, token, apiBase)
  return 'javascript:' + encodeURIComponent(src)
}

export function bookmarkletSource(sessionId: string, token: string, apiBase: string): string {
  return `(function(){
if(document.getElementById('_ct_rec'))return;
var SID='${sessionId}',TOK='${token}',API='${apiBase}';
var CT_ORIGIN='${apiBase}';
var steps=[],pX=16,pY=16,dragging=false,dX=0,dY=0;
var useOpener=!!(window.opener&&!window.opener.closed);

/* ── Selector ─────────────────────────────────────────────────────── */
function qs(el){
  var a=el.getAttribute('aria-label');
  if(a&&a.length<80)return'[aria-label="'+esc(a)+'"]';
  var t=el.dataset.testid||el.dataset.cy||el.dataset.test;
  if(t)return'[data-testid="'+esc(t)+'"]';
  if(el.id&&!/^[0-9]/.test(el.id))return'#'+el.id;
  var tag=el.tagName;
  var txt=(el.innerText||el.value||'').trim().replace(/\\s+/g,' ').slice(0,60);
  if(txt&&/^(BUTTON|A|LABEL|H[1-6]|LI|TD|TH|SPAN|P)$/.test(tag))return'text='+txt;
  /* CSS path */
  var p=[],e=el;
  while(e&&e.tagName!=='BODY'){
    var s=e.tagName.toLowerCase();
    var n=1,sib=e.previousElementSibling;
    while(sib){if(sib.tagName===e.tagName)n++;sib=sib.previousElementSibling;}
    p.unshift(n>1?s+':nth-of-type('+n+')':s);
    e=e.parentElement;
    if(p.length>=4)break;
  }
  return p.join(' > ');
}
function esc(s){return s.replace(/["\\\\]/g,'\\\\$&');}
function itxt(el){return(el.innerText||el.placeholder||el.name||el.type||el.tagName).trim().slice(0,50);}

/* ── Send action ──────────────────────────────────────────────────── */
function send(action){
  steps.push(action);
  render();
  if(useOpener){
    try{window.opener.postMessage({_ct:1,action:action,total:steps.length},CT_ORIGIN);}
    catch(e){useOpener=false;}
  }
}

/* ── Listeners ────────────────────────────────────────────────────── */
var lastUrl=location.href;
var navTimer=setInterval(function(){
  if(location.href!==lastUrl){
    send({type:'navigate',url:location.href,intent:'Navigate to '+location.pathname});
    lastUrl=location.href;
  }
},500);

document.addEventListener('click',function(e){
  if(e.target.closest('#_ct_rec'))return;
  var el=e.target;
  /* ignore plain navigation links — nav listener catches those */
  if(el.tagName==='A'&&el.href&&!el.href.startsWith('javascript')&&!el.href.startsWith('#')){return;}
  send({type:'click',selector:qs(el),intent:'Click '+itxt(el)});
},true);

document.addEventListener('change',function(e){
  if(e.target.closest('#_ct_rec'))return;
  var el=e.target;
  if(el.tagName==='SELECT'){
    send({type:'select',selector:qs(el),value:el.value,intent:'Select "'+el.value+'" in '+(el.name||'dropdown')});
  }else if(el.tagName==='INPUT'||el.tagName==='TEXTAREA'){
    var v=el.type==='password'?'{{secrets.PASSWORD}}':el.value;
    send({type:'fill',selector:qs(el),value:v,intent:'Fill '+(el.placeholder||el.name||'field')});
  }
},true);

/* ── Commands from opener ─────────────────────────────────────────── */
window.addEventListener('message',function(e){
  if(e.origin!==CT_ORIGIN)return;
  if(e.data&&e.data._ct_cmd==='stop')saveAndClose();
});

/* ── Save ─────────────────────────────────────────────────────────── */
async function saveAndClose(){
  clearInterval(navTimer);
  if(useOpener){
    window.opener.postMessage({_ct:1,done:true,steps:steps,startUrl:location.href},CT_ORIGIN);
  }else{
    var btn=document.getElementById('_ct_save');
    if(btn){btn.textContent='Saving…';btn.disabled=true;}
    try{
      await fetch(API+'/api/record/'+SID,{
        method:'PUT',
        headers:{'Content-Type':'application/json','X-Recording-Token':TOK},
        body:JSON.stringify({startUrl:location.href,actions:steps})
      });
    }catch(err2){console.warn('CT save failed',err2);}
    if(btn)btn.textContent='Saved — return to CT';
  }
  setTimeout(function(){
    var p=document.getElementById('_ct_rec');
    if(p)p.remove();
  },800);
}

/* ── UI ───────────────────────────────────────────────────────────── */
window._ct_del=function(i){steps.splice(i,1);render();};
window._ct_assert=function(){
  var s=prompt('Selector (or press OK for visible-text search):','');
  if(s!=null)send({type:'assert',selector:s||undefined,intent:'Assert visible: '+s});
};
window._ct_shot=function(){send({type:'screenshot',intent:'Screenshot'});};

function render(){
  var el=document.getElementById('_ct_steps');if(!el)return;
  var icons={navigate:'↗',click:'◉',fill:'✎',select:'⊟',assert:'✓',screenshot:'📷'};
  el.innerHTML=steps.length?steps.map(function(s,i){
    return'<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-bottom:1px solid #1e293b;font-size:11px;color:#94a3b8">'+
      '<span style="color:#22d3ee;flex-shrink:0;width:14px">'+(icons[s.type]||'●')+'</span>'+
      '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#cbd5e1">'+(s.intent||s.type)+'</span>'+
      '<button onclick="_ct_del('+i+')" style="background:none;border:none;color:#334155;cursor:pointer;font-size:10px;padding:0 2px;flex-shrink:0">✕</button>'+
    '</div>';
  }).join(''):'<div style="padding:16px 8px;text-align:center;color:#334155;font-size:11px">Browse the site.<br>Actions appear here.</div>';
  var cnt=document.getElementById('_ct_count');
  if(cnt)cnt.textContent=steps.length+' step'+(steps.length!==1?'s':'');
}

/* ── Drag ─────────────────────────────────────────────────────────── */
document.addEventListener('mousemove',function(e){
  if(!dragging)return;
  pX=e.clientX-dX;pY=e.clientY-dY;
  var p=document.getElementById('_ct_rec');
  if(p){p.style.right='auto';p.style.left=pX+'px';p.style.top=pY+'px';}
});
document.addEventListener('mouseup',function(){dragging=false;});

/* ── Panel ────────────────────────────────────────────────────────── */
var panel=document.createElement('div');
panel.id='_ct_rec';
panel.style.cssText='position:fixed;right:16px;top:16px;z-index:2147483647;width:268px;background:#0f172a;border:1px solid #1e3a5f;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 24px 64px rgba(0,0,0,0.9);overflow:hidden';
panel.innerHTML='<div id="_ct_hdr" style="display:flex;align-items:center;gap:8px;padding:9px 10px;background:#0d1117;cursor:grab;border-bottom:1px solid #1e293b;user-select:none">'+
  '<span style="width:7px;height:7px;border-radius:50%;background:#ef4444;flex-shrink:0;box-shadow:0 0 0 2px rgba(239,68,68,.25);animation:_ct_p 1.2s ease-in-out infinite"></span>'+
  '<span style="font-size:11px;font-weight:700;color:#e2e8f0;letter-spacing:.5px;flex:1">continuous.testing</span>'+
  '<span id="_ct_count" style="font-size:10px;color:#334155">0 steps</span>'+
  '<button onclick="document.getElementById(\'_ct_rec\').remove();clearInterval('+navTimer+')" style="background:none;border:none;color:#334155;cursor:pointer;font-size:12px;padding:0 2px;line-height:1;flex-shrink:0">✕</button>'+
'</div>'+
'<div id="_ct_steps" style="max-height:220px;overflow-y:auto"></div>'+
'<div style="display:flex;gap:4px;padding:6px 8px;border-top:1px solid #1e293b">'+
  '<button onclick="_ct_assert()" style="flex:1;padding:5px 0;background:#0d1117;color:#64748b;border:1px solid #1e293b;border-radius:6px;cursor:pointer;font-size:10px">+ Assert</button>'+
  '<button onclick="_ct_shot()" style="flex:1;padding:5px 0;background:#0d1117;color:#64748b;border:1px solid #1e293b;border-radius:6px;cursor:pointer;font-size:10px">📷 Shot</button>'+
'</div>'+
'<div style="padding:8px;border-top:1px solid #1e293b">'+
  '<button id="_ct_save" onclick="saveAndClose()" style="width:100%;padding:8px;background:#10b981;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;letter-spacing:.2px">Done — Save recording</button>'+
  (useOpener
    ?'<div style="font-size:10px;color:#22d3ee;text-align:center;margin-top:4px">↑ Real-time sync active</div>'
    :'<div style="font-size:10px;color:#475569;text-align:center;margin-top:4px">Standalone mode — saves on Done</div>'
  )+
'</div>'+
'<style>@keyframes _ct_p{0%,100%{opacity:1}50%{opacity:.2}}</style>';
document.body.appendChild(panel);
document.getElementById('_ct_hdr').addEventListener('mousedown',function(e){
  dragging=true;
  var r=panel.getBoundingClientRect();
  pX=r.left;pY=r.top;
  dX=e.clientX-pX;dY=e.clientY-pY;
  e.preventDefault();
});
render();
})()`
}

export function bookmarkletLabel() { return 'CT — Record' }
