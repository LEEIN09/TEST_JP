import { useEffect, useRef, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import type { KanaId } from "./content";

let currentAudio: HTMLAudioElement | null = null;

export function stopAudio() {
  currentAudio?.pause();
  currentAudio = null;
}

export function AudioButton({ id, glyph }: { id: KanaId; glyph: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "playing" | "error"
  >("idle");

  useEffect(() => {
    const audio = new Audio(`${import.meta.env.BASE_URL}audio/${id}.mp3`);
    audio.preload = "none";
    audioRef.current = audio;
    const idle = () => setStatus("idle");
    const playing = () => setStatus("playing");
    const failed = () => setStatus("error");
    const hidden = () => {
      if (document.hidden) audio.pause();
    };
    audio.addEventListener("playing", playing);
    audio.addEventListener("ended", idle);
    audio.addEventListener("pause", idle);
    audio.addEventListener("error", failed);
    document.addEventListener("visibilitychange", hidden);
    setStatus("idle");
    return () => {
      audio.removeEventListener("playing", playing);
      audio.removeEventListener("ended", idle);
      audio.removeEventListener("pause", idle);
      audio.removeEventListener("error", failed);
      document.removeEventListener("visibilitychange", hidden);
      audio.pause();
      if (currentAudio === audio) currentAudio = null;
      audioRef.current = null;
    };
  }, [id]);

  async function play() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused || status === "loading") {
      stopAudio();
      setStatus("idle");
      return;
    }
    stopAudio();
    currentAudio = audio;
    audio.currentTime = 0;
    setStatus("loading");
    try {
      await audio.play();
    } catch {
      // Ignore a play promise cancelled by navigation or another audio button.
      if (audioRef.current === audio && currentAudio === audio)
        setStatus("error");
    }
  }

  return (
    <div className="audio-control">
      <button
        type="button"
        className="audio-button"
        onClick={play}
        aria-label={`${glyph} 발음 ${status === "playing" || status === "loading" ? "멈추기" : "듣기"}`}
      >
        {status === "playing" ? <Square size={14} /> : <Volume2 size={17} />}
        {status === "loading"
          ? "소리 준비 중"
          : status === "playing"
            ? "발음 멈추기"
            : status === "error"
              ? "다시 듣기"
              : "발음 듣기"}
      </button>
      {status === "error" && (
        <span role="status" className="audio-error">
          소리를 재생하지 못했어요. 다시 눌러 주세요.
        </span>
      )}
    </div>
  );
}
