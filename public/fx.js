// Browser-only effect engine: no additional API calls.
window.VoiceFX={
 async render(blob,style,profile){
  const context=new (window.AudioContext||window.webkitAudioContext)();let input;
  try{input=await context.decodeAudioData(await blob.arrayBuffer());}finally{await context.close();}
  const rate=input.sampleRate,channels=1,tail=style==='horror'?1.5:style==='space'?.4:0;
  const length=Math.ceil((input.duration+tail)*rate);
  const offline=new OfflineAudioContext(channels,length,rate);
  const source=offline.createBufferSource();source.buffer=input;
  const hp=offline.createBiquadFilter();hp.type='highpass';
  const lp=offline.createBiquadFilter();lp.type='lowpass';
  const drive=offline.createWaveShaper();const curve=new Float32Array(65536);
  const intensity=style==='horror'?5:style==='radio'?3:1.25;
  for(let i=0;i<curve.length;i++){const x=i/(curve.length-1)*2-1;curve[i]=Math.tanh(intensity*x)/Math.tanh(intensity);}
  drive.curve=curve;drive.oversample='2x';
  const brightness=profile?.brightness;
  hp.frequency.value=style==='radio'?300:style==='space'?190:80;
  lp.frequency.value=style==='radio'?2800:style==='space'?3800:style==='horror'?4800:9000;
  if(Number.isFinite(brightness))lp.frequency.value=Math.min(lp.frequency.value,Math.max(1200,1900+brightness*3800));
  const wet=offline.createGain();wet.gain.value=.9;
  source.connect(hp);hp.connect(lp);lp.connect(drive);drive.connect(wet);wet.connect(offline.destination);
  if(style==='space'||style==='horror'){
   const delay=offline.createDelay(1);delay.delayTime.value=style==='space'?.045:.22;
   const feedback=offline.createGain();feedback.gain.value=style==='space'?.15:.4;
   const echo=offline.createGain();echo.gain.value=style==='space'?.24:.4;
   drive.connect(delay);delay.connect(echo);echo.connect(offline.destination);delay.connect(feedback);feedback.connect(delay);
  }
  source.start();const rendered=await offline.startRendering();
  const samples=rendered.getChannelData(0);let peak=0;for(let i=0;i<samples.length;i++)peak=Math.max(peak,Math.abs(samples[i]));
  const gain=peak?Math.min(1.8,.91/peak):1;
  const out=new ArrayBuffer(44+samples.length*2),view=new DataView(out);
  const str=(p,s)=>{for(let i=0;i<s.length;i++)view.setUint8(p+i,s.charCodeAt(i));};
  str(0,'RIFF');view.setUint32(4,out.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
  str(36,'data');view.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++){const x=Math.max(-1,Math.min(1,samples[i]*gain));view.setInt16(44+i*2,Math.round(x<0?x*32768:x*32767),true);}
  return new Blob([out],{type:'audio/wav'});
 }
};