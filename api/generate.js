import { randomUUID } from 'node:crypto';

const styles = {
 radio: {prompt:'Natural 1930s radio announcer, poised, articulate, warm, formal, archival performance.', low:220, high:3200, drive:1.25, echo:0},
 space: {prompt:'Calm, restrained, measured, clinical futuristic spaceship computer. Subtly intimate and human. Do not imitate any actor or fictional character.', low:160, high:4200, drive:1, echo:0.06},
 horror: {prompt:'Believable psychological horror voice: quiet, ominous, restrained, unsettling tension, subtle pauses.', low:95, high:5500, drive:1.15, echo:0.19}
};
const voices={male:['onyx','echo'],female:['nova','shimmer'],neutral:['alloy','sage']};
function decodeWav(buffer){
 if(buffer.toString('ascii',0,4)!=='RIFF'||buffer.toString('ascii',8,12)!=='WAVE')throw Error('Unexpected WAV format');
 let offset=12,format,channels,rate,bits,dataOffset,dataSize,encoding;
 while(offset+8<=buffer.length){
  const id=buffer.toString('ascii',offset,offset+4),size=buffer.readUInt32LE(offset+4),start=offset+8;
  if(start>buffer.length)throw Error('Invalid WAV chunk');
  // Streaming WAV responses can use 0xffffffff as an unknown data length.
  const actualSize=(id==='data'&&(size===0xffffffff||start+size>buffer.length))?buffer.length-start:size;
  if(start+actualSize>buffer.length)throw Error('Invalid WAV chunk');
  if(id==='fmt '){encoding=buffer.readUInt16LE(start);channels=buffer.readUInt16LE(start+2);rate=buffer.readUInt32LE(start+4);bits=buffer.readUInt16LE(start+14);format=true;}
  if(id==='data'){dataOffset=start;dataSize=actualSize;}
  offset=start+actualSize+(actualSize%2);
 }
 if(!format||dataOffset===undefined||!rate||channels<1||channels>2)throw Error('Unsupported WAV');
 if(!((encoding===1&&[16,24,32].includes(bits))||(encoding===3&&bits===32)))throw Error('Unsupported WAV encoding');
 const bytes=bits/8,count=Math.floor(dataSize/(bytes*channels)),out=new Float32Array(count);
 for(let i=0;i<count;i++){let sum=0;for(let c=0;c<channels;c++){
  const p=dataOffset+(i*channels+c)*bytes;
  let x;
  if(encoding===3)x=buffer.readFloatLE(p);
  else if(bits===16)x=buffer.readInt16LE(p)/32768;
  else if(bits===24){let v=buffer[p]|(buffer[p+1]<<8)|(buffer[p+2]<<16);if(v&0x800000)v|=0xff000000;x=v/8388608;}
  else x=buffer.readInt32LE(p)/2147483648;
  sum+=Number.isFinite(x)?x:0;
 }out[i]=sum/channels;}
 return {samples:out,rate};
}
function processAudio(input,rate,style,targetSeconds){
 const outputRate=44100,origSeconds=input.length/rate;
 const seconds=targetSeconds||origSeconds;
 const count=Math.min(Math.round(seconds*outputRate),outputRate*120);
 if(count<1)throw Error('Empty audio');
 const result=new Float32Array(count);
 // Linear resampling: pitch-preserving for equal duration, simple rate stretch otherwise.
 const step=(input.length-1)/Math.max(1,count-1);
 const hpAlpha=1/(1+2*Math.PI*style.low/outputRate);
 const lpAlpha=Math.min(1,2*Math.PI*style.high/outputRate);
 let hp=0,prev=0,lp=0;
 const delay=Math.round(outputRate*0.11);
 for(let i=0;i<count;i++){
  const source=i*step,j=Math.floor(source),frac=source-j;
  let v=(input[j]||0)*(1-frac)+(input[Math.min(j+1,input.length-1)]||0)*frac;
  hp=hpAlpha*(hp+v-prev);prev=v;
  lp+=lpAlpha*(hp-lp);
  v=Math.tanh(lp*style.drive);
  if(style.echo&&i>=delay)v+=style.echo*result[i-delay];
  result[i]=v;
 }
 let peak=0;for(const v of result)peak=Math.max(peak,Math.abs(v));
 const gain=peak?Math.min(2.5,0.89/peak):1;
 const out=Buffer.alloc(44+count*3);
 out.write('RIFF',0);out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16);
 out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(outputRate,24);out.writeUInt32LE(outputRate*3,28);out.writeUInt16LE(3,32);out.writeUInt16LE(24,34);
 out.write('data',36);out.writeUInt32LE(count*3,40);
 for(let i=0;i<count;i++){const x=Math.max(-1,Math.min(0.999999,result[i]*gain));let n=Math.round(x*8388607);if(n<0)n+=16777216;const p=44+i*3;out[p]=n&255;out[p+1]=(n>>8)&255;out[p+2]=(n>>16)&255;}
 return out;
}
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'POST required'});}
 res.setHeader('Cache-Control','no-store');
 const {text,style='space',gender='neutral',bpm=128,bars=2,variation=0,sync=false}=req.body||{};
 if(typeof text!=='string'||!text.trim()||text.length>900||!styles[style]||!voices[gender]||!Number.isInteger(variation)||variation<0||variation>2||!Number.isFinite(Number(bpm))||Number(bpm)<60||Number(bpm)>180||![1,2,4,8].includes(Number(bars)))return res.status(400).json({error:'Invalid sample settings.'});
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'OPENAI_API_KEY is missing from Vercel.'});
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),45000);
 let stage='requesting speech';
 try{
  const instructions=styles[style].prompt+' '+['Use natural pacing.','Use slightly longer pauses.','Speak with slightly greater urgency.'][variation]+' Read the provided text exactly.';
  const response=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4o-mini-tts',voice:voices[gender][variation%2],input:text.trim(),instructions,response_format:'wav'}),signal:controller.signal});
  if(!response.ok){console.error('TTS error',response.status,(await response.text()).slice(0,300));return res.status(502).json({error:'Voice service failed ('+response.status+'). Check API key, credits and model access.'});}
  stage='decoding generated WAV';
  const wav=decodeWav(Buffer.from(await response.arrayBuffer()));
  const target=sync?Number(bars)*4*60/Number(bpm):null;
  stage='processing audio';
  const output=processAudio(wav.samples,wav.rate,styles[style],target);
  res.setHeader('Content-Type','audio/wav');
  res.setHeader('Content-Disposition','attachment; filename="voice-lab-'+style+'-'+(variation+1)+'.wav"');
  return res.status(200).send(output);
 }catch(e){const id=randomUUID().slice(0,8);console.error('Voice generation',id,stage,e.stack||e.message);return res.status(500).json({error:stage==='requesting speech'?'Speech request failed or timed out. Check Vercel logs ('+id+').':'Audio generation failed during '+stage+'. Check Vercel logs ('+id+').'});}
 finally{clearTimeout(timeout);}
}