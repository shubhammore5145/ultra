import { useEffect, useState, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import Tesseract from 'tesseract.js';
import { 
  X, Camera, CheckCircle2, Loader2, Zap, ZapOff, 
  Sparkles, BrainCircuit, Keyboard, ZoomIn, RefreshCw, 
  Upload, AlertTriangle, ShieldAlert, Image as ImageIcon
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface CameraScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

interface ErrorState {
  type: 'permission' | 'notFound' | 'inUse' | 'insecure' | 'other';
  title: string;
  message: string;
}

export function CameraScanner({ onScan, onClose }: CameraScannerProps) {
  const [errorInfo, setErrorInfo] = useState<ErrorState | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [usingNative, setUsingNative] = useState(false);
  
  // Active mode: 'camera' | 'upload' | 'manual'
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');

  // Camera Selection State
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(localStorage.getItem('preferredCameraId'));
  
  // OCR & Image processing states
  const [isOCRProcessing, setIsOCRProcessing] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');

  // Manual entry state
  const [manualBarcode, setManualBarcode] = useState('');

  // Scan attempt counter for UI feedback
  const [scanAttempts, setScanAttempts] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvas2Ref = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
        if (hasTorch && torchOn) {
          try { track.applyConstraints({ advanced: [{ torch: false }] }); } catch(e) {}
        }
        track.stop();
      });
      streamRef.current = null;
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

  /** Create ZXing reader with common formats enabled */
  const createZxingReader = () => {
    const hints = new Map<DecodeHintType, any>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.EAN_8,
      BarcodeFormat.EAN_13,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_39
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    return new BrowserMultiFormatReader(hints);
  };

  /** Crop center scanning area (simulates laser scanner zone) */
  const cropCenterScanner = (video: HTMLVideoElement, canvas: HTMLCanvasElement): boolean => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return false;
    
    const cw = vw * 0.75;
    const ch = vh * 0.35;
    const cx = (vw - cw) / 2;
    const cy = (vh - ch) / 2;
    
    canvas.width = cw;
    canvas.height = ch;
    
    ctx.drawImage(video, cx, cy, cw, ch, 0, 0, cw, ch);
    return true;
  };

  const handleFoundCode = (code: string) => {
    if (!isMounted.current || scanSuccessRef.current) return;
    
    console.log('[CameraScanner] Barcode confirmed:', code);

    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
    }

    playBeep();
    setScanSuccess(true);
    scanSuccessRef.current = true;
    
    setTimeout(() => {
      if (isMounted.current) onScanRef.current(code);
    }, 500);
  };

  // Manual entry submit
  const handleManualSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = manualBarcode.trim();
    if (code.length >= 3) {
      handleFoundCode(code);
    }
  };

  /** Process barcode from uploaded image file */
  const handleImageUpload = (file: File) => {
    if (!file) return;
    setIsOCRProcessing(true);
    setOcrStatus('Scanning photo for barcode...');
    setErrorInfo(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        setIsOCRProcessing(false);
        return;
      }

      const img = new Image();
      img.onload = async () => {
        // 1. Try ZXing on canvas
        try {
          const zxing = createZxingReader();
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            const result = zxing.decodeFromCanvas(canvas);
            if (result && result.getText()) {
              setIsOCRProcessing(false);
              handleFoundCode(result.getText());
              return;
            }
          }
        } catch (_zxingErr) {
          console.log('[CameraScanner] Image ZXing decode attempt failed, checking native');
        }

        // 2. Try native BarcodeDetector
        if ('BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({
              formats: ['code_128', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e', 'code_39']
            });
            const barcodes = await detector.detect(img);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              setIsOCRProcessing(false);
              handleFoundCode(barcodes[0].rawValue);
              return;
            }
          } catch (_bdErr) {}
        }

        // 3. Fallback to Tesseract OCR to read barcode digits directly
        setOcrStatus('AI reading barcode numbers...');
        try {
          const { data: { text } } = await Tesseract.recognize(dataUrl, 'eng');
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
            setIsOCRProcessing(false);
            handleFoundCode(match[0]);
            return;
          }
        } catch (_ocrErr) {}

        setIsOCRProcessing(false);
        setErrorInfo({
          type: 'other',
          title: 'No Barcode Found In Photo',
          message: 'Could not detect a clear barcode in this picture. Please type the numbers printed on the package.'
        });
        setActiveTab('manual');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  /** Resilient Multi-tier Camera Stream Acquisition */
  const acquireCameraStream = async (targetDeviceId?: string | null): Promise<MediaStream> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const err = new Error(isSecure ? 'Camera API not supported on this browser' : 'Insecure context');
      err.name = isSecure ? 'NotSupportedError' : 'InsecureContextError';
      throw err;
    }

    const attempts: MediaStreamConstraints[] = [];

    // 1. Explicit preferred device if chosen
    if (targetDeviceId) {
      attempts.push({
        video: { deviceId: { exact: targetDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      attempts.push({
        video: { deviceId: { exact: targetDeviceId } }
      });
    }

    // 2. High-res Environment (Back) camera (ideal only, NEVER strict min)
    attempts.push({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    });

    // 3. Relaxed environment camera
    attempts.push({
      video: { facingMode: { ideal: 'environment' } }
    });

    // 4. Standard 720p or any camera
    attempts.push({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } }
    });

    // 5. Bare video constraint (guaranteed compatibility with webcams, laptops, front cams)
    attempts.push({
      video: true
    });

    let lastError: any = null;
    for (const constraints of attempts) {
      try {
        console.log('[CameraScanner] Trying camera constraints:', constraints);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) return stream;
      } catch (err: any) {
        console.warn('[CameraScanner] Constraint attempt failed:', err.name, err.message);
        lastError = err;
        // If user actively denied permission, stop immediately and report permission error
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          throw err;
        }
      }
    }

    throw lastError || new Error('CAMERA_INIT_FAILED');
  };

  /** Analyze and categorize errors for helpful user instructions */
  const parseCameraError = (err: any): ErrorState => {
    const name = err?.name || '';
    const msg = err?.message || '';

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || msg.toLowerCase().includes('permission')) {
      return {
        type: 'permission',
        title: 'Camera Permission Blocked',
        message: 'Your browser has blocked camera access. Please click the lock 🔒 or camera icon in your address bar, set Camera to "Allow", and click Retry.'
      };
    }

    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return {
        type: 'notFound',
        title: 'No Camera Detected',
        message: 'No camera hardware was found on this computer or device. You can type the barcode number or upload a photo below.'
      };
    }

    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return {
        type: 'inUse',
        title: 'Camera Is In Use',
        message: 'The camera is currently being used by another app (e.g. Zoom, Google Meet, Teams, WhatsApp, or another browser tab). Please close that app and retry.'
      };
    }

    if (name === 'InsecureContextError' || (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')) {
      return {
        type: 'insecure',
        title: 'HTTPS Connection Required',
        message: 'Browsers require a secure HTTPS connection or localhost to access camera video streams.'
      };
    }

    return {
      type: 'other',
      title: 'Camera Access Error',
      message: msg || 'Could not initialize camera stream. Please check camera connections or enter barcode manually.'
    };
  };

  const startCamera = async () => {
    setIsInitializing(true);
    setErrorInfo(null);

    let zxingControls: any = null;

    try {
      const stream = await acquireCameraStream(currentCameraId);

      if (!isMounted.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;

      // Now that camera permission is granted, enumerate devices to list all available cameras
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        if (videoInputs.length > 0) {
          setCameras(videoInputs);
        }
      } catch (e) {
        console.warn('[CameraScanner] Enumerate devices failed', e);
      }

      // Check capabilities for continuous autofocus and torch
      const track = stream.getVideoTracks()[0];
      try {
        const caps = track.getCapabilities ? track.getCapabilities() : {} as any;
        if (caps.focusMode?.includes('continuous')) {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
        }
        if (caps.torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      } catch (e) {
        console.warn('[CameraScanner] Could not apply advanced constraints', e);
      }

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
              'code_128', 'code_39', 'code_93', 'codabar', 
              'data_matrix', 'ean_13', 'ean_8', 'itf', 'pdf417', 
              'qr_code', 'upc_a', 'upc_e'
            ]
          });
        } catch (_e) {
          nativeDetector = null;
        }
      }

      // Prepare ZXing for fallback frames
      zxingReaderRef.current = createZxingReader();

      // If no native BarcodeDetector, start ZXing live
      if (!nativeDetector) {
        setUsingNative(false);
        try {
          const codeReader = createZxingReader();
          if (videoRef.current) {
            zxingControls = codeReader.decodeFromVideoElement(
              videoRef.current,
              (result) => {
                if (!isMounted.current || scanSuccessRef.current || isOCRProcessingRef.current) return;
                if (result) {
                  handleFoundCode(result.getText());
                }
              }
            );
          }
        } catch (e) {
          console.error('[CameraScanner] ZXing live setup failed:', e);
        }
      }

      let frameCount = 0;

      const scanLoop = async () => {
        if (!isMounted.current || scanSuccessRef.current || isOCRProcessingRef.current) return;
        if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
          loopRef.current = requestAnimationFrame(scanLoop);
          return;
        }

        frameCount++;
        if (frameCount % 10 === 0) setScanAttempts(frameCount);

        const video = videoRef.current;
        const c1 = canvasRef.current;
        
        if (c1) {
          const successCrop = cropCenterScanner(video, c1);
          if (successCrop) {
            // Strategy 1: Native detector on cropped laser area (every frame)
            if (nativeDetector) {
              try {
                const results = await nativeDetector.detect(c1);
                if (results.length > 0 && results[0].rawValue) {
                  handleFoundCode(results[0].rawValue);
                  return;
                }
              } catch (_e) { /* continue */ }
            }

            // Strategy 2: ZXing on cropped area (every 4th frame)
            if (frameCount % 4 === 0 && zxingReaderRef.current) {
              try {
                const result = zxingReaderRef.current.decodeFromCanvas(c1);
                if (result && result.getText()) {
                  handleFoundCode(result.getText());
                  return;
                }
              } catch (_e) { /* continue */ }
            }
          }
        }

        loopRef.current = requestAnimationFrame(scanLoop);
      };

      if (nativeDetector) {
        loopRef.current = requestAnimationFrame(scanLoop);
      }

    } catch (err: any) {
      console.error('[CameraScanner] Camera access failed:', err);
      if (isMounted.current) {
        setErrorInfo(parseCameraError(err));
        setIsInitializing(false);
      }
    }

    return () => {
      if (zxingControls) {
        try { zxingControls.stop(); } catch (_e) {}
      }
    };
  };

  useEffect(() => {
    isMounted.current = true;
    const timer = setTimeout(startCamera, 200);

    return () => {
      isMounted.current = false;
      clearTimeout(timer);
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
    
    stopScanner();
    setCurrentCameraId(nextCameraId);
    localStorage.setItem('preferredCameraId', nextCameraId);
    setIsInitializing(true);
  };

  const runOCR = async () => {
    if (!videoRef.current) return;
    setIsOCRProcessing(true);
    setOcrStatus('Capturing image...');

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Canvas context failed");
      ctx.drawImage(videoRef.current, 0, 0);
      
      const imageData = canvas.toDataURL('image/png');
      setOcrStatus('Reading printed barcode numbers...');
      
      const { data: { text } } = await Tesseract.recognize(imageData, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setOcrStatus(`AI Reading: ${Math.round(m.progress * 100)}%`);
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
        setOcrStatus('Barcode Found!');
        playBeep();
        setScanSuccess(true);
        scanSuccessRef.current = true;
        setTimeout(() => {
          if (isMounted.current) onScanRef.current(match[0]);
        }, 500);
      } else {
        setOcrStatus('No clear barcode digits found. Please enter manually.');
        setTimeout(() => setIsOCRProcessing(false), 2000);
      }
    } catch(e) {
      console.error(e);
      setOcrStatus('AI Read failed. Please enter manually.');
      setTimeout(() => setIsOCRProcessing(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-card text-card-foreground p-0 rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        
        {/* Header */}
        <div className="bg-primary p-4 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-tight">Barcode Scanner</h2>
              <p className="text-xs text-white/80">POS & Inventory Fast Scan</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/20 rounded-full h-8 w-8" 
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Tab switcher: Camera vs Manual vs Upload */}
        <div className="flex border-b border-border bg-muted/40 p-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('camera');
              if (errorInfo) startCamera();
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'camera' 
                ? 'bg-card text-primary shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Camera className="h-3.5 w-3.5" /> Live Camera
          </button>
          
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-all"
          >
            <Upload className="h-3.5 w-3.5" /> Upload Photo
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'manual' 
                ? 'bg-card text-primary shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Keyboard className="h-3.5 w-3.5" /> Type Code
          </button>
        </div>

        {/* Hidden File Input for Image Scanning */}
        <input 
          ref={fileInputRef}
          type="file" 
          accept="image/*" 
          capture="environment"
          className="hidden" 
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageUpload(file);
          }}
        />

        {/* Main Content Area */}
        <div className="relative p-4 bg-black min-h-[340px] flex items-center justify-center overflow-hidden">
          {/* Hidden canvases for frame processing */}
          <canvas ref={canvasRef} className="hidden" />
          <canvas ref={canvas2Ref} className="hidden" />

          {/* Success Overlay */}
          {scanSuccess ? (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-emerald-600 text-white animate-in zoom-in duration-300">
              <CheckCircle2 className="h-20 w-20 mb-3 animate-bounce" />
              <h2 className="text-3xl font-black tracking-widest uppercase drop-shadow-md">SCANNED!</h2>
              <p className="text-sm font-medium mt-1 text-emerald-100">Adding to cart...</p>
            </div>
          ) : activeTab === 'manual' ? (
            /* Manual Barcode Entry Mode */
            <div className="w-full px-4 py-6 flex flex-col items-center gap-4 z-10 bg-card rounded-xl text-card-foreground">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Keyboard className="h-6 w-6" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg">Enter Barcode Number</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Type the digits printed below the barcode on the package
                </p>
              </div>
              <form onSubmit={handleManualSubmit} className="w-full flex flex-col gap-3">
                <Input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  placeholder="e.g. 8901030384729"
                  className="h-14 text-2xl text-center font-mono tracking-widest font-bold border-2 focus-visible:ring-primary"
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-11"
                    onClick={() => {
                      setActiveTab('camera');
                      if (errorInfo) startCamera();
                    }}
                  >
                    Back to Camera
                  </Button>
                  <Button
                    type="submit"
                    disabled={manualBarcode.trim().length < 3}
                    className="flex-1 h-11 font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Confirm Code
                  </Button>
                </div>
              </form>
            </div>
          ) : errorInfo ? (
            /* Helpful Error View with Multiple Remedies */
            <div className="w-full max-w-sm p-5 bg-card text-card-foreground rounded-2xl border border-destructive/20 shadow-xl flex flex-col items-center text-center z-10 animate-in fade-in zoom-in-95">
              <div className="h-14 w-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-3">
                {errorInfo.type === 'permission' ? (
                  <ShieldAlert className="h-7 w-7" />
                ) : (
                  <AlertTriangle className="h-7 w-7" />
                )}
              </div>
              
              <h3 className="font-bold text-lg text-foreground mb-1">{errorInfo.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-5">
                {errorInfo.message}
              </p>

              <div className="w-full space-y-2">
                <Button 
                  onClick={startCamera} 
                  className="w-full h-11 font-semibold flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <RefreshCw className="h-4 w-4" /> Try Camera Again
                </Button>

                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-11 font-medium flex items-center justify-center gap-2"
                >
                  <Upload className="h-4 w-4 text-primary" /> Upload / Take Barcode Photo
                </Button>

                <Button 
                  variant="secondary" 
                  onClick={() => setActiveTab('manual')}
                  className="w-full h-11 font-medium flex items-center justify-center gap-2"
                >
                  <Keyboard className="h-4 w-4" /> Enter Barcode Manually
                </Button>
              </div>
            </div>
          ) : (
            /* Live Camera Stream View */
            <div className="w-full h-full flex flex-col items-center justify-center relative">
              {isInitializing && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 text-white/70">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                  <p className="text-sm font-medium">Starting Camera...</p>
                  <p className="text-xs text-white/50 mt-1">Please allow camera permissions if prompted</p>
                </div>
              )}
              
              <div className="relative w-full rounded-xl overflow-hidden bg-black flex flex-col items-center justify-center">
                <video 
                  ref={videoRef} 
                  playsInline
                  muted
                  className={`w-full h-auto max-h-[50vh] object-cover transition-opacity duration-300 ${isOCRProcessing ? 'opacity-30 blur-sm' : 'opacity-100'}`}
                />
                
                {/* Laser Scanning Guide Overlay */}
                {!isInitializing && !isOCRProcessing && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-4/5 h-36 border-2 border-primary/80 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                       <div className="absolute top-0 left-0 w-full h-[2px] bg-red-500 animate-[scan_2s_ease-in-out_infinite] shadow-[0_0_10px_rgba(239,68,68,0.9)]"></div>
                    </div>
                  </div>
                )}
                
                {/* OCR Processing Overlay */}
                {isOCRProcessing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-30 bg-black/70">
                    <BrainCircuit className="h-12 w-12 text-primary animate-pulse mb-3" />
                    <p className="font-bold tracking-wide text-sm">{ocrStatus}</p>
                  </div>
                )}

                {/* Floating Camera Controls (Switch camera + Torch) */}
                {!isInitializing && !isOCRProcessing && (
                  <div className="absolute top-3 right-3 flex flex-col gap-2 z-20">
                    {cameras.length > 1 && (
                      <Button
                        onClick={switchCamera}
                        variant="secondary"
                        size="icon"
                        title="Switch Camera"
                        className="rounded-full shadow-lg h-9 w-9 bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    {hasTorch && (
                      <Button
                        onClick={toggleTorch}
                        variant="secondary"
                        size="icon"
                        title={torchOn ? 'Turn Off Flashlight' : 'Turn On Flashlight'}
                        className="rounded-full shadow-lg h-9 w-9 bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20"
                      >
                        {torchOn ? <Zap className="h-4 w-4 text-yellow-400 fill-yellow-400" /> : <ZapOff className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                )}

                {/* Engine Mode Badge */}
                {!isInitializing && !isOCRProcessing && (
                  <div className="absolute top-3 left-3 flex flex-col gap-1">
                    <div className="px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-md text-[10px] text-white/80 font-mono flex items-center gap-1 border border-white/10">
                      <Sparkles className="h-3 w-3 text-emerald-400" /> {usingNative ? 'Native Scanner' : 'ZXing Engine'}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Bottom Actions inside camera view */}
              {!isInitializing && !isOCRProcessing && (
                <div className="mt-3 flex flex-col items-center w-full gap-2 z-10">
                  <p className="text-center text-white/60 text-xs">Align barcode inside the box</p>
                  <div className="grid grid-cols-3 gap-2 w-full">
                    <Button 
                      size="sm"
                      onClick={runOCR} 
                      className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs h-9"
                    >
                      <BrainCircuit className="mr-1.5 h-3.5 w-3.5 text-primary" />
                      AI OCR
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => fileInputRef.current?.click()} 
                      variant="outline"
                      className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs h-9"
                    >
                      <Upload className="mr-1.5 h-3.5 w-3.5 text-blue-400" />
                      Upload Photo
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => setActiveTab('manual')} 
                      variant="outline"
                      className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs h-9"
                    >
                      <Keyboard className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
                      Type Code
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
