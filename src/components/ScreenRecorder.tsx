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
    scaleX: number;
    scaleY: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);


  const handleMouseDown = (e: MouseEvent) => {
    if (!isSelectingRegion || !videoRef.current) return;

    const rect = videoRef.current.getBoundingClientRect();
    // Constrain coordinates within preview bounds
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    setRegionStart({ x, y });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!videoRef.current) return;
    
    const rect = videoRef.current.getBoundingClientRect();

    if (isSelectingRegion && regionStart) {
      // Handle region selection
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
      setRegionEnd({ x, y });
    } else if (isDragging && dragStart && selectedRegion) {
      // Handle region dragging
      const newX = Math.max(0, Math.min(e.clientX - dragStart.x - rect.left, rect.width - selectedRegion.width));
      const newY = Math.max(0, Math.min(e.clientY - dragStart.y - rect.top, rect.height - selectedRegion.height));
      
      setSelectedRegion({
        ...selectedRegion,
        x: newX,
        y: newY
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
    if (!isSelectingRegion || !regionStart || !regionEnd || !videoRef.current || !selectedWindow) return;

    const videoElement = videoRef.current;
    const stream = selectedWindow;
    const videoTrack = stream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    
    // Calculate scale factors between preview and actual window size
    const scaleX = settings.width! / videoElement.clientWidth;
    const scaleY = settings.height! / videoElement.clientHeight;

    const x = Math.min(regionStart.x, regionEnd.x);
    const y = Math.min(regionStart.y, regionEnd.y);
    const width = Math.abs(regionEnd.x - regionStart.x);
    const height = Math.abs(regionEnd.y - regionStart.y);

    setSelectedRegion({ x, y, width, height, scaleX, scaleY });
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
        
        // Set canvas size to match the selected region's actual size
        canvas.width = selectedRegion.width * selectedRegion.scaleX;
        canvas.height = selectedRegion.height * selectedRegion.scaleY;
        
        // Create a stream from the canvas with proper FPS
        const canvasStream = canvas.captureStream(30); // 30 FPS
        
        // Update canvas with cropped video frame
        const drawFrame = () => {
          if (ctx && videoRef.current) {
            ctx.drawImage(
              videoRef.current,
              selectedRegion.x * selectedRegion.scaleX,
              selectedRegion.y * selectedRegion.scaleY,
              selectedRegion.width * selectedRegion.scaleX,
              selectedRegion.height * selectedRegion.scaleY,
              0,
              0,
              canvas.width,
              canvas.height
            );
            requestAnimationFrame(drawFrame);
          }
        };
        
        drawFrame();
        
        // Only use the video track from canvas stream
        screenStream = new MediaStream([canvasStream.getVideoTracks()[0]]);
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
          <button 
            onClick={() => {
              if (!videoRef.current) return;
              const rect = videoRef.current.getBoundingClientRect();
              setIsSelectingRegion(!isSelectingRegion);
              if (!isSelectingRegion) {
                setRegionStart({ x: 0, y: 0 });
                setRegionEnd({ x: rect.width, y: rect.height });
              }
            }} 
            disabled={!selectedWindow}
            className={isSelectingRegion ? 'active' : ''}
          >
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
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) {
                      e.stopPropagation();
                      setIsDragging(true);
                      setDragStart({ 
                        x: e.clientX - selectedRegion.x, 
                        y: e.clientY - selectedRegion.y 
                      });
                    }
                  }}
                >
                  <div 
                    className="resize-handle top-left"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setRegionStart({ x: selectedRegion.x + selectedRegion.width, y: selectedRegion.y + selectedRegion.height });
                      setRegionEnd({ x: selectedRegion.x, y: selectedRegion.y });
                      setIsSelectingRegion(true);
                    }}
                  />
                  <div 
                    className="resize-handle top-right"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setRegionStart({ x: selectedRegion.x, y: selectedRegion.y + selectedRegion.height });
                      setRegionEnd({ x: selectedRegion.x + selectedRegion.width, y: selectedRegion.y });
                      setIsSelectingRegion(true);
                    }}
                  />
                  <div 
                    className="resize-handle bottom-left"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setRegionStart({ x: selectedRegion.x + selectedRegion.width, y: selectedRegion.y });
                      setRegionEnd({ x: selectedRegion.x, y: selectedRegion.y + selectedRegion.height });
                      setIsSelectingRegion(true);
                    }}
                  />
                  <div 
                    className="resize-handle bottom-right"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setRegionStart({ x: selectedRegion.x, y: selectedRegion.y });
                      setRegionEnd({ x: selectedRegion.x + selectedRegion.width, y: selectedRegion.y + selectedRegion.height });
                      setIsSelectingRegion(true);
                    }}
                  />
                </div>
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
