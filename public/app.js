const $=id=>document.getElementById(id);
let style='space';let urls=[];
const script=$('script');
function updateCount(){$('count').textContent=`${script.value.length} / 900 characters`;}
script.addEventListener('input',updateCount);updateCount();
$('styles').addEventListener('click',e=>{const btn=e.target.closest('[data-style]');if(!btn)return;style=btn.dataset.style;document.querySelectorAll('[data-style]').forEach(b=>b.classList.toggle('selected',b===btn));});
$('bpm').addEventListener('input',()=>{$('bpmValue').textContent=$('bpm').value+' BPM';});
$('generate').addEventListener('click',async()=>{
 const text=script.value.trim();if(!text){$('status').textContent='Enter some text first.';return;}
 const btn=$('generate');btn.disabled=true;$('takes').replaceChildren();urls.forEach(URL.revokeObjectURL);urls=[];
 const params={text,style,gender:$('gender').value,bpm:Number($('bpm').value),bars:Number($('bars').value),sync:$('sync').checked};
 try{
  for(let variation=0;variation<3;variation++){
   $('status').textContent=`Generating take ${variation+1} of 3…`;
   const response=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json','x-voice-lab-token':$('accessToken').value},body:JSON.stringify({...params,variation})});
   if(!response.ok){const result=await response.json().catch(()=>({}));throw new Error(result.error||`Request failed: ${response.status}`);}
   const blob=await response.blob();const url=URL.createObjectURL(blob);urls.push(url);
   const wrap=document.createElement('div');wrap.className='take';
   const head=document.createElement('div');head.className='take-head';
   const title=document.createElement('strong');title.textContent=`TAKE ${String(variation+1).padStart(2,'0')}`;
   const link=document.createElement('a');link.className='download';link.textContent='↓ WAV';link.href=url;link.download=`voice-lab-${style}-take-${variation+1}.wav`;
   const audio=document.createElement('audio');audio.controls=true;audio.src=url;
   head.append(title,link);wrap.append(head,audio);$('takes').append(wrap);
  }
  $('status').textContent='All 3 takes generated. Preview or download WAV.';
 }catch(error){$('status').textContent=error.message;}
 finally{btn.disabled=false;}
});