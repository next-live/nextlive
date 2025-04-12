import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IconButton, Paper } from '@mui/material';
import { Mic as MicIcon, Upload as UploadIcon, ScreenShare as ScreenShareIcon } from '@mui/icons-material';
import { GeminiWebSocket } from '@/nextlive/services/gemini/live/geminiLive';
import { Base64 } from 'js-base64';

interface GeminiVoiceChatProps {
  onVoiceStart?: () => void;
  onVoiceEnd?: () => void;
  apiKey: string;
}

const GeminiVoiceChat: React.FC<GeminiVoiceChatProps> = ({ onVoiceStart, onVoiceEnd }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [isWebSocketReady, setIsWebSocketReady] = useState(false);
  const [isAudioSetup, setIsAudioSetup] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const dragRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const setupInProgressRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const geminiWsRef = useRef<GeminiWebSocket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const screenCanvasRef = useRef<HTMLCanvasElement>(null);
  const screenIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    startPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || typeof window === 'undefined') return;

    const newX = e.clientX - startPos.current.x;
    const newY = e.clientY - startPos.current.y;

    const maxX = window.innerWidth - 56;
    const maxY = window.innerHeight - 56;
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const cleanupAudio = useCallback(() => {
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const cleanupWebSocket = useCallback(() => {
    if (geminiWsRef.current) {
      geminiWsRef.current.disconnect();
      geminiWsRef.current = null;
    }
  }, []);

  const sendAudioData = useCallback((b64Data: string) => {
    if (!geminiWsRef.current) return;
    geminiWsRef.current.sendMediaChunk(b64Data, "audio/pcm");
  }, []);

  const startAudioRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true,
        }
      });

      mediaStreamRef.current = stream;
      audioContextRef.current = new AudioContext({
        sampleRate: 16000,
      });

      setIsRecording(true);
      onVoiceStart?.();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      cleanupAudio();
    }
  }, [cleanupAudio, onVoiceStart]);

  const stopAudioRecording = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    cleanupAudio();
    setIsRecording(false);
    onVoiceEnd?.();
  }, [cleanupAudio, onVoiceEnd]);

  const handleMicClick = useCallback(async () => {
    if (!isRecording) {
      await startAudioRecording();
    } else {
      stopAudioRecording();
    }
  }, [isRecording, startAudioRecording, stopAudioRecording]);

  useEffect(() => {
    if (isRecording) {
      startAudioRecording();
    }
    return () => {
      if (isRecording) {
        stopAudioRecording();
      }
    };
  }, [isRecording, startAudioRecording, stopAudioRecording]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!isRecording) {
      cleanupWebSocket();
      return;
    }

    geminiWsRef.current = new GeminiWebSocket(
      (text) => {
        console.log('Received response:', text);
      },
      () => {
        console.log('Setup complete');
        setIsWebSocketReady(true);
      },
      setIsModelSpeaking,
      setAudioLevel,
      (text) => {
        console.log('Transcription:', text);
      }
    );

    geminiWsRef.current.connect();

    return () => {
      cleanupWebSocket();
      setIsWebSocketReady(false);
    };
  }, [isRecording, cleanupWebSocket]);

  // Update audio processing setup
  useEffect(() => {
    if (!isRecording || !mediaStreamRef.current || !audioContextRef.current || 
        !isWebSocketReady || isAudioSetup || setupInProgressRef.current) return;

    let isActive = true;
    setupInProgressRef.current = true;

    const setupAudioProcessing = async () => {
      try {
        const ctx = audioContextRef.current;
        if (!ctx || ctx.state === 'closed' || !isActive) {
          setupInProgressRef.current = false;
          return;
        }

        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        await ctx.audioWorklet.addModule('/worklets/audio-processor.js');

        if (!isActive) {
          setupInProgressRef.current = false;
          return;
        }

        audioWorkletNodeRef.current = new AudioWorkletNode(ctx, 'audio-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          processorOptions: {
            sampleRate: 16000,
            bufferSize: 4096,
          },
          channelCount: 1,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers'
        });

        if (!mediaStreamRef.current) {
          setupInProgressRef.current = false;
          return;
        }

        const source = ctx.createMediaStreamSource(mediaStreamRef.current);
        
        // Monitor audio track state
        const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.onended = async () => {
            console.log('Audio track ended, attempting to restart...');
            try {
              const newStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                  sampleRate: 16000,
                  channelCount: 1,
                  echoCancellation: true,
                  autoGainControl: true,
                  noiseSuppression: true,
                }
              });
              mediaStreamRef.current = newStream;
              await startAudioRecording();
            } catch (error) {
              console.error('Failed to restart audio:', error);
            }
          };
        }

        audioWorkletNodeRef.current.port.onmessage = (event) => {
          if (!isActive || isModelSpeaking) return;
          const { pcmData, level } = event.data;
          setAudioLevel(level);

          const pcmArray = new Uint8Array(pcmData);
          const b64Data = Base64.fromUint8Array(pcmArray);
          sendAudioData(b64Data);
        };

        source.connect(audioWorkletNodeRef.current);
        setIsAudioSetup(true);
        setupInProgressRef.current = false;

        // Monitor audio context state
        const checkAudioContext = setInterval(() => {
          if (ctx.state === 'suspended') {
            console.log('Audio context suspended, attempting to resume...');
            ctx.resume();
          }
        }, 1000);

        return () => {
          clearInterval(checkAudioContext);
          source.disconnect();
          if (audioWorkletNodeRef.current) {
            audioWorkletNodeRef.current.disconnect();
          }
          setIsAudioSetup(false);
        };
      } catch (error) {
        console.error('Error in audio processing setup:', error);
        if (isActive) {
          cleanupAudio();
          setIsAudioSetup(false);
        }
        setupInProgressRef.current = false;
      }
    };

    setupAudioProcessing();

    return () => {
      isActive = false;
      setIsAudioSetup(false);
      setupInProgressRef.current = false;
      if (audioWorkletNodeRef.current) {
        audioWorkletNodeRef.current.disconnect();
        audioWorkletNodeRef.current = null;
      }
    };
  }, [isRecording, isWebSocketReady, isModelSpeaking, cleanupAudio]);

  const startScreenSharing = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 5, // Capture at 5fps
          width: { max: 1280 },
          height: { max: 720 }
        }
      });

      setScreenStream(stream);
      setIsScreenSharing(true);

      // Create canvas for capturing frames
      const canvas = document.createElement('canvas');
      screenCanvasRef.current = canvas;
      const context = canvas.getContext('2d');
      if (!context) return;

      // Set up video element for screen capture
      const video = document.createElement('video');
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Start capturing frames
        screenIntervalRef.current = setInterval(() => {
          if (!context || !video || !geminiWsRef.current) return;
          
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = canvas.toDataURL('image/jpeg', 0.8);
          const b64Data = imageData.split(',')[1];
          geminiWsRef.current.sendMediaChunk(b64Data, "image/jpeg");
        }, 200); // Capture every 200ms (5fps)
      };

      // Handle screen sharing stop
      stream.getVideoTracks()[0].onended = () => {
        stopScreenSharing();
      };
    } catch (error) {
      console.error('Error starting screen sharing:', error);
      stopScreenSharing();
    }
  };

  const stopScreenSharing = () => {
    if (screenIntervalRef.current) {
      clearInterval(screenIntervalRef.current);
      screenIntervalRef.current = null;
    }
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
    setIsScreenSharing(false);
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenSharing();
    } else {
      await startScreenSharing();
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPosition({ 
        x: window.innerWidth - 100, 
        y: window.innerHeight - 100 
      });
    }
  }, []);

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="audio/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file || !geminiWsRef.current) return;

          const reader = new FileReader();
          reader.onloadend = () => {
            const base64Data = reader.result as string;
            const base64WithoutPrefix = base64Data.split(',')[1];
            geminiWsRef.current?.sendMediaChunk(base64WithoutPrefix, file.type);
          };
          reader.readAsDataURL(file);
        }}
      />
      <Paper
        ref={dragRef}
        elevation={0}
        sx={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          cursor: isDragging ? 'grabbing' : 'grab',
          backgroundColor: 'transparent',
          width: isRecording || isScreenSharing ? '200px' : '56px',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: 'scale(1)',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            padding: '1px',
            borderRadius: '28px',
            background: 'linear-gradient(60deg, rgba(76, 175, 80, 0.3), rgba(33, 150, 243, 0.3), rgba(156, 39, 176, 0.3))',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            pointerEvents: 'none',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          },
          boxShadow: `
            0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -1px rgba(0, 0, 0, 0.06),
            0 0 0 1px rgba(0, 0, 0, 0.05),
            0 1px 20px 10px rgba(76, 175, 80, 0.05),
            0 1px 30px 15px rgba(33, 150, 243, 0.03)
          `,
          '&:hover': {
            transform: 'scale(1.1)',
          },
        }}
        onMouseDown={handleMouseDown}
      >
        <div style={{ 
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          height: '56px',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <IconButton
            size="large"
            onClick={handleMicClick}
            sx={{
              backgroundColor: isRecording ? '#ff4444' : 'white',
              color: isRecording ? 'white' : '#1a73e8',
              '&:hover': {
                backgroundColor: isRecording ? '#ff6666' : '#f0f3f4',
              },
              width: 56,
              height: 56,
              position: 'relative',
              zIndex: 1,
            }}
          >
            <MicIcon />
          </IconButton>
          {(isRecording || isScreenSharing) && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '2px',
                margin: '0 8px',
              }}
            >
              {Array.from({ length: 20 }).map((_, index) => (
                <div
                  key={index}
                  style={{
                    width: '2px',
                    height: `${(audioLevel / 100) * 40}px`,
                    backgroundColor: isRecording ? '#ff4444' : '#1a73e8',
                    borderRadius: '1px',
                    transition: 'height 0.1s ease-out',
                  }}
                />
              ))}
            </div>
          )}
          <IconButton
            size="small"
            onClick={toggleScreenShare}
            sx={{
              backgroundColor: isScreenSharing ? '#ff4444' : 'white',
              color: isScreenSharing ? 'white' : '#1a73e8',
              '&:hover': {
                backgroundColor: isScreenSharing ? '#ff6666' : '#f0f3f4',
              },
              marginLeft: '4px',
            }}
          >
            <ScreenShareIcon />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => fileInputRef.current?.click()}
            sx={{
              backgroundColor: 'white',
              color: '#1a73e8',
              '&:hover': {
                backgroundColor: '#f0f3f4',
              },
              marginLeft: '4px',
            }}
          >
            <UploadIcon />
          </IconButton>
        </div>
      </Paper>
    </>
  );
};

export default GeminiVoiceChat;

