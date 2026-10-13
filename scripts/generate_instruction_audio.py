"""Optional asset rebuild: pip install edge-tts==7.2.7 av==16.1.0 numpy.

Only fixed public UI instructions go to the speech service. The application
plays the resulting files locally; this script is not a runtime dependency.
"""
import asyncio
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import av
import edge_tts
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "frontend/src/assets/voice"
PHRASES = {
    "welcome_hi": ("अपनी भाषा चुनें।", "hi-IN", "hi-IN-SwaraNeural"),
    "welcome_en": ("Choose your preferred language.", "en-IN", "en-IN-NeerjaNeural"),
    "method_hi": (
        "आप अपनी परेशानी कैसे बताना चाहते हैं? बोलकर, लिखकर, या विकल्पों को चुनकर।",
        "hi-IN", "hi-IN-SwaraNeural",
    ),
    "method_en": (
        "How would you like to tell us about your problem? Via voice, via text, or checkboxes.",
        "en-IN", "en-IN-NeerjaNeural",
    ),
}


def decode(path):
    with av.open(str(path)) as source:
        return np.concatenate([frame.to_ndarray() for frame in source.decode(audio=0)], axis=1)


def encode(path, samples):
    with av.open(str(path), "w") as target:
        stream = target.add_stream("libmp3lame", rate=24000)
        stream.layout = "mono"
        stream.bit_rate = 96000
        frame = av.AudioFrame.from_ndarray(samples, format="fltp", layout="mono")
        frame.sample_rate = 24000
        for packet in stream.encode(frame):
            target.mux(packet)
        for packet in stream.encode(None):
            target.mux(packet)


async def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    clips = {}
    with TemporaryDirectory() as scratch:
        for key, (text, language, voice) in PHRASES.items():
            path = Path(scratch) / f"{key}.mp3"
            boundaries = []
            communication = edge_tts.Communicate(
                text, voice, rate="-10%", pitch="-2Hz", boundary="WordBoundary",
            )
            with path.open("wb") as output:
                async for chunk in communication.stream():
                    if chunk["type"] == "audio":
                        output.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        boundaries.append({"text": chunk["text"], "at": chunk["offset"] / 10_000_000})
            # Preserve display punctuation; Edge boundaries omit it.
            words = text.split()
            if len(words) != len(boundaries):
                raise ValueError(f"Word alignment must be reviewed: {key}: {words} / {boundaries}")
            for word, boundary in zip(words, boundaries):
                boundary["text"] = word
            clips[key] = {"samples": decode(path), "line": {
                "text": text, "language": language, "voice": voice, "words": boundaries,
            }}

        manifest = {}
        for key, parts in {"welcome": ["welcome_hi", "welcome_en"],
                           "method_hi": ["method_hi"], "method_en": ["method_en"]}.items():
            samples = np.empty((1, 0), dtype=np.float32)
            lines = []
            for index, part in enumerate(parts):
                if index:
                    samples = np.concatenate([samples, np.zeros((1, 8400), dtype=np.float32)], axis=1)
                offset = samples.shape[1] / 24000
                line = clips[part]["line"]
                lines.append({**line, "words": [{**w, "at": round(w["at"] + offset, 3)} for w in line["words"]]})
                samples = np.concatenate([samples, clips[part]["samples"]], axis=1)
            path = ASSETS / f"{key}.mp3"
            encode(path, samples)
            with av.open(str(path)) as audio:
                duration = audio.duration / av.time_base
            manifest[key] = {"lines": lines, "duration": duration,
                             "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
            print(f"Generated {key}: {duration:.2f}s", flush=True)
        (ASSETS / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    asyncio.run(main())
