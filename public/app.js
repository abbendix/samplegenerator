const $=id=>document.getElementById(id);
let style='space';let urls=[];let referenceProfile=null;
const script=$('script');
function updateCount(){$('count').textContent=`${script.value.length} / 900 characters`;}
script.addEventListener('input',updateCount);updateCount();
$('styles').addEventListener('click',e=>{const btn=e.target.closest('[data-style]');if(!btn)return;style=btn.dataset.style;document.querySelectorAll('[data-style]').forEach(b=>b.classList.toggle('selected',b===btn));});
if($('bpm'))$('bpm').addEventListener('input',()=>{$('bpmValue').textContent=$('bpm').value+' BPM';});
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
$('reference').addEventListener('change',async e=>{
 const file=e.target.files?.[0];referenceProfile=null;
 if(!file){$('referenceStatus').textContent='No reference loaded.';return;}
 if(file.size>15*1024*1024){$('referenceStatus').textContent='File too large (maximum 15 MB).';e.target.value='';return;}
 $('referenceStatus').textContent='Analyzing reference locally…';
 try{
  const ctx=new (window.AudioContext||window.webkitAudioContext)();
  let decoded;
  try{decoded=await ctx.decodeAudioData(await file.arrayBuffer());}finally{await ctx.close();}
  if(decoded.duration<0.4||decoded.duration>120)throw Error('Use a reference between 0.4 and 120 seconds.');
  const samples=decoded.getChannelData(0),stride=Math.max(1,Math.floor(decoded.sampleRate/11025));
  let previous=0,low=0,high=0,energy=0,highEnergy=0,count=0;
  const alpha=1-Math.exp(-2*Math.PI*850/decoded.sampleRate*stride);
  for(let i=0;i<samples.length;i+=stride){const v=samples[i];low+=alpha*(v-low);high=v-low;energy+=v*v;highEnergy+=high*high;count++;previous=v;}
  const brightness=Math.sqrt(highEnergy/Math.max(energy,1e-10));
  const rms=Math.sqrt(energy/count);
  referenceProfile={brightness:clamp(brightness,0,1.5),rms,filename:file.name};
  $('referenceStatus').textContent='Reference ready: '+file.name+' · '+(brightness<0.55?'warm / muffled':brightness<0.9?'balanced':'bright / crisp')+' tone. Applied as tonal color, not voice cloning.';
 }catch(err){$('referenceStatus').textContent='Could not analyze reference: '+err.message;}
});
async function matchReference(blob,profile){
 const ctx=new (window.AudioContext||window.webkitAudioContext)();let decoded;
 try{decoded=await ctx.decodeAudioData(await blob.arrayBuffer());}finally{await ctx.close();}
 const channels=Math.min(decoded.numberOfChannels,2),length=decoded.length,rate=decoded.sampleRate;
 const offline=new OfflineAudioContext(channels,length,rate);
 const source=offline.createBufferSource();source.buffer=decoded;
 const highpass=offline.createBiquadFilter();highpass.type='highpass';highpass.frequency.value=profile.brightness<0.55?190:90;
 const lowpass=offline.createBiquadFilter();lowpass.type='lowpass';lowpass.frequency.value=clamp(1300+profile.brightness*5500,1800,11000);
 const shelf=offline.createBiquadFilter();shelf.type='highshelf';shelf.frequency.value=2200;shelf.gain.value=clamp((profile.brightness-0.75)*12,-8,6);
 source.connect(highpass);highpass.connect(lowpass);lowpass.connect(shelf);shelf.connect(offline.destination);source.start();
 const rendered=await offline.startRendering();
 const output= new ArrayBuffer(44+rendered.length*channels*2),view=new DataView(output);
 const write=(offset,str)=>{for(let i=0;i<str.length;i++)view.setUint8(offset+i,str.charCodeAt(i));};
 write(0,'RIFF');view.setUint32(4,output.byteLength-8,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);
 view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,rate,true);view.setUint32(28,rate*channels*2,true);
 view.setUint16(32,channels*2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,rendered.length*channels*2,true);
 const data=Array.from({length:channels},(_,c)=>rendered.getChannelData(c));let offset=44;
 for(let i=0;i<rendered.length;i++)for(let c=0;c<channels;c++){const v=clamp(data[c][i],-1,1);view.setInt16(offset,v<0?v*32768:v*32767,true);offset+=2;}
 return new Blob([output],{type:'audio/wav'});
}
$('generate').addEventListener('click',async()=>{
 const text=script.value.trim();if(!text){$('status').textContent='Enter some text first.';return;}
 const btn=$('generate');btn.disabled=true;$('takes').replaceChildren();urls.forEach(URL.revokeObjectURL);urls=[];
 const params={text,style,gender:$('gender').value,bpm:Number($('bpm')?.value||128),bars:Number($('bars')?.value||2),sync:$('sync')?.checked||false,voiceDirection:$('voiceDirection').value.trim()};
 try{
  for(let variation=0;variation<1;variation++){
   $('status').textContent=`Generating one sample…`;
   const response=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...params,variation})});
   if(!response.ok){const raw=await response.text();let result;try{result=JSON.parse(raw);}catch{result={error:raw.slice(0,600)}};throw new Error(`HTTP ${response.status}${result.stage?' · '+result.stage:''}: ${result.error||'Unknown error'}${result.errorId?' [ID '+result.errorId+']':''}`);}
   const raw=await response.blob();const matched=!!referenceProfile;const blob=matched?await matchReference(raw,referenceProfile):raw;const extension=matched?'wav':'mp3';const url=URL.createObjectURL(blob);urls.push(url);
   const wrap=document.createElement('div');wrap.className='take';
   const head=document.createElement('div');head.className='take-head';
   const title=document.createElement('strong');title.textContent=`TAKE ${String(variation+1).padStart(2,'0')}`;
   const link=document.createElement('a');link.className='download';link.textContent='↓ '+extension.toUpperCase();link.href=url;link.download=`voice-lab-${style}-take-${variation+1}.${extension}`;
   const audio=document.createElement('audio');audio.controls=true;audio.src=url;
   head.append(title,link);wrap.append(head,audio);$('takes').append(wrap);
  }
  $('status').textContent='Sample generated. '+(referenceProfile?'Reference tone matching applied locally. Download WAV.':'Download MP3.')';
 }catch(error){$('status').textContent=error.message;}
 finally{btn.disabled=false;}
});