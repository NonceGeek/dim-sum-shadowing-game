// "use client";
// // 录音组件示例
// import { useState, useRef } from "react";

// export default function Recorder() {
//   const [isRecording, setIsRecording] = useState(false);
//   const [audioURL, setAudioURL] = useState("");
//   const mediaRecorderRef = useRef<MediaRecorder>(null);
//   const audioChunksRef = useRef<Blob[]>([]);

//   const startRecording = async () => {
//     const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//     mediaRecorderRef.current = new MediaRecorder(stream);

//     mediaRecorderRef.current.ondataavailable = (e: any) => {
//       audioChunksRef.current.push(e?.data);
//     };

//     mediaRecorderRef.current.onstop = () => {
//       const audioBlob = new Blob(audioChunksRef.current);
//       const audioUrl = URL.createObjectURL(audioBlob);
//       setAudioURL(audioUrl);
//       audioChunksRef.current = [];
//     };

//     mediaRecorderRef.current.start();
//     setIsRecording(true);
//   };

//   const stopRecording = () => {
//     mediaRecorderRef.current?.stop();
//     setIsRecording(false);
//   };

//   return (
//     <div>
//       <button onClick={isRecording ? stopRecording : startRecording}>
//         {isRecording ? "停止录音" : "开始录音"}
//       </button>
//       {audioURL && <audio src={audioURL} muted={false} />}
//     </div>
//   );
// }
