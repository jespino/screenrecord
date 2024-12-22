import { useState, useRef, useEffect, MouseEvent } from 'react';
import RecordRTC from 'recordrtc';

const ScreenRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const recorderRef = useRef<RecordRTC | null>(null);
  const [selectedWindow, setSelectedWindow] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isSelectingRegion, setIsSelectingRegion] = useState(false);
  const [regionStart, setRegionStart] = useState<{ x: number; y: number } | null>(null);
  const [regionEnd, setRegionEnd] = useState<{ x: number; y: number } | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const selectRegion = () => {
    setIsSelectingRegion(true);
    setSelectedRegion(null);
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (!isSelectingRegion || !videoRef.current) return;

    const rect = videoRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRegionStart({ x, y });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isSelectingRegion || !regionStart || !videoRef.current) return;

    const rect = videoRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRegionEnd({ x, y });
  };

  const handleMouseUp = () => {
    if (!isSelectingRegion || !regionStart || !regionEnd) return;

    const x = Math.min(regionStart.x, regionEnd.x);
    const y = Math.min(regionStart.y, regionEnd.y);
    const width = Math.abs(regionEnd.x - regionStart.x);
    const height = Math.abs(regionEnd.y - regionStart.y);

    setSelectedRegion({ x, y, width, height });
    setIsSelectingRegion(false);
    setRegionStart(null);
    setRegionEnd(null);
  };

  const selectWindow = async () => {
    try {
      // Stop any existing stream
      if (selectedWindow) {
        selectedWindow.getTracks().forEach(track => track.stop());
      }
      
      // Reset video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'window',
        },
        audio: false
      });
      
      // Ensure video element is ready
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
          } catch (e) {
            console.error('Error playing video:', e);
          }
        };
      }
      
      setSelectedWindow(stream);
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
      let screenStream = selectedWindow;
      
      // If region is selected, create a canvas to crop the video
      if (selectedRegion && videoRef.current) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = selectedRegion.width;
        canvas.height = selectedRegion.height;
        
        // Create a stream from the canvas
        const canvasStream = canvas.captureStream();
        
        // Update canvas with cropped video frame
        const drawFrame = () => {
          if (ctx && videoRef.current) {
            ctx.drawImage(
              videoRef.current,
              selectedRegion.x,
              selectedRegion.y,
              selectedRegion.width,
              selectedRegion.height,
              0,
              0,
              canvas.width,
              canvas.height
            );
          }
          requestAnimationFrame(drawFrame);
        };
        
        drawFrame();
        screenStream = canvasStream;
      }

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
          // Stop all tracks from both screen and microphone
          const internalRecorder = recorderRef.current.getInternalRecorder();
          if (internalRecorder && internalRecorder.stream) {
            internalRecorder.stream.getTracks().forEach(track => {
              track.stop();
            });
          }
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
        <div>
          <button onClick={selectWindow}>Select Window</button>
          <button onClick={selectRegion} disabled={!selectedWindow}>
            Select Region
          </button>
        </div>
        {selectedWindow && (
          <>
            <div className="video-container"
                 onMouseDown={handleMouseDown}
                 onMouseMove={handleMouseMove}
                 onMouseUp={handleMouseUp}
                 onMouseLeave={handleMouseUp}>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="preview-video"
              />
              {(isSelectingRegion && regionStart && regionEnd) && (
                <div 
                  className="region-selector"
                  style={{
                    left: Math.min(regionStart.x, regionEnd.x) + 'px',
                    top: Math.min(regionStart.y, regionEnd.y) + 'px',
                    width: Math.abs(regionEnd.x - regionStart.x) + 'px',
                    height: Math.abs(regionEnd.y - regionStart.y) + 'px'
                  }}
                />
              )}
              {selectedRegion && (
                <div 
                  className="region-selector"
                  style={{
                    left: selectedRegion.x + 'px',
                    top: selectedRegion.y + 'px',
                    width: selectedRegion.width + 'px',
                    height: selectedRegion.height + 'px'
                  }}
                />
              )}
            </div>
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
