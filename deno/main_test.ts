import { assertEquals } from "@std/assert";
import { inferAudioFormat, sttLanguageHint } from "./audio_utils.ts";

Deno.test("inferAudioFormat from extension", () => {
  assertEquals(inferAudioFormat("recording.wav", ""), "wav");
  assertEquals(inferAudioFormat("recording.m4a", ""), "m4a");
});

Deno.test("inferAudioFormat from mime type", () => {
  assertEquals(inferAudioFormat("audio", "audio/wav"), "wav");
  assertEquals(inferAudioFormat("audio", "audio/webm"), "webm");
});

Deno.test("sttLanguageHint maps Cantonese to zh", () => {
  assertEquals(sttLanguageHint("yue"), "zh");
  assertEquals(sttLanguageHint("zh-yue"), "zh");
  assertEquals(sttLanguageHint("auto"), undefined);
});
