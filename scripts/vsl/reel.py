"""python scripts/vsl/reel.py gravacao.mp4 legendas.srt 'Pergunta de abertura?' reel.mp4"""
import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile

parser = argparse.ArgumentParser(description="Monta um Reel com a fala original, gancho e legendas sincronizadas.")
for name in ("video", "legendas", "gancho", "saida"):
    parser.add_argument(name)
args = parser.parse_args()
source = Path(args.video).resolve(strict=True)
output = Path(args.saida).resolve()
with tempfile.TemporaryDirectory() as folder:
    temp = Path(folder)
    shutil.copyfile(args.legendas, temp / "captions.srt")
    import textwrap
    lines = textwrap.wrap(args.gancho, width=26)
    if not 1 <= len(lines) <= 3:
        parser.error("Use um gancho de até três linhas curtas.")
    (temp / "hook.txt").write_text("\n".join(lines), encoding="utf-8")
    # Preserve the whole speaker shot; fill the vertical margins with a blurred extension.
    filters = (
        "[0:v]split[bg][fg];"
        "[bg]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,"
        "boxblur=12:2,scale=1080:1920,eq=brightness=-0.12[back];"
        "[fg]scale=1080:1920:force_original_aspect_ratio=decrease[front];"
        "[back][front]overlay=(W-w)/2:(H-h)/2,setsar=1,"
        "drawtext=textfile=hook.txt:expansion=none:font='DejaVu Sans Bold':fontsize=52:"
        "fontcolor=white:box=1:boxcolor=0x102839@0.92:boxborderw=18:line_spacing=8:"
        "x=(w-tw)/2:y='260+40*exp(-7*t)':alpha='min(1,t*5)*min(1,max(0,(3.5-t)*4))',"
        "subtitles=captions.srt:force_style='FontName=DejaVu Sans,FontSize=12,"
        "Alignment=2,MarginV=44,Outline=1,Shadow=0,Bold=1,PrimaryColour=&H00FFFFFF',"
        "fps=30,format=yuv420p[out]"
    )
    generated = temp / "video.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-i", str(source), "-filter_complex", filters,
                    "-map", "[out]", "-map", "0:a:0", "-c:v", "libx264", "-preset", "veryfast",
                    "-c:a", "aac", "-movflags", "+faststart", str(generated)], cwd=temp, check=True)
    with generated.open("rb") as src, output.open("xb") as dest:
        shutil.copyfileobj(src, dest)
