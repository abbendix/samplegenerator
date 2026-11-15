const $=id=>document.getElementById(id);
let style='space';let urls=[];
const script=$('script');
function updateCount(){$('count').textContent=`${script.value.length} / 900 characters`;}
script.addEventListener('input',updateCount);updateCount();
$('styles').addEventListener('click',e=>{const btn=e.target.closest('[data-style]');if(!btn)return;style=btn.dataset.style;document.querySelectorAll('[data-style]').forEach(b=>b.classList.toggle('selected',b===btn));});
if($('bpm'))$('bpm').addEventListener('input',()=>{$('bpmValue').textContent=$('bpm').value+' BPM';});
$('generate').addEventListener('click',async()=>{
 const text=script.value.trim();if(!text){$('status').textContent='Enter some text first.';return;}
 const btn=$('generate');btn.disabled=true;$('takes').replaceChildren();urls.forEach(URL.revokeObjectURL);urls=[];
 const params={text,style,gender:$('gender').value,bpm:Number($('bpm')?.value||128),bars:Number($('bars')?.value||2),sync:$('sync')?.checked||false};
 try{
  for(let variation=0;variation<3;variation++){
   $('status').textContent=`Generating take ${variation+1} of 3…`;
   const response=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...params,variation})});
   if(!response.ok){const raw=await response.text();let result;try{result=JSON.parse(raw);}catch{result={error:raw.slice(0,600)}};throw new Error(`HTTP ${response.status}${result.stage?' · '+result.stage:''}: ${result.error||'Unknown error'}${result.errorId?' [ID '+result.errorId+']':''}`);}
   const blob=await response.blob();const url=URL.createObjectURL(blob);urls.push(url);
   const wrap=document.createElement('div');wrap.className='take';
   const head=document.createElement('div');head.className='take-head';
   const title=document.createElement('strong');title.textContent=`TAKE ${String(variation+1).padStart(2,'0')}`;
   const link=document.createElement('a');link.className='download';link.textContent='↓ MP3';link.href=url;link.download=`voice-lab-${style}-take-${variation+1}.mp3`;
   const audio=document.createElement('audio');audio.controls=true;audio.src=url;
   head.append(title,link);wrap.append(head,audio);$('takes').append(wrap);
  }
  $('status').textContent='All 3 takes generated. Preview or download MP3.';
 }catch(error){$('status').textContent=error.message;}
 finally{btn.disabled=false;}
});