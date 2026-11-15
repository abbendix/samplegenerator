import 'dotenv/config';
import express from 'express';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use(express.static('public'));
const PORT = Number(process.env.PORT || 3000);
const styles = {
  radio: { label: 'Vintage Radio', prompt: 'A believable 1930s-1940s radio announcer. Articulate, poised, warm but formal, measured dramatic pacing. Authentic human performance, never parody.', filter: 'highpass=f=220,lowpass=f=3200,acompressor=threshold=-24dB:ratio=2.5,acrusher=bits=12:mix=0.13' },
  space: { label: 'Space Computer', prompt: 'A calm, highly articulate, measured, emotionally restrained futuristic spaceship computer voice. Slightly intimate, clinical and unnervingly human. Do not imitate any particular actor or character.', filter: 'highpass=f=160,lowpass=f=4200,acompressor=threshold=-25dB:ratio=2,chorus=0.45:0.6:40:0.18:0.3:1.1' },
  horror: { label: 'Dark Horror', prompt: 'A convincing cinematic psychological horror performance. Quiet, intimate, ominous, restrained tension and unsettling pauses. Human and believable, not cartoonish.', filter: 'highpass=f=95,lowpass=f=5500,aecho=0.8:0.65:110:0.18,acompressor=threshold=-24dB:ratio=2.5' }
};
const voiceMap = { male: ['onyx','echo'], female: ['nova','shimmer'], neutral: ['alloy','sage'] };
function ffmpeg(args) {
  return new Promise((resolve,reject)=>{
    const proc=spawn(process.env.FFMPEG_PATH||'ffmpeg', ['-hide_banner','-loglevel','error','-y',...args], {stdio:['ignore','ignore','pipe']});
    let err=''; proc.stderr.on('data',d=>{err+=d.toString().slice(0,2000)});
    proc.on('error',reject); proc.on('close',code=>code===0?resolve():reject(new Error(err||`ffmpeg exit ${code}`)));
  });
}
function speedFilter(ratio) {
  const steps=[]; let x=ratio;
  while(x>2){steps.push('atempo=2');x/=2;}
  while(x<0.5){steps.push('atempo=0.5');x/=0.5;}
  steps.push(`atempo=${x.toFixed(5)}`);return steps.join(',');
}
app.get('/api/health', (_req,res)=>res.json({ok:true,ttsConfigured:!!process.env.OPENAI_API_KEY}));
app.post('/api/generate', async (req,res)=>{
  const { text, style='space', gender='neutral', bpm=120, bars=2, variation=0, sync=false }=req.body||{};
  if(typeof text!=='string'||!text.trim()||text.length>900) return res.status(400).json({error:'Text must contain 1–900 characters.'});
  if(!styles[style]||!voiceMap[gender]||!Number.isInteger(variation)||variation<0||variation>2) return res.status(400).json({error:'Invalid voice settings.'});
  if(!Number.isFinite(Number(bpm))||Number(bpm)<60||Number(bpm)>180||![1,2,4,8].includes(Number(bars))) return res.status(400).json({error:'Invalid BPM or bars.'});
  if(!process.env.OPENAI_API_KEY) return res.status(503).json({error:'Set OPENAI_API_KEY in .env to enable voice generation.'});
  let dir;
  try {
    dir=await mkdtemp(join(tmpdir(),'voice-lab-'));
    const raw=join(dir,'raw.wav'), output=join(dir,'output.wav');
    const voices=voiceMap[gender];
    const instructions=`${styles[style].prompt} ${variation===0?'Natural pacing.':variation===1?'Use slightly longer, deliberate pauses and more tension.':'Use a slightly more urgent cadence while remaining believable.'} Speak the supplied text exactly, without additions.`;
    const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),60000);
    let api;
    try { api=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4o-mini-tts',voice:voices[variation%voices.length],input:text.trim(),instructions,response_format:'wav'}),signal:controller.signal}); }
    finally {clearTimeout(timeout);}
    if(!api.ok) { const detail=await api.text(); throw new Error(`Voice provider returned ${api.status}: ${detail.slice(0,250)}`); }
    await writeFile(raw,Buffer.from(await api.arrayBuffer()));
    let filters=styles[style].filter;
    if(sync){
      const duration=await new Promise((resolve,reject)=>{
        const p=spawn('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',raw]);let out='';p.stdout.on('data',d=>out+=d);p.on('error',reject);p.on('close',c=>c===0?resolve(Number(out)):reject(new Error('ffprobe is required for BPM sync')));
      });
      const target=Number(bars)*4*60/Number(bpm);
      const ratio=duration/target;
      filters+=','+speedFilter(ratio)+`,apad=whole_dur=${target.toFixed(4)},atrim=duration=${target.toFixed(4)}`;
    }
    filters+=',loudnorm=I=-16:TP=-1.5:LRA=11';
    await ffmpeg(['-i',raw,'-af',filters,'-ar','44100','-ac','1','-c:a','pcm_s24le',output]);
    const data=await readFile(output);
    res.setHeader('Content-Type','audio/wav');
    res.setHeader('Content-Disposition',`attachment; filename="voice-lab-${style}-${variation+1}.wav"`);
    res.setHeader('Cache-Control','no-store');res.send(data);
  } catch(e) {console.error('Generation error:',e.message);res.status(500).json({error:e.message?.includes('Voice provider')?e.message:'Could not generate audio. Check your API key and FFmpeg installation.'});}
  finally {if(dir) await rm(dir,{recursive:true,force:true}).catch(()=>{});}
});
app.listen(PORT,()=>console.log(`Voice Lab listening at http://localhost:${PORT}`));