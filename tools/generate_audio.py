"""Regenerate bundled Japanese pronunciation samples from src/curriculum.json.

Optional build tools (not needed to install or run the web app):
  python3 -m venv /tmp/haru-audio-venv
  /tmp/haru-audio-venv/bin/pip install pyopenjtalk-plus==0.4.1.post10 numpy==2.5.4
  /tmp/haru-audio-venv/bin/python tools/generate_audio.py
Requires ffmpeg with libmp3lame. See public/audio/NOTICE.txt for attribution.
"""

import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import wave

import numpy as np
import pyopenjtalk

output = Path(__file__).resolve().parents[1] / "public" / "audio"
curriculum = json.loads((output.parents[1] / "src" / "curriculum.json").read_text())
output.mkdir(parents=True, exist_ok=True)
manifest = {}
with tempfile.TemporaryDirectory(prefix="haru-audio-") as temporary:
    for name, card in curriculum.items():
        glyph = card["glyph"]
        phonemes = pyopenjtalk.g2p(glyph).strip()
        if phonemes != card["phonemes"]:
            raise ValueError(f"Unexpected phoneme for {glyph}: {phonemes}")
        samples, rate = pyopenjtalk.tts(glyph + "。", speed=0.8)
        peak = max(abs(samples))
        pcm = np.clip(samples / max(peak, 1) * 24575, -32768, 32767).astype("<i2")
        wav_path = Path(temporary) / f"{name}.wav"
        with wave.open(str(wav_path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(rate)
            wav.writeframes(pcm.tobytes())
        mp3 = output / f"{name}.mp3"
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-i", str(wav_path), "-codec:a", "libmp3lame", "-b:a", "96k", str(mp3),
        ], check=True)
        manifest[name] = {"glyph": glyph, "phoneme": phonemes,
                          "sha256": hashlib.sha256(mp3.read_bytes()).hexdigest()}
(output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
