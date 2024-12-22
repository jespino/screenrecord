import { useState, useRef, useEffect } from 'react';
import RecordRTC from 'recordrtc';

const ScreenRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const recorderRef = useRef<RecordRTC | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const selectWindow = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      
      setSelectedWindow(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(e => console.error('Error playing video:', e));
      }
    } catch (err) {
      console.error('Error selecting window:', err);
    }
  };

  const startRecording = async () => {
    if (!selectedWindow) {
      alert('Please select a window first');
      return;
    }
    try {
      // Use the selected window stream
      const screenStream = selectedWindow;

      // Get microphone stream
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });

      // Combine the streams
      const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...screenStream.getAudioTracks(),
        ...micStream.getAudioTracks()
      ]);

      recorderRef.current = new RecordRTC(combinedStream, {
        type: 'video',
        mimeType: 'video/webm'
      });

      recorderRef.current.startRecording();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing screen:', err);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.stopRecording(() => {
        const blob = recorderRef.current?.getBlob();
        if (blob) {
          setRecordedBlob(blob);
          // Stop all tracks
          // Stop all tracks from both screen and microphone
          const stream = recorderRef.current.getInternalRecorder().stream;
          stream.getTracks().forEach(track => {
            track.stop();
          });
        }
      });
      setIsRecording(false);
    }
  };

  const downloadRecording = () => {
    if (recordedBlob) {
      const url = URL.createObjectURL(recordedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `screen-recording-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="screen-recorder">
      <h2>Screen & Microphone Recorder</h2>
      <p>Records both your screen and microphone audio</p>
      
      <div className="window-preview">
        <button onClick={selectWindow}>Select Window</button>
        {selectedWindow && (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="preview-video"
            />
          </>
        )}
      </div>

      <div className="controls">
        {!isRecording ? (
          <button onClick={startRecording}>Start Recording</button>
        ) : (
          <button onClick={stopRecording}>Stop Recording</button>
        )}
        {recordedBlob && (
          <button onClick={downloadRecording}>Download Recording</button>
        )}
      </div>
    </div>
  );
};

export default ScreenRecorder;
