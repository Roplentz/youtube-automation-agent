"""Transcrição palavra a palavra (faster-whisper) -> words.json [{w, s, e}].
Uso: python3 transcribe.py video.mp4 [words.json] [--modelo small]
Roda localmente, sem API paga. Requer: pip install faster-whisper numpy."""
import json, subprocess, sys
import numpy as np


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    modelo = sys.argv[sys.argv.index('--modelo') + 1] if '--modelo' in sys.argv else 'small'
    if modelo in args: args.remove(modelo)
    if not args: sys.exit('Uso: python3 transcribe.py video.mp4 [words.json] [--modelo small]')
    video, out = args[0], (args[1] if len(args) > 1 else 'words.json')
    from faster_whisper import WhisperModel
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768  # array evita bug do PyAV com arquivos
    segs, _ = WhisperModel(modelo, compute_type='int8').transcribe(audio, language='pt', word_timestamps=True)
    words = []
    for s in segs:
        print(f'[{s.start:6.1f}-{s.end:6.1f}] {s.text}')
        words += [dict(w=x.word.strip(), s=round(x.start, 2), e=round(x.end, 2)) for x in s.words]
    json.dump(words, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{len(words)} palavras -> {out}')


if __name__ == '__main__':
    main()
