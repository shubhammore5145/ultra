import { useEffect, useState, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import Tesseract from 'tesseract.js';
import { X, Camera, CheckCircle2, Loader2, Zap, ZapOff, Sparkles, BrainCircuit, Keyboard, ZoomIn, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface CameraScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export function CameraScanner({ onScan, onClose }: CameraScannerProps) {
  const [error, setError] = useState<string>('');
  const [scanSuccess, setScanSuccess] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [usingNative, setUsingNative] = useState(false);
  
  // Camera Selection State
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(localStorage.getItem('preferredCameraId'));
  
  // OCR States
  const [isOCRProcessing, setIsOCRProcessing] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');

  // Manual entry state
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');

  // Scan attempt counter for UI feedback
  const [scanAttempts, setScanAttempts] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas2Ref = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number>(0);
  const isMounted = useRef(true);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // Use refs to track state inside async loops
  const scanSuccessRef = useRef(false);
  const isOCRProcessingRef = useRef(false);
  const onScanRef = useRef(onScan);

  useEffect(() => { onScanRef.current = onScan; }, [onScan]);
  useEffect(() => { scanSuccessRef.current = scanSuccess; }, [scanSuccess]);
  useEffect(() => { isOCRProcessingRef.current = isOCRProcessing; }, [isOCRProcessing]);

  const stopScanner = useCallback(() => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        // Turn off torch if leaving
        if (hasTorch && torchOn) {
          try { track.applyConstraints({ advanced: [{ torch: false }] }); } catch(e) {}
        }
        track.stop();
      });
    }
  }, [hasTorch, torchOn]);

  const playBeep = () => {
    try {
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = 800;
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      console.warn("Audio Context blocked:", e);
    }
  };

  // ============ IMAGE PROCESSING PIPELINE ============

  /** Crop center scanning area (simulates laser scanner zone) */
  const cropCenterScanner = (video: HTMLVideoElement, canvas: HTMLCanvasElement): boolean => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    
    // We only care about the center 70% width and 30% height (the red box area)
    const cw = vw * 0.7;
    const ch = vh * 0.3;
    const cx = (vw - cw) / 2;
    const cy = (vh - ch) / 2;
    
    canvas.width = cw;
    canvas.height = ch;
    
    ctx.drawImage(video, cx, cy, cw, ch, 0, 0, cw, ch);
    return true;
  };

  // Manual entry submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualBarcode.trim();
    if (code.length >= 4) {
      playBeep();
      setScanSuccess(true);
      scanSuccessRef.current = true;
      setTimeout(() => {
        if (isMounted.current) onScanRef.current(code);
      }, 500);
    }
  };

  // Double Validation State
  const lastScannedCodeRef = useRef<string | null>(null);
  const scanCountRef = useRef(0);

  useEffect(() => {
    isMounted.current = true;
    let zxingControls: any = null;

    const handleFoundCode = (code: string) => {
      if (!isMounted.current || scanSuccessRef.current) return;
      
      // Double Validation: Ensure we read the same barcode twice consecutively
      if (lastScannedCodeRef.current === code) {
        scanCountRef.current += 1;
      } else {
        lastScannedCodeRef.current = code;
        scanCountRef.current = 1;
      }

      // Need 2 consecutive reads to confirm (prevents half-reads of small codes)
      if (scanCountRef.current < 2) {
        console.log('[CameraScanner] Validating barcode...', code);
        return;
      }

      console.log('[CameraScanner] Barcode confirmed:', code);

      if (zxingControls) {
        try { zxingControls.stop(); } catch (_e) { /* ignore */ }
      }
      if (loopRef.current) {
        cancelAnimationFrame(loopRef.current);
      }

      playBeep();
      setScanSuccess(true);
      scanSuccessRef.current = true;
      
      setTimeout(() => {
        if (isMounted.current) onScanRef.current(code);
      }, 500); // reduced delay slightly for faster feel
    };

    /** Create ZXing reader with common formats enabled for speed */
    const createZxingReader = () => {
      const hints = new Map<DecodeHintType, any>();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,
        BarcodeFormat.EAN_8,
        BarcodeFormat.EAN_13,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.UPC_A
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      return new BrowserMultiFormatReader(hints);
    };

    /** Try to decode a canvas using ZXing (for processed frames) */
    const tryZxingOnCanvas = (canvas: HTMLCanvasElement): string | null => {
      try {
        if (!zxingReaderRef.current) {
          zxingReaderRef.current = createZxingReader();
        }
        const result = zxingReaderRef.current.decodeFromCanvas(canvas);
        return result?.getText() || null;
      } catch (_e) {
        return null;
      }
    };

    const startZxingLive = () => {
      setUsingNative(false);
      const codeReader = createZxingReader();
      if (!videoRef.current) return;
      
      console.log('[CameraScanner] Starting ZXing live decode');
      
      try {
        zxingControls = codeReader.decodeFromVideoElement(
          videoRef.current,
          (result) => {
            if (!isMounted.current || scanSuccessRef.current || isOCRProcessingRef.current) return;
            if (result) {
              handleFoundCode(result.getText());
            }
          }
        );
      } catch (e) {
        console.error("[CameraScanner] Zxing live setup failed:", e);
      }
    };

    const startCamera = async () => {
      try {
        console.log('[CameraScanner] Requesting HD camera...');
        
        let videoConstraints: any = {
          facingMode: 'environment',
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        };

        // Try to find cameras
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter(d => d.kind === 'videoinput');
          
          if (videoInputs.length > 0) {
            // Find back cameras
            const backCameras = videoInputs.filter(d => 
              d.label.toLowerCase().includes('back') || 
              d.label.toLowerCase().includes('environment') ||
              d.label.toLowerCase().includes('rear')
            );
            
            const availableCameras = backCameras.length > 0 ? backCameras : videoInputs;
            setCameras(availableCameras);

            if (currentCameraId && availableCameras.some(c => c.deviceId === currentCameraId)) {
               // Use user preferred camera
               videoConstraints = {
                 deviceId: { exact: currentCameraId },
                 width: { ideal: 1920, min: 1280 },
                 height: { ideal: 1080, min: 720 },
               };
               console.log('[CameraScanner] Using preferred camera:', currentCameraId);
            } else if (backCameras.length > 0) {
              // Filter out ultra-wide, telephoto, 0.5x, 0.6x
              const standardCameras = backCameras.filter(d => {
                const label = d.label.toLowerCase();
                return !label.includes('ultra') && 
                       !label.includes('0.5x') && 
                       !label.includes('0.6x') && 
                       !label.includes('wide') &&
                       !label.includes('telephoto');
              });

              // Prefer standard camera, otherwise fallback to the first back camera we found
              const bestCamera = standardCameras.length > 0 ? standardCameras[0] : backCameras[0];
              
              if (bestCamera && bestCamera.deviceId) {
                setCurrentCameraId(bestCamera.deviceId);
                localStorage.setItem('preferredCameraId', bestCamera.deviceId);
                videoConstraints = {
                  deviceId: { exact: bestCamera.deviceId },
                  width: { ideal: 1920, min: 1280 },
                  height: { ideal: 1080, min: 720 },
                };
                console.log('[CameraScanner] Selected specific camera:', bestCamera.label);
              }
            }
          }
        } catch (_e) {
          console.log('[CameraScanner] Could not enumerate devices, falling back to facingMode');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints
        });

        if (!isMounted.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        // Enable continuous autofocus and detect torch
        const track = stream.getVideoTracks()[0];
        try {
          const caps = track.getCapabilities ? track.getCapabilities() : {} as any;
          if (caps.focusMode?.includes('continuous')) {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
            console.log('[CameraScanner] Autofocus: continuous');
          }
          if (caps.torch) {
            setHasTorch(true);
            console.log('[CameraScanner] Torch is supported');
          } else {
            setHasTorch(false);
          }
        } catch (e) {
          console.warn('[CameraScanner] Could not apply advanced constraints', e);
        }

        const settings = track.getSettings();
        console.log('[CameraScanner] Resolution:', settings.width, 'x', settings.height);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise<void>((resolve) => {
            if (!videoRef.current) return;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().then(resolve).catch(console.error);
            };
          });
        }

        setIsInitializing(false);

        // ========= MULTI-ENGINE SCAN LOOP =========
        const hasNative = 'BarcodeDetector' in window;
        let nativeDetector: any = null;

        if (hasNative) {
          setUsingNative(true);
          try {
            nativeDetector = new (window as any).BarcodeDetector({
              formats: [
                'aztec', 'code_128', 'code_39', 'code_93', 'codabar', 
                'data_matrix', 'ean_13', 'ean_8', 'itf', 'pdf417', 
                'qr_code', 'upc_a', 'upc_e', 'unknown'
              ]
            });
          } catch (_e) {
            nativeDetector = null;
          }
        }

        // Also prepare ZXing for processed frames
        zxingReaderRef.current = createZxingReader();

        // If we have no native detector, start ZXing live as primary
        if (!nativeDetector) {
          startZxingLive();
        }

        let frameCount = 0;

        const scanLoop = async () => {
          if (!isMounted.current || scanSuccessRef.current || isOCRProcessingRef.current) return;
          if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
            loopRef.current = requestAnimationFrame(scanLoop);
            return;
          }

          frameCount++;
          
          // Update UI less frequently to maintain High FPS
          if (frameCount % 10 === 0) setScanAttempts(frameCount);

          const video = videoRef.current;
          const c1 = canvasRef.current;
          
          if (!c1) return;

          // Always crop to center laser zone for High FPS scanning
          const successCrop = cropCenterScanner(video, c1);
          
          if (successCrop) {
            // HIGH FPS STRATEGY 1: Native detect on cropped area (every frame)
            if (nativeDetector) {
              try {
                const results = await nativeDetector.detect(c1);
                if (results.length > 0) {
                  handleFoundCode(results[0].rawValue);
                  return;
                }
              } catch (_e) { /* continue */ }
            }

            // STRATEGY 2: ZXing on cropped area (every 4th frame)
            if (frameCount % 4 === 0) {
              const code = tryZxingOnCanvas(c1);
              if (code) {
                handleFoundCode(code);
                return;
              }
            }
          }

          loopRef.current = requestAnimationFrame(scanLoop);
        };

        // Start the multi-strategy scan loop only if we have native detector
        // (ZXing live runs independently if no native)
        if (nativeDetector) {
          loopRef.current = requestAnimationFrame(scanLoop);
        }

      } catch (err: any) {
        console.error('[CameraScanner] Camera access failed:', err);
        if (isMounted.current) {
          setError('Failed to access camera. Please check permissions.');
          setIsInitializing(false);
        }
      }
    };

    const timer = setTimeout(startCamera, 300);

    return () => {
      isMounted.current = false;
      clearTimeout(timer);
      if (zxingControls) {
        try { zxingControls.stop(); } catch (_e) { /* ignore */ }
      }
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCameraId]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] } as any);
      setTorchOn(!torchOn);
    } catch (e) {
      console.error("Failed to toggle torch", e);
    }
  };

  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(c => c.deviceId === currentCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCameraId = cameras[nextIndex].deviceId;
    
    stopScanner(); // Stop current stream
    setCurrentCameraId(nextCameraId);
    localStorage.setItem('preferredCameraId', nextCameraId);
    setIsInitializing(true);
    // The useEffect depends on currentCameraId, so changing it will re-trigger the setup
  };

  const runOCR = async () => {
    if (!videoRef.current) return;
    setIsOCRProcessing(true);
    setOcrStatus('Capturing HD image...');

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Canvas context failed");
      ctx.drawImage(videoRef.current, 0, 0);
      
      // Crop center 80% x 45%
      const cropW = canvas.width * 0.80;
      const cropH = canvas.height * 0.45;
      const sx = (canvas.width - cropW) / 2;
      const sy = (canvas.height - cropH) / 2;
      
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext('2d');
      
      if (cropCtx) {
        cropCtx.drawImage(canvas, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
        // Apply B/W threshold for OCR
        const imgData = cropCtx.getImageData(0, 0, cropW, cropH);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const gray = (d[i] * 77 + d[i+1] * 150 + d[i+2] * 29) >> 8;
          const val = gray < 128 ? 0 : 255;
          d[i] = d[i+1] = d[i+2] = val;
        }
        cropCtx.putImageData(imgData, 0, 0);
      }
      
      const imageData = cropCanvas.toDataURL('image/png');
      setOcrStatus('Running AI Engine...');
      
      const { data: { text } } = await Tesseract.recognize(imageData, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setOcrStatus(`Extracting: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      const cleanedText = text
        .toUpperCase()
        .replace(/O/g, '0')
        .replace(/I|L/g, '1')
        .replace(/S/g, '5')
        .replace(/Z/g, '2')
        .replace(/B/g, '8')
        .replace(/[^0-9]/g, '');
      
      const match = cleanedText.match(/\d{8,14}/);
      
      if (match) {
        setOcrStatus('Number Found!');
        playBeep();
        setScanSuccess(true);
        scanSuccessRef.current = true;
        setTimeout(() => {
          if (isMounted.current) onScanRef.current(match[0]);
        }, 800);
      } else {
        setOcrStatus('No barcode numbers found. Try manual entry.');
        setTimeout(() => setIsOCRProcessing(false), 2000);
      }
    } catch(e) {
      console.error(e);
      setOcrStatus('AI Failed. Try manual entry.');
      setTimeout(() => setIsOCRProcessing(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-card text-card-foreground p-0 rounded-2xl border shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="bg-primary p-4 text-white flex justify-between items-center">
          <h2 className="font-bold flex items-center gap-2">
            <Camera className="h-5 w-5" /> Scan Barcode
          </h2>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative p-4 bg-black min-h-[300px] flex items-center justify-center overflow-hidden">
          {/* Hidden canvases for image processing */}
          <canvas ref={canvasRef} className="hidden" />
          <canvas ref={canvas2Ref} className="hidden" />

          {error ? (
            <div className="text-red-500 bg-red-100 p-4 rounded-xl text-sm font-medium text-center z-10">
              {error}
            </div>
          ) : scanSuccess ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-green-500 text-white animate-in zoom-in duration-300">
              <CheckCircle2 className="h-24 w-24 mb-4" />
              <h2 className="text-4xl font-black tracking-widest uppercase drop-shadow-md">DONE!</h2>
            </div>
          ) : showManualEntry ? (
            <div className="w-full px-2 py-8 flex flex-col items-center gap-4 z-10">
              <Keyboard className="h-10 w-10 text-white/60" />
              <p className="text-white/80 text-sm font-medium text-center">Type the barcode number printed below the barcode</p>
              <form onSubmit={handleManualSubmit} className="w-full flex flex-col gap-3">
                <Input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  placeholder="e.g. 8901234567890"
                  className="h-14 text-xl text-center font-mono tracking-widest bg-white/10 border-white/30 text-white placeholder:text-white/30"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-12 text-white border-white/30 bg-white/5 hover:bg-white/10"
                    onClick={() => setShowManualEntry(false)}
                  >
                    Back to Camera
                  </Button>
                  <Button
                    type="submit"
                    disabled={manualBarcode.trim().length < 4}
                    className="flex-1 h-12 font-bold"
                  >
                    Use This Code
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center relative">
              {isInitializing && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black text-white/50">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <p className="text-sm">Starting HD camera...</p>
                </div>
              )}
              
              <div className="relative w-full rounded-xl overflow-hidden bg-black flex flex-col items-center justify-center">
                <video 
                  ref={videoRef} 
                  playsInline
                  muted
                  className={`w-full h-auto max-h-[60vh] object-cover transition-opacity duration-300 ${isOCRProcessing ? 'opacity-30 blur-sm' : 'opacity-100'}`}
                />
                
                {/* Scanning guide overlay */}
                {!isInitializing && !isOCRProcessing && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-3/4 h-32 border-2 border-primary/70 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                       <div className="absolute top-0 left-0 w-full h-[2px] bg-red-500 animate-[scan_2s_ease-in-out_infinite] shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                    </div>
                  </div>
                )}
                
                {/* OCR Processing Overlay */}
                {isOCRProcessing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-30">
                    <BrainCircuit className="h-12 w-12 text-primary animate-pulse mb-3" />
                    <p className="font-bold tracking-wide">{ocrStatus}</p>
                  </div>
                )}

                {/* Controls Overlay */}
                {!isInitializing && !isOCRProcessing && (
                  <div className="absolute top-4 right-4 flex flex-col gap-3 z-20">
                    {cameras.length > 1 && (
                      <Button
                        onClick={switchCamera}
                        variant="secondary"
                        className="rounded-full shadow-lg h-10 w-10 p-0 flex items-center justify-center bg-white/20 hover:bg-white/40 text-white backdrop-blur-md border border-white/30"
                      >
                        <RefreshCw className="h-5 w-5" />
                      </Button>
                    )}
                    {hasTorch && (
                      <Button
                        onClick={toggleTorch}
                        variant="secondary"
                        className="rounded-full shadow-lg h-10 w-10 p-0 flex items-center justify-center bg-white/20 hover:bg-white/40 text-white backdrop-blur-md border border-white/30"
                      >
                        {torchOn ? <Zap className="h-5 w-5 text-yellow-400 fill-yellow-400" /> : <ZapOff className="h-5 w-5" />}
                      </Button>
                    )}
                  </div>
                )}

                {/* Engine + Scan Info */}
                {!isInitializing && !isOCRProcessing && (
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    <div className="px-2 py-1 bg-black/50 backdrop-blur-md rounded-md text-[10px] text-white/70 font-mono flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-green-400" /> Laser Mode (Fast)
                    </div>
                    <div className="px-2 py-1 bg-black/50 backdrop-blur-md rounded-md text-[10px] text-white/70 font-mono flex items-center gap-1">
                      <ZoomIn className="h-3 w-3 text-blue-400" /> {scanAttempts > 0 ? `Scanning... (${scanAttempts})` : 'Ready'}
                    </div>
                  </div>
                )}
              </div>
              
              {!isInitializing && !isOCRProcessing ? (
                <div className="mt-4 flex flex-col items-center w-full gap-2 z-10">
                  <p className="text-center text-white/70 text-xs">Hold steady & close. Use flashlight for dark areas.</p>
                  <div className="grid grid-cols-2 gap-2 w-full">
                    <Button 
                      onClick={runOCR} 
                      className="bg-white/10 hover:bg-white/20 border border-white/20 text-white"
                    >
                      <BrainCircuit className="mr-2 h-4 w-4" />
                      AI Read
                    </Button>
                    <Button 
                      onClick={() => setShowManualEntry(true)} 
                      variant="outline"
                      className="bg-white/10 hover:bg-white/20 border border-white/20 text-white"
                    >
                      <Keyboard className="mr-2 h-4 w-4" />
                      Type Number
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
