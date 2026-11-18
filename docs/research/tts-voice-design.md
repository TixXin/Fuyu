# 用本地 TTS 给宣传片「造」一个旁白音色

> 日期：2026-11-17。问题：浮屿宣传片（约 2 分钟，中英两版，语气轻快、像产品片、不要播音腔）怎么用本地 TTS 创作一个合适的旁白音色，而不只是克隆现成的声音；机器是 GTX 1050 Ti 4 GB 显存、16 GB 内存，声音要公开发布。范围：CosyVoice 仓库（README、`example.py`、`cosyvoice/cli/cosyvoice.py`、`cli/frontend.py`、`utils/common.py`、`tokenizer/tokenizer.py`）和 Fun-CosyVoice3 模型卡；Qwen3-TTS 仓库和 VoiceDesign 模型卡；VoxCPM 仓库；Parler-TTS mini v1 模型卡；WebSearch「Qwen3-TTS VoiceDesign license VRAM」「open source TTS voice design Apache」。Breeze TTS 2 已排除（要约 8 GB 显存，权重非商用）。相关任务：无。现有做法见 `fuyu-video` skill「旁白」一节和 `video/voice/synth.py`。

## 结论

1. **CosyVoice 3 管「像谁」靠参考音频，管「怎么说」的手段很有限。** instruct 模式只训练了一张固定清单（方言、大声/小声、快/慢、开心/伤心/生气、两个角色扮演），不是任意自然语言描述；「轻快的产品片语气」这种自由描述能不能听懂没有官方说明（未核实，要试）。最有效的调法仍是**换一段语气本身就轻快的参考音频**。细粒度标记 `[breath]`、`<strong>…</strong>`、`[laughter]` 等在分词器里有，官方 v3 示例只演示了 `[breath]`。语速有 `speed=` 参数。
2. **没有参考音频时，用 voice design 模型按文字描述先生成一段，再交给 CosyVoice 克隆。** 许可允许商用的有三个：Qwen3-TTS 1.7B VoiceDesign（Apache-2.0，中英都行，首选）、VoxCPM2（Apache-2.0，约 8 GB 显存）、Parler-TTS mini v1（Apache-2.0，只有英文）。**三个都不能在 1050 Ti 上舒服地跑**（1.7B–2B 参数；Pascal 卡没有 bf16、也用不了 FlashAttention 2），但造参考只要跑一次、只要 10 秒音频，**放 CPU 上用 16 GB 内存慢慢跑可以接受**（未实测速度）。
3. **参考音频**：5–15 秒、单人、无背景音乐和混响、句子完整、语气和目标台词接近；CosyVoice 硬性上限 30 秒。中英两版最好各有一段**同一个人设**的参考；固定 seed 保证可复现；每句多生成几条，先用 ASR 回读筛错字，再人耳挑。
4. **许可**：上面四个模型（含 CosyVoice 3）代码和权重都标 Apache-2.0，可商用。真正的风险在参考音频：克隆真人的声音要有本人授权（中国《民法典》第 1023 条：声音保护参照肖像权，未在本次核对原文）。**用 voice design 造出来的声音不对应任何真人，是这次想换方案的主要理由。**发布时按平台要求标注 AI 合成（见 [ai-promo-videos.md](ai-promo-videos.md)）。

**推荐流程**见文末「推荐流程」，5 步。

## 详细

### 1. CosyVoice 3 能怎么控制

| 手段 | 写法 | 说明 |
|---|---|---|
| 零样本克隆（现在用的） | `inference_zero_shot(tts_text, "You are a helpful assistant.<\|endofprompt\|>" + 参考原话, prompt_wav, speed=1.0)` | 音色、语气、节奏都从参考里学，`prompt_text` 必须是参考音频的原话 |
| instruct | `inference_instruct2(tts_text, "You are a helpful assistant. 请非常开心地说一句话。<\|endofprompt\|>", prompt_wav)` | 音色仍来自 `prompt_wav`，风格来自指令；不用参考原话。官方支持的指令只有 `utils/common.py` 里 `instruct_list` 那 26 条 |
| 细粒度标记 | 写在 `tts_text` 里，如 `"You are a helpful assistant.<\|endofprompt\|>[breath]三件小事，[breath]一座岛就够了。"` | 分词器里有 `[breath]` `[quick_breath]` `[laughter]` `<laughter>…</laughter>` `<strong>…</strong>` `[sigh]` `[noise]` 等；官方 v3 示例只用 `[breath]` 配 `inference_cross_lingual`，`<strong>` 和 `[laughter]` 出现在 CosyVoice 1/2 的示例里，在 v3 上效果未核实 |
| 跨语种 | `inference_cross_lingual(英文文本, 中文参考.wav)` | 中文参考说英文。不传参考原话；口音会不会带过去要实听（未核实） |
| 读音纠正 | 拼音 `[j][ǐ]`、英文 CMU 音素 | v3 分词器里有约 200 个拼音和 130 个 ARPAbet 标记 |
| 语速 | 所有 `inference_*` 都有 `speed=1.0`；或 instruct「请用尽可能快地语速说一句话」 | `speed` 在生成后整体变速，建议只在 0.95–1.1 内微调（经验，未核实） |

instruct 清单里和宣传片有关的只有：大声、小声、快、慢、开心、伤心、生气。「开心」可能过头，适合个别感叹句，不适合整片。

### 2. 没有参考音频时怎么造一个声音

| 模型 | 许可 | 大小 | 语言 | 怎么描述 | 这台机器 |
|---|---|---|---|---|---|
| [Qwen3-TTS 1.7B VoiceDesign](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign) | Apache-2.0 | 1.7B（模型卡写 2B，BF16） | 中英等 10 种 | `generate_voice_design(text=…, language=…, instruct="二十多岁的女声，音色明亮干净，语速偏快，像在给朋友介绍好用的小工具，不要播音腔")` | 官方没给显存要求；第三方说法 4–16 GB 不等。GPU 要 bf16/FA2，1050 Ti 都不支持 → **CPU fp32 跑**（权重约 7–8 GB，16 GB 内存放得下，未实测） |
| [VoxCPM2](https://github.com/OpenBMB/VoxCPM) | Apache-2.0（代码和权重） | 2B | 30 种，含中英 | 文本开头加括号：`"(年轻女声，明亮轻快)欢迎使用浮屿"`，有 `seed=` 参数 | 官方约 8 GB 显存 → 只能 CPU；更小的 VoxCPM1.5 / 0.5B 不支持 voice design |
| [Parler-TTS mini v1](https://huggingface.co/parler-tts/parler-tts-mini-v1) | Apache-2.0 | 0.9B | 只有英文 | `"A female speaker delivers a slightly expressive and animated speech with a moderate speed and pitch."`；也可以写训练集里的 34 个具名说话人 | 体量最小，可能塞进 4 GB（未实测）；只能造英文参考，音质比前两个旧 |

Qwen3-TTS 官方 README 直接给了「先 VoiceDesign 造声音 → 用 Base 模型 `create_voice_clone_prompt` 存成可复用的克隆提示 → `generate_voice_clone` 念别的台词」的流程，说明它适合「多句台词保持同一个角色声音」。所以同一个造出来的声音，可以用 Qwen3-TTS Base（0.6B 版更小）**再念一段英文**，得到同一人设的英文参考。

同一段描述每次生成的声音都不一样，要批量出候选再挑，挑中后就**固定那段音频**，不要每次重新 design。

VoiceSculptor 等其他 voice design 项目没查到许可，不列。

### 3. 参考音频和调教技巧

- **时长**：CosyVoice 前端超过 30 秒直接报错；现在用的 6.6 秒效果可以。建议 5–15 秒、1–2 个完整句子（经验，未核实）。
- **干净**：单人、无背景音乐和混响、无剪辑接缝；有音乐先 demucs 分离（`fuyu-video` skill 里有做法和「句间空隙降到 -49 dB」的标准）。造出来的参考一般本来就干净。
- **语气接近目标**：零样本会把参考的节奏和情绪一起学走。参考是播音腔，生成就是播音腔；想要轻快，就让参考念一句产品片风格的台词（比如「截图、贴图、剪贴板，一座岛全搞定」），而不是念新闻句子。
- **中英分开**：中文片用中文参考，英文片用同一人设的英文参考（上一节的 Qwen3 Base 克隆，或 CosyVoice `inference_cross_lingual` 先生成一段再挑）。中文参考直接念英文可能带口音（未核实，值得 A/B 听一下）。
- **固定 seed**：每句合成前 `set_all_random_seed(seed)`（`synth.py` 已经这么做，默认 7）。同机器、同版本、同参考、同文本时可复现；换显卡或 torch 版本后不保证一致（未核实）。
- **多条里挑最好的**：每句用 3–5 个 seed 各生成一条 → 用 ASR 回读（`readback.py`）算字错率，有错字、漏字的淘汰 → 时长明显偏长偏短的淘汰 → 剩下的人耳听。可选加说话人相似度打分防止音色漂移（工具未调研）。把选中的 seed 记下来，改台词只重跑那一句。

### 4. 1050 Ti 上要注意的

- Pascal（计算能力 6.1）没有 bf16，FlashAttention 2 要 Ampere 以上（未在本次核对 FlashAttention 仓库原文），GP107 的 fp16 很慢（未核实）。所以 GPU 上一律用 fp32，CosyVoice 不开 `fp16=True`。
- CosyVoice 3 0.5B 在 4 GB 上 fp32 应该能放下（未实测）；放不下就 CPU 跑，2 分钟旁白总量不大。
- voice design 那一步只做一次，直接 CPU。

## 推荐流程

1. **写人设、造候选**：中文写一段音色描述（年龄、音色、语速、情绪、「不要播音腔」），用 Qwen3-TTS 1.7B VoiceDesign 在 CPU 上批量生成 6–10 条 8–12 秒的中文样句，样句用宣传片里的真实台词风格。
2. **挑定并固定**：人耳挑一条，存成参考 wav（16 kHz 单声道，首尾留白裁掉），连同描述、样句原文、模型版本记在本机说明里。这段音频以后就是「浮屿的声音」，不再重新 design。
3. **配英文参考**：用 Qwen3-TTS Base 对这条参考建克隆提示，念几句英文样句，挑一条作为英文参考。
4. **CosyVoice 3 逐句合成**：中英各用自己的参考跑 `inference_zero_shot`，每句 3–5 个 seed，`speed` 在 0.95–1.1 内微调；个别句子再试 `[breath]`。
5. **筛选和记录**：ASR 回读去掉错字条，人耳挑定，记下每句的 seed；发布时按平台要求标注 AI 合成配音。

## 来源

- CosyVoice 仓库 README：https://github.com/FunAudioLLM/CosyVoice
- CosyVoice `example.py`（v3 的 zero-shot、`[breath]`、instruct、拼音示例）：https://github.com/FunAudioLLM/CosyVoice/blob/main/example.py
- `cosyvoice/cli/cosyvoice.py`（`speed`、`fp16` 参数）：https://github.com/FunAudioLLM/CosyVoice/blob/main/cosyvoice/cli/cosyvoice.py
- `cosyvoice/cli/frontend.py`（参考音频 30 秒上限）：https://github.com/FunAudioLLM/CosyVoice/blob/main/cosyvoice/cli/frontend.py
- `cosyvoice/utils/common.py`（`instruct_list`、`set_all_random_seed`）：https://github.com/FunAudioLLM/CosyVoice/blob/main/cosyvoice/utils/common.py
- `cosyvoice/tokenizer/tokenizer.py`（细粒度标记）：https://github.com/FunAudioLLM/CosyVoice/blob/main/cosyvoice/tokenizer/tokenizer.py
- Fun-CosyVoice3-0.5B-2512 模型卡（apache-2.0；卡上另有「内容仅供学术演示」的免责声明，指的是示例内容）：https://huggingface.co/FunAudioLLM/Fun-CosyVoice3-0.5B-2512
- Qwen3-TTS 仓库（VoiceDesign、design→clone 流程、FlashAttention 2 只支持 fp16/bf16）：https://github.com/QwenLM/Qwen3-TTS
- Qwen3-TTS VoiceDesign 模型卡：https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign
- Qwen3-TTS 技术报告：https://arxiv.org/abs/2601.15621
- Qwen3-TTS 显存的第三方说法（不一致，仅供参考）：https://betterstack.com/community/guides/ai/qwen3-tts/ 、https://lilting.ch/en/articles/qwen3-tts-voice-synthesis
- VoxCPM 仓库（VoxCPM2 2B、约 8 GB、voice design 写法、许可）：https://github.com/OpenBMB/VoxCPM
- Parler-TTS mini v1 模型卡：https://huggingface.co/parler-tts/parler-tts-mini-v1
