"""Generate the fixed lesson prompts as local MP3 files with Edge neural TTS."""

import asyncio
import json
import subprocess
from pathlib import Path

import edge_tts


VOICE = "zh-CN-XiaoxiaoNeural"
CANTONESE_VOICE = "zh-HK-HiuGaaiNeural"
RATE = "-8%"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "audio"
CURRICULUM_FILE = Path(__file__).resolve().parent.parent / "data" / "curriculum.js"

PROMPTS = {
    "pinyin_intro": "先认识三个拼音宝宝。听一听，也跟着说一遍吧。",
    "pinyin_a": "阿姨的阿。啊——，第一声。",
    "pinyin_o": "喔？喔？第二声。",
    "pinyin_yu": "小鱼的鱼。迂——，第二声。",
    "pinyin_q1": "请找阿姨的阿。啊——，第一声。",
    "pinyin_q2": "请找第二声的喔。喔？",
    "pinyin_q3": "请找小鱼的鱼。迂？第二声。",
    "pinyin_q4": "请找第一声的啊。啊——。",
    "pinyin_q5": "请找小鱼的鱼。迂？",
    "hanzi_intro": "先认识三个生活里的汉字。看一看，也读一遍吧。",
    "hanzi_ri": "日。太阳出来了。日。",
    "hanzi_yue": "月。月亮弯弯的。月。",
    "hanzi_shui": "水。我会喝水。水。",
    "hanzi_q1": "太阳。请找到，日。",
    "hanzi_q2": "月亮。请找到，月。",
    "hanzi_q3": "水滴。请找到，水。",
    "hanzi_q4": "小手。请找到，手。",
    "hanzi_q5": "高山。请找到，山。",
    "correct": "答对啦！真棒！",
    "try_again": "再听一次，慢慢找。",
    "practice_again": "再练一次，就记牢啦。",
    "finished": "完成啦！你得到五颗小星星。",
    "sound_on": "声音打开啦。",
}


def curriculum_prompts():
    script = "global.window={};require(process.argv[1]);process.stdout.write(JSON.stringify(window.CURRICULUM))"
    source = subprocess.check_output(["node", "-e", script, str(CURRICULUM_FILE)], text=True)
    data = json.loads(source)
    prompts = {}
    for track in data["tracks"]:
        index = 0
        for group in track["groups"]:
            for row in group["items"]:
                say = row[1] if track["id"] == "pinyin" else row[2]
                prompts[f"{track['id']}_{index}"] = say
                if track["id"] == "hanzi":
                    prompts[f"cantonese_{index}"] = f"{row[0]}。{row[1]}。{row[0]}。"
                index += 1
    return prompts


async def generate(name, text, semaphore):
    destination = OUTPUT_DIR / f"{name}.mp3"
    if destination.exists() and destination.stat().st_size > 1000:
        return
    async with semaphore:
        voice = CANTONESE_VOICE if name.startswith("cantonese_") else VOICE
        communicate = edge_tts.Communicate(text, voice, rate=RATE)
        await communicate.save(destination)
        print(destination.name, flush=True)


async def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    prompts = {**PROMPTS, **curriculum_prompts()}
    semaphore = asyncio.Semaphore(6)
    await asyncio.gather(*(generate(name, value, semaphore) for name, value in prompts.items()))


if __name__ == "__main__":
    asyncio.run(main())
