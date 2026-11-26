// Execute from the repository root. See scripts/vsl/README.md.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw Error('Campo obrigatório: ' + field);
}

function validate(plan) {
  requireText(plan.produto, 'produto');
  if (plan.aberturas?.length !== 2 || !Array.isArray(plan.corpo) || !plan.corpo.length)
    throw Error('O plano precisa de duas aberturas e um corpo comum.');
  for (const scene of [...plan.aberturas, ...plan.corpo]) {
    requireText(scene.fala, 'fala');
    requireText(scene.visual, 'visual');
  }
}

async function draft(brief, dest) {
  for (const key of ['produto', 'publico', 'oferta', 'objecao', 'prova', 'cta']) requireText(brief[key], key);
  const { AITextService } = require('../../utils/ai-text-service');
  const service = new AITextService();
  const prompt = 'Escreva uma VSL em português do Brasil para 60–90 segundos. Use apenas fatos do briefing. Não invente provas, resultados, condições ou preços. Marque materiais pendentes nas instruções visuais. Crie duas aberturas distintas e o mesmo corpo, encerrando com a CTA exata. Retorne somente JSON no formato {"produto":"...", "aberturas":[{"fala":"...","visual":"..."},{"fala":"...","visual":"..."}],"corpo":[{"fala":"...","visual":"..."}]}. Briefing: ' + JSON.stringify(brief);
  const response = await service.generateText(prompt);
  const plan = JSON.parse(response.trim().replace(/^\x60{3}(?:json)?\s*|\s*\x60{3}$/gi, ''));
  validate(plan);
  fs.writeFileSync(dest, JSON.stringify(plan, null, 2), {flag:'wx'});
}

async function render(plan, variant, dest, mode) {
  validate(plan);
  if (!['A','B'].includes(variant) || !['preview','voz'].includes(mode)) throw Error('Use A ou B e preview ou voz.');
  const scenes = [plan.aberturas[variant === 'A' ? 0 : 1], ...plan.corpo];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsl-'));
  try {
    let voice;
    if (mode === 'voz') {
      if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID) throw Error('Configure ELEVENLABS_API_KEY e ELEVENLABS_VOICE_ID.');
      const { AIVideoGenerator } = require('../../utils/ai-video-generator');
      voice = new AIVideoGenerator({});
      voice.elevenLabsVoiceId = process.env.ELEVENLABS_VOICE_ID;
    }
    for (const [i, scene] of scenes.entries()) {
      const tokens = scene.fala.split(/\s+/);
      const seconds = tokens.length / 2.3 + 0.6;
      const lines = [''];
      for (const word of tokens) {
        if ((lines.at(-1) + word).length > 44) lines.push('');
        lines[lines.length-1] += (lines.at(-1) ? ' ' : '') + word;
      }
      fs.writeFileSync(path.join(dir,'fala.txt'), lines.join('\n'));
      fs.writeFileSync(path.join(dir,'titulo.txt'), plan.produto);
      const args = ['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=0x102839:s=1280x720:r=24'];
      if (voice) {
        const audio = path.join(dir,i+'.mp3');
        await voice.generateElevenLabsTTS(scene.fala, audio);
        args.push('-i',audio,'-af','apad=pad_dur=0.3','-shortest','-c:a','aac','-ar','48000','-ac','2');
      } else args.push('-t',seconds.toFixed(3));
      const filters = 'drawbox=x=72:y=105:w=120:h=5:color=0x69DBC4:t=fill,drawtext=textfile=titulo.txt:expansion=none:fontsize=30:fontcolor=0x69DBC4:x=72:y=50,drawtext=textfile=fala.txt:expansion=none:fontsize=42:line_spacing=13:fontcolor=white:x=72:y=(h-text_h)/2';
      args.push('-vf',filters,'-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p',i+'.mp4');
      execFileSync('ffmpeg',args,{cwd:dir});
    }
    fs.writeFileSync(path.join(dir,'clipes.txt'),scenes.map((_,i)=>"file '"+i+".mp4'").join('\n'));
    execFileSync('ffmpeg',['-loglevel','error','-f','concat','-safe','1','-i','clipes.txt','-c','copy','-movflags','+faststart','filme.mp4'],{cwd:dir});
    fs.copyFileSync(path.join(dir,'filme.mp4'),dest,fs.constants.COPYFILE_EXCL);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
}

async function main() {
  const [command, source, ...args] = process.argv.slice(2);
  const data = JSON.parse(fs.readFileSync(source,'utf8'));
  if (command === 'roteiro') return draft(data, args[0]);
  if (command === 'render') return render(data, ...args);
  throw Error('Comandos disponíveis: roteiro, render.');
}
main().catch(error=>{ console.error(error.message); process.exitCode = 1; });
