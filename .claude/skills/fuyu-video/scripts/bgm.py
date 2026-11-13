import argparse
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ace", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--caption", required=True)
    parser.add_argument("--bpm", type=int, default=100)
    parser.add_argument("--duration", type=float, default=60)
    parser.add_argument("--seeds", default="5,31")
    args = parser.parse_args()

    ace = Path(args.ace).resolve()
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    sys.path.insert(0, str(ace))
    from acestep.handler import AceStepHandler
    from acestep.inference import GenerationConfig, GenerationParams, generate_music
    from acestep.llm_inference import LLMHandler

    seeds = [int(seed) for seed in args.seeds.split(",") if seed]
    handler = AceStepHandler()
    status = handler.initialize_service(project_root=str(ace), config_path="acestep-v15-turbo", device="cuda")
    print(status)
    params = GenerationParams(
        caption=args.caption, lyrics="[Instrumental]", instrumental=True, bpm=args.bpm, duration=args.duration,
        thinking=False, use_cot_metas=False, use_cot_caption=False, use_cot_language=False,
    )
    config = GenerationConfig(batch_size=len(seeds), audio_format="flac", use_random_seed=False, seeds=seeds)
    result = generate_music(handler, LLMHandler(), params, config, save_dir=str(out))
    if not result.success:
        raise SystemExit(f"generation failed: {result.error}")
    for audio in result.audios:
        print(audio["path"])


if __name__ == "__main__":
    main()
