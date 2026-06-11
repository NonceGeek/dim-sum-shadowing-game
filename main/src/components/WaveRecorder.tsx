"use client";
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import WaveSurfer from "wavesurfer.js";
import { Tooltip, Progress } from "antd";
import { useQuestionStore } from "@/stores/questionStore";
import { calculateTextSimilarity } from "@/utils/textSimilarity";
import { IoPulseSharp } from "react-icons/io5";

const TRANS_API = `${process.env.NEXT_PUBLIC_API_URL}/api/transcribe`;
// 静音判定，终端两秒后没有声音则认为静音
const SILENCE_THRESHOLD = 8;
const SILENCE_DURATION_MS = 2000;


interface WaveRecorderProps {
  onRecordingComplete: (score: number, feedback: string, transcript: string, yueText: string) => void;
  onReset: any;
}

export interface WaveRecorderHandle {
  reset: () => void;
}

const WaveRecorder = forwardRef<WaveRecorderHandle, WaveRecorderProps>(
  ({ onRecordingComplete, onReset }, ref) => {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [playTime, setPlayTime] = useState(0);
  const { currentQuestion } = useQuestionStore();
  const { yueText } = currentQuestion || {};

  const mediaRecorderRef = useRef<MediaRecorder>(null);
  const wavesurferRef = useRef<any>(null);
  const waveformRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const animationRef = useRef<any>(null);
  const playProgressRef = useRef<any>(null);
  const recordingRef = useRef(false);
  const lastSoundAtRef = useRef(0);
  const hasSpeechRef = useRef(false);
  const skipTranscribeRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const pickRecorderMimeType = () => {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];
    return types.find((type) => MediaRecorder.isTypeSupported(type));
  };

  const TRANSCRIBE_PROGRESS_MS = 15_000;

  useEffect(() => {
    if (!transcribing) {
      setTranscribeProgress(0);
      return;
    }

    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed / TRANSCRIBE_PROGRESS_MS) * 100));
      setTranscribeProgress(pct);
      if (pct >= 100) clearInterval(interval);
    }, 100);

    return () => clearInterval(interval);
  }, [transcribing]);

  // 初始化wavesurfer
  useEffect(() => {
    if (WaveSurfer && waveformRef.current) {
      wavesurferRef.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#8ee085",
        progressColor: "#8b5cf6",
        cursorColor: "#333",
        barWidth: 5,
        barRadius: 3,
        barGap: 2,
        height: 16,
        normalize: true,
        interact: false,
      });

      wavesurferRef.current.on("audioprocess", (time: any) => {
        setPlayTime(Math.floor(time));
      });

      wavesurferRef.current.on("finish", () => {
        setPlaying(false);
      });

      if (audioUrl) {
        wavesurferRef.current.load(audioUrl);
      }
    }

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
      clearInterval(timerRef.current);
      cancelAnimationFrame(animationRef.current);
      clearInterval(playProgressRef.current);
    };
  }, [audioUrl]);

  const generateFeedback = (score: number): string => {
    // 生成简单反馈
    if (score > 0 && score < 41) return "注意发音差异，请再试一次( ´ ▽ ` )ﾉ";
    if (score > 40 && score < 61) return "发音不错，但还有提升空间ヾ(◍°∇°◍)ﾉﾞ";
    if (score > 60 && score < 81) return "发音良好，请继续保持😊";
    if (score > 80 && score < 91) return "发音非常好，接近完美😎";
    if (score > 90 && score < 101) return "太棒啦，发音完美无瑕😎";
    return "请重新录音";
  };

  // 将浏览器录制的音频（webm/opus）转换为 WAV（OpenAI 只接受 wav / mp3）
  const convertToWav = async (blob: Blob): Promise<Blob> => {
    const audioCtx = new AudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    await audioCtx.close();

    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const bitDepth = 16;
    const blockAlign = numChannels * (bitDepth / 8);
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;

    const wavBuffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(wavBuffer);
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    // RIFF header
    writeStr(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);         // PCM chunk size
    view.setUint16(20, 1, true);          // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeStr(36, "data");
    view.setUint32(40, dataSize, true);

    // Interleave channels as 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([wavBuffer], { type: "audio/wav" });
  };

  // 调用 /api/trans_cantonese 转录粤语音频
  const transcribeAudio = async (blob: Blob) => {
    setTranscribing(true);
    try {
      // OpenAI 通过 OpenRouter 只支持 wav / mp3，先转换
      const wavBlob = await convertToWav(blob);
      const file = new File([wavBlob], "recording.wav", { type: "audio/wav" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("language", "yue");
      formData.append("task", "transcribe");

      const res = await fetch(TRANS_API, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`转录请求失败: ${res.status}`);
      }

      const data = await res.json();
      const transcript: string = data.text ?? "";
      setTranscript(transcript);
      console.log("transcript", transcript);
      console.log("yueText", yueText);

      const finalScore = calculateTextSimilarity(transcript, yueText ?? "");
      const feedback = generateFeedback(finalScore);
      onRecordingComplete(finalScore, feedback, transcript, yueText);
    } catch (err) {
      console.error("转录失败:", err);
      onRecordingComplete(0, "系统错误", "", yueText ?? "");
    } finally {
      setTranscribing(false);
      clearInterval(timerRef.current);
      cancelAnimationFrame(animationRef.current);
    }
  };

  // 停止录音（静音超时或内部调用）
  const stopRecording = () => {
    if (!mediaRecorderRef.current || !recordingRef.current) return;

    recordingRef.current = false;
    setRecording(false);
    cancelAnimationFrame(animationRef.current);
    clearInterval(timerRef.current);
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;

    if (waveformRef.current) {
      waveformRef.current.style.boxShadow = "";
    }

    if (mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const resetState = () => {
    if (recordingRef.current) {
      skipTranscribeRef.current = true;
      stopRecording();
    }
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
    setTranscript("");
    setPlaying(false);
    setDuration(0);
    setAudioBlob(null);
    onReset?.();
  };

  useImperativeHandle(ref, () => ({ reset: resetState }));

  // 开始录音
  const startRecording = async () => {
    if (recordingRef.current || transcribing) return;

    // 评分完成后再次点击录制，先重置上一轮结果（含分数模块）
    resetState();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioChunks: Blob[] = [];
      const mimeType = pickRecorderMimeType();
      mediaRecorderRef.current = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        if (skipTranscribeRef.current) {
          skipTranscribeRef.current = false;
          return;
        }

        const blob = new Blob(audioChunks, {
          type: mimeType || mediaRecorderRef.current?.mimeType || "audio/webm",
        });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setAudioBlob(blob as any);

        await transcribeAudio(blob);
      };

      mediaRecorderRef.current.start();
      recordingRef.current = true;
      setRecording(true);
      lastSoundAtRef.current = Date.now();
      hasSpeechRef.current = false;

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      analyser.fftSize = 256;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const getVolume = (samples: Uint8Array) => {
        let sum = 0;
        for (let i = 0; i < samples.length; i++) {
          const v = samples[i] - 128;
          sum += v * v;
        }
        return Math.sqrt(sum / samples.length);
      };

      const drawWaveform = () => {
        if (!recordingRef.current) return;

        analyser.getByteTimeDomainData(dataArray);
        const volume = getVolume(dataArray);
        const now = Date.now();

        if (volume > SILENCE_THRESHOLD) {
          hasSpeechRef.current = true;
          lastSoundAtRef.current = now;
        } else if (
          hasSpeechRef.current &&
          now - lastSoundAtRef.current >= SILENCE_DURATION_MS
        ) {
          stopRecording();
          return;
        }

        if (waveformRef.current) {
          const level = Math.min(48, Math.round(volume * 2));
          waveformRef.current.style.boxShadow = `inset 0 -${level}px 0 rgba(142, 224, 133, 0.45)`;
        }

        animationRef.current = requestAnimationFrame(drawWaveform);
      };

      drawWaveform();
    } catch (err) {
      recordingRef.current = false;
      setRecording(false);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      console.error("录音启动失败:", err);

      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        alert("无法访问麦克风，请检查权限设置");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        alert("未找到麦克风设备");
      } else {
        const message = err instanceof Error ? err.message : String(err);
        alert(`录音启动失败：${message}`);
      }
    }
  };

  // 播放/暂停录音
  const togglePlayback = () => {
    if (!audioUrl || !wavesurferRef.current) return;

    if (playing) {
      wavesurferRef.current.pause();
    } else {
      wavesurferRef.current.play();
    }

    setPlaying(!playing);
  };

  return (
    <>
      <div className="flex items-center">
        {/* 录音控制面板 */}
        <div className="flex flex-col">
          <div className="flex space-x-4">
            <Tooltip
              title={
                transcribing ? "识别中…" : recording ? "录音中，停止后将自动识别" : "点击录制"
              }
              color={"lime"}
              key={"lime"}
              placement="bottom"
              defaultOpen={true}
            >
              <button
                onClick={startRecording}
                disabled={recording || transcribing}
                className={`px-3 py-2 rounded-full font-bold text-lg duration-300 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {recording ? (
                  <div className="flex items-center">
                    <div className="border text-green-200 rounded-full p-1 text-xl animate-pulse">
                      <IoPulseSharp />
                    </div>
                  </div>
                ) : (
                  <div className={`border rounded-full p-1 text-xl ${transcribing ? "text-yellow-400 animate-pulse" : "text-grey-200"}`}>
                    <IoPulseSharp />
                  </div>
                )}
              </button>
            </Tooltip>
          </div>
        </div>

        {/* 波形显示区域 */}
        <div className="min-w-4/5">
          <div
            onClick={togglePlayback}
            ref={waveformRef}
            className="border border-indigo-500/30 rounded-xl p-2 min-h-[10px]"
            style={{ backgroundColor: recording ? "#fff" : "#ceffce" }}
          ></div>
        </div>
      </div>
      {transcribing && (
        <div className="mt-3 px-4">
          <p className="mb-2 text-center text-sm text-green-200">AI 判定中……</p>
          <Progress
            percent={transcribeProgress}
            showInfo={false}
            strokeColor="#8ee085"
            trailColor="rgba(255,255,255,0.1)"
          />
        </div>
      )}
      {/* 音频识别结果 */}
      {transcript && (
        <p className="mt-2 text-base text-white text-center">
          录音识别结果：<b>{transcript}</b>
        </p>
      )}
      {audioUrl && (
        <div className="mt-3 flex justify-center gap-3">
          <a
            href={audioUrl}
            download="recording.wav"
            className="px-4 py-1.5 rounded-full border border-white text-white text-sm hover:bg-white hover:text-neutral-800 transition-colors duration-200"
          >
            下载录音
          </a>
          <button
            onClick={resetState}
            className="px-4 py-1.5 rounded-full border border-white text-white text-sm hover:bg-white hover:text-neutral-800 transition-colors duration-200"
          >
            我要重新录制！
          </button>
        </div>
      )}
    </>
  );
});

WaveRecorder.displayName = "WaveRecorder";

export default WaveRecorder;
