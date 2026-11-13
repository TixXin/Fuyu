import argparse

from faster_whisper import WhisperModel

PROMPTS = {"zh": "以下是普通话的句子，使用简体中文。浮屿，QQ，微信。"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="+")
    parser.add_argument("--lang", default="zh")
    parser.add_argument("--model", default="small")
    args = parser.parse_args()

    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    for path in args.files:
        segments, info = model.transcribe(path, language=args.lang, initial_prompt=PROMPTS.get(args.lang), vad_filter=True)
        text = "".join(segment.text for segment in segments).strip()
        print(f"{path}\t{info.duration:.2f}s\t{text!r}")


if __name__ == "__main__":
    main()
