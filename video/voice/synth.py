import argparse
import json
import subprocess
import sys
from pathlib import Path

VIDEO = Path(__file__).resolve().parent.parent
PREFIX = "You are a helpful assistant.<|endofprompt|>"


def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def probe(path, ffprobe):
    out = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        check=True, capture_output=True, text=True,
    )
    return round(float(out.stdout.strip()) * 1000)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", required=True)
    parser.add_argument("--cosyvoice", required=True)
    parser.add_argument("--reference", required=True)
    parser.add_argument("--reference-text", required=True)
    parser.add_argument("--lang", default="zh,en")
    parser.add_argument("--only", default="")
    parser.add_argument("--speed", type=float, default=1.0)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--ffprobe", default="ffprobe")
    args = parser.parse_args()

    repo = Path(args.cosyvoice)
    sys.path.insert(0, str(repo))
    sys.path.insert(0, str(repo / "third_party" / "Matcha-TTS"))
    import torch
    import torchaudio
    from cosyvoice.cli.cosyvoice import AutoModel
    from cosyvoice.utils.common import set_all_random_seed

    model = AutoModel(model_dir=str(repo / "pretrained_models" / "Fun-CosyVoice3-0.5B"))
    narration = json.loads((VIDEO / "src" / "videos" / args.video / "narration.json").read_text(encoding="utf-8"))
    out_root = VIDEO / "assets" / "voice" / args.video
    durations_file = out_root / "durations.json"
    durations = json.loads(durations_file.read_text(encoding="utf-8")) if durations_file.exists() else {}
    only = {name for name in args.only.split(",") if name}

    for lang in args.lang.split(","):
        out_dir = out_root / lang
        out_dir.mkdir(parents=True, exist_ok=True)
        durations.setdefault(lang, {})
        for line, text in narration[lang].items():
            if only and line not in only:
                continue
            set_all_random_seed(args.seed)
            chunks = [
                piece["tts_speech"]
                for piece in model.inference_zero_shot(text, PREFIX + args.reference_text, args.reference, stream=False, speed=args.speed)
            ]
            wav = out_dir / f"{line}.wav"
            torchaudio.save(str(wav), torch.cat(chunks, dim=1), model.sample_rate)
            mp3 = out_dir / f"{line}.mp3"
            run(
                args.ffmpeg, "-y", "-i", str(wav),
                "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-17:TP=-1.5:LRA=7",
                "-ar", "48000", "-b:a", "160k", str(mp3),
            )
            wav.unlink()
            durations[lang][line] = probe(mp3, args.ffprobe)
            print(lang, line, durations[lang][line], text)

    durations_file.write_text(json.dumps(durations, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
