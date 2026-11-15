import { useEffect, useState, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import Tesseract from 'tesseract.js';
import { 
  X, Camera, CheckCircle2, Loader2, Zap, ZapOff, 
  Sparkles, BrainCircuit, Keyboard, RefreshCw, 
  Upload, AlertTriangle, ShieldAlert, ShoppingCart, 
  Check, Repeat
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

export interface CameraScannerProps {
  onScan: (barcode: string, autoClose?: boolean) => void;
  onClose: () => void;
  continuous?: boolean;
  cartCount?: number;
  cartTotal?: number;
}

interface ErrorState {
  type: 'permission' | 'notFound' | 'inUse' | 'insecure' | 'other';
  title: string;
  message: string;
}

export function CameraScanner({ 
  onScan, 
  onClose, 
  continuous,
  cartCount,
  cartTotal
}: CameraScannerProps) {
  const [errorInfo, setErrorInfo] = useState<ErrorState | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [usingNative, setUsingNative] = useState(false);
  
  // Continuous scanning mode for Kirana staff (defaults to true if cartCount is supplied or continuous is true)
  const [isContinuous, setIsContinuous] = useState<boolean>(
    continuous !== undefined ? continuous : (cartCount !== undefined ? true : false)
  );

  // Scan feedback toast & viewfinder flash
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [flashActive, setFlashActive] = useState(false);
  
  // Active mode: 'camera' | 'manual'
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');

  // Camera Selection State
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(localStorage.getItem('preferredCameraId'));
  
  // OCR & Image processing states
  const [isOCRProcessing, setIsOCRProcessing] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');

  // Manual entry state
  const [manualBarcode, setManualBarcode] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number>(0);
  const isMounted = useRef(true);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // Refs to track states inside requestAnimationFrame loops without stale closures
  const scanSuccessRef = useRef(false);
  const isOCRProcessingRef = useRef(false);
  const isContinuousRef = useRef(isContinuous);
  const onScanRef = useRef(onScan);

  // Cooldown tracker to prevent duplicate scans of the exact same barcode in continuous mode
  const lastScannedCodeRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  useEffect(() => { onScanRef.current = onScan; }, [onScan]);
  useEffect(() => { scanSuccessRef.current = scanSuccess; }, [scanSuccess]);
  useEffect(() => { isOCRProcessingRef.current = isOCRProcessing; }, [isOCRProcessing]);
  useEffect(() => { isContinuousRef.current = isContinuous; }, [isContinuous]);

  const stopScanner = useCallback(() => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        if (hasTorch && torchOn) {
          try { (track as any).applyConstraints({ advanced: [{ torch: false }] }); } catch(e) {}
        }
        track.stop();
      });
      streamRef.current = null;
    }
  }, [hasTorch, torchOn]);

  const playBeep = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([80]);
      }
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = 1750;
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.08);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.08);
    } catch (e) {
      console.warn("[CameraScanner] Audio context blocked or unsupported:", e);
    }
  };

  /** Create ZXing reader with common barcode formats enabled */
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

  /** Crop center scanning area for ZXing fallback */
  const cropCenterScanner = (video: HTMLVideoElement, canvas: HTMLCanvasElement): boolean => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return false;
    
    const cw = Math.floor(vw * 0.85);
    const ch = Math.floor(vh * 0.45);
    const cx = Math.floor((vw - cw) / 2);
    const cy = Math.floor((vh - ch) / 2);
    
    canvas.width = cw;
    canvas.height = ch;
    
    ctx.drawImage(video, cx, cy, cw, ch, 0, 0, cw, ch);
    return true;
  };

  const handleFoundCode = (code: string) => {
    if (!isMounted.current) return;
    const cleanCode = code.trim();
    if (!cleanCode) return;

    const now = Date.now();
    // Cooldown check: if the exact same barcode was scanned within 1.4 seconds, ignore duplicate
    if (lastScannedCodeRef.current === cleanCode && (now - lastScannedTimeRef.current) < 1400) {
      return;
    }

    lastScannedCodeRef.current = cleanCode;
    lastScannedTimeRef.current = now;

    console.log('[CameraScanner] Barcode confirmed:', cleanCode);

    playBeep();

    // Visual feedback for mobile user
    setLastScannedCode(cleanCode);
    setFlashActive(true);
    setTimeout(() => {
      if (isMounted.current) setFlashActive(false);
    }, 450);

    if (isContinuousRef.current) {
      // Continuous mode: keep camera running and notify POS to add to cart
      onScanRef.current(cleanCode, false);
    } else {
      // Single scan mode: cancel animation loop and auto-close
      if (loopRef.current) {
        cancelAnimationFrame(loopRef.current);
      }
      setScanSuccess(true);
      scanSuccessRef.current = true;
      setTimeout(() => {
        if (isMounted.current) onScanRef.current(cleanCode, true);
      }, 400);
    }
  };

  // Manual entry submit
  const handleManualSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = manualBarcode.trim();
    if (code.length >= 2) {
      handleFoundCode(code);
      setManualBarcode('');
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
        // 1. Try native BarcodeDetector if available
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

        // 2. Try ZXing on canvas
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
          console.log('[CameraScanner] Image ZXing decode attempt failed, checking OCR');
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
        video: { deviceId: { exact: targetDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      attempts.push({
        video: { deviceId: { exact: targetDeviceId } }
      });
    }

    // 2. High-speed 720p Environment (Back) camera - best for smartphones
    attempts.push({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
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

    // 5. Bare video constraint (guaranteed compatibility with webcams and front cams)
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
        // If user actively denied permission, stop immediately
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
        message: 'No camera hardware was found on this phone or device. You can type the barcode number or upload a photo below.'
      };
    }

    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return {
        type: 'inUse',
        title: 'Camera Is In Use',
        message: 'The camera is currently being used by another app (e.g. WhatsApp, Instagram, or another browser tab). Please close that app and retry.'
      };
    }

    if (name === 'InsecureContextError' || (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')) {
      return {
        type: 'insecure',
        title: 'HTTPS Connection Required',
        message: 'Mobile browsers require a secure HTTPS connection or localhost to access camera video streams.'
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

      // Enumerate available cameras for the switch camera button
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
        console.warn('[CameraScanner] Advanced constraints check:', e);
      }

      // Safe non-hanging video element initialization
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        video.autoplay = true;

        await new Promise<void>((resolve) => {
          let resolved = false;
          const done = () => {
            if (!resolved) {
              resolved = true;
              video.play().catch(e => console.warn('[CameraScanner] video.play notice:', e)).finally(resolve);
            }
          };

          if (video.readyState >= 2) {
            done();
            return;
          }

          video.onloadeddata = done;
          video.onloadedmetadata = done;
          video.oncanplay = done;

          // Fail-safe timeout: never hang more than 1200ms
          setTimeout(done, 1200);
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

      // Prepare ZXing reader
      zxingReaderRef.current = createZxingReader();

      let frameCount = 0;

      const scanLoop = async () => {
        if (!isMounted.current || scanSuccessRef.current || isOCRProcessingRef.current) return;
        
        const video = videoRef.current;
        if (!video || video.readyState < 2) {
          loopRef.current = requestAnimationFrame(scanLoop);
          return;
        }

        frameCount++;

        // Strategy 1: Hardware-Accelerated Native BarcodeDetector directly on the full video frame
        if (nativeDetector) {
          try {
            const results = await nativeDetector.detect(video);
            if (results.length > 0 && results[0].rawValue) {
              handleFoundCode(results[0].rawValue);
              if (!isContinuousRef.current) return;
            }
          } catch (_e) { /* continue */ }
        }

        // Strategy 2: ZXing decoder on cropped canvas (every 3rd frame to conserve mobile CPU)
        if ((!nativeDetector || frameCount % 3 === 0) && zxingReaderRef.current) {
          const c1 = canvasRef.current;
          if (c1) {
            const successCrop = cropCenterScanner(video, c1);
            if (successCrop) {
              try {
                const result = zxingReaderRef.current.decodeFromCanvas(c1);
                if (result && result.getText()) {
                  handleFoundCode(result.getText());
                  if (!isContinuousRef.current) return;
                }
              } catch (_e) { /* continue */ }
            }
          }
        }

        loopRef.current = requestAnimationFrame(scanLoop);
      };

      loopRef.current = requestAnimationFrame(scanLoop);

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
    const timer = setTimeout(startCamera, 150);

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
        handleFoundCode(match[0]);
        setTimeout(() => setIsOCRProcessing(false), 800);
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
    <div className="fixed inset-0 z-[100] flex flex-col justify-between sm:items-center sm:justify-center bg-black/95 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground p-0 rounded-none sm:rounded-2xl border-0 sm:border border-border shadow-2xl w-full sm:max-w-md h-full sm:h-auto max-h-full sm:max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        
        {/* Top Header */}
        <div className="bg-primary p-3.5 sm:p-4 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base leading-tight">Barcode Scanner</h2>
                <span className="text-[10px] bg-white/25 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                  Staff Mode
                </span>
              </div>
              <p className="text-xs text-white/80">Point camera at product barcode</p>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/20 rounded-full h-9 w-9" 
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Action Tabs & Mode Switcher */}
        <div className="flex items-center justify-between border-b border-border bg-muted/40 p-1.5 shrink-0 gap-1">
          <div className="flex gap-1 flex-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('camera');
                if (errorInfo) startCamera();
              }}
              className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'camera' 
                  ? 'bg-card text-primary shadow-xs' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Camera className="h-3.5 w-3.5" /> Camera
            </button>
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="py-1.5 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-all"
            >
              <Upload className="h-3.5 w-3.5" /> Upload
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'manual' 
                  ? 'bg-card text-primary shadow-xs' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Keyboard className="h-3.5 w-3.5" /> Type Code
            </button>
          </div>

          {/* Continuous Scan Toggle */}
          <button
            type="button"
            onClick={() => setIsContinuous(!isContinuous)}
            title={isContinuous ? 'Continuous multi-scan enabled' : 'Single-item scan mode'}
            className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg border flex items-center gap-1 transition-all ${
              isContinuous 
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                : 'bg-muted border-border text-muted-foreground'
            }`}
          >
            <Repeat className={`h-3 w-3 ${isContinuous ? 'animate-spin-slow' : ''}`} />
            {isContinuous ? 'Multi-Scan' : 'Single'}
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

        {/* Viewfinder Main Stage */}
        <div className="relative flex-1 bg-black min-h-[300px] sm:min-h-[360px] flex items-center justify-center overflow-hidden">
          {/* Hidden Canvas for ZXing frame reading */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Single-Scan Mode Success Overlay */}
          {scanSuccess && !isContinuous ? (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-emerald-600 text-white animate-in zoom-in duration-300">
              <CheckCircle2 className="h-20 w-20 mb-3 animate-bounce" />
              <h2 className="text-3xl font-black tracking-widest uppercase drop-shadow-md">SCANNED!</h2>
              <p className="text-sm font-medium mt-1 text-emerald-100">Adding product to bill...</p>
            </div>
          ) : activeTab === 'manual' ? (
            /* Manual Barcode Entry Mode */
            <div className="w-full h-full p-6 flex flex-col items-center justify-center gap-4 z-10 bg-card text-card-foreground">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Keyboard className="h-7 w-7" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg">Enter Barcode Number</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Type the digits printed below the barcode on the package
                </p>
              </div>
              <form onSubmit={handleManualSubmit} className="w-full max-w-xs flex flex-col gap-3">
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
                    disabled={manualBarcode.trim().length < 2}
                    className="flex-1 h-11 font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Add Product
                  </Button>
                </div>
              </form>
            </div>
          ) : errorInfo ? (
            /* Helpful Camera Error & Permission Recovery View */
            <div className="w-full max-w-sm p-6 bg-card text-card-foreground rounded-2xl border border-destructive/20 shadow-xl flex flex-col items-center text-center z-10 animate-in fade-in zoom-in-95 m-4">
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

              <div className="w-full space-y-2.5">
                <Button 
                  onClick={startCamera} 
                  className="w-full h-11 font-semibold flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                >
                  <RefreshCw className="h-4 w-4" /> Try Camera Again
                </Button>

                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-11 font-medium flex items-center justify-center gap-2"
                >
                  <Upload className="h-4 w-4 text-primary" /> Upload / Take Photo
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
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 text-white/80 p-6 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                  <p className="text-sm font-semibold">Starting Smartphone Camera...</p>
                  <p className="text-xs text-white/50 mt-1 max-w-xs">
                    Please allow camera access permission in your browser if prompted
                  </p>
                </div>
              )}
              
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                <video 
                  ref={videoRef} 
                  playsInline
                  muted
                  autoPlay
                  className={`w-full h-full object-cover transition-opacity duration-300 ${isOCRProcessing ? 'opacity-30 blur-sm' : 'opacity-100'}`}
                />
                
                {/* Aiming Reticle / Laser Scanning Guide Overlay */}
                {!isInitializing && !isOCRProcessing && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
                    <div 
                      className={`w-[85%] max-w-[340px] h-44 rounded-2xl border-2 transition-all duration-200 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] ${
                        flashActive 
                          ? 'border-emerald-400 ring-4 ring-emerald-400/70 shadow-[0_0_35px_rgba(52,211,153,0.9)]' 
                          : 'border-white/80'
                      }`}
                    >
                      {/* Laser Sweep Line */}
                      <div className="absolute top-0 left-0 w-full h-[2.5px] bg-red-500 animate-[scan_1.8s_ease-in-out_infinite] shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
                      
                      {/* Corner Accents */}
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-emerald-400 rounded-tl" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-emerald-400 rounded-tr" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-emerald-400 rounded-bl" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-emerald-400 rounded-br" />
                    </div>
                  </div>
                )}
                
                {/* OCR AI Processing Overlay */}
                {isOCRProcessing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-30 bg-black/75">
                    <BrainCircuit className="h-12 w-12 text-primary animate-pulse mb-3" />
                    <p className="font-bold tracking-wide text-sm">{ocrStatus}</p>
                  </div>
                )}

                {/* Floating Top Left Badge: Native Hardware Acceleration */}
                {!isInitializing && !isOCRProcessing && (
                  <div className="absolute top-3 left-3 flex flex-col gap-1 z-20">
                    <div className="px-2.5 py-1 bg-black/65 backdrop-blur-md rounded-lg text-[10px] text-white/90 font-mono flex items-center gap-1.5 border border-white/15">
                      <Sparkles className="h-3 w-3 text-emerald-400" /> 
                      {usingNative ? 'Turbo Hardware Engine' : 'ZXing Optical Engine'}
                    </div>
                  </div>
                )}

                {/* Floating Top Right Camera Controls (Torch & Camera Switcher) */}
                {!isInitializing && !isOCRProcessing && (
                  <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
                    {cameras.length > 1 && (
                      <Button
                        onClick={switchCamera}
                        variant="secondary"
                        size="icon"
                        title="Switch Front/Rear Camera"
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
                        className={`rounded-full shadow-lg h-9 w-9 backdrop-blur-md border border-white/20 transition-all ${
                          torchOn 
                            ? 'bg-amber-500 text-black hover:bg-amber-400' 
                            : 'bg-black/60 hover:bg-black/80 text-white'
                        }`}
                      >
                        {torchOn ? <Zap className="h-4 w-4 fill-black" /> : <ZapOff className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                )}

                {/* Multi-Scan Floating Feedback Toast on Item Detection */}
                {lastScannedCode && isContinuous && (
                  <div className="absolute bottom-4 left-3 right-3 z-30 flex items-center justify-between bg-emerald-600/95 text-white px-3.5 py-2.5 rounded-xl shadow-2xl border border-emerald-400/50 backdrop-blur-md animate-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <CheckCircle2 className="h-5 w-5 text-white shrink-0 animate-bounce" />
                      <div className="leading-tight truncate">
                        <p className="text-xs font-black tracking-wide uppercase">Item Added To Cart!</p>
                        <p className="text-[11px] font-mono text-emerald-100 truncate">Barcode: {lastScannedCode}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-md shrink-0">
                      Keep scanning ➔
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Kirana Staff Control Bar: Live Cart Summary + Finish Button */}
        <div className="bg-card border-t border-border p-3 sm:p-4 shrink-0 flex flex-col gap-2.5">
          {cartCount !== undefined ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground font-medium">Cart:</span>
                    <span className="text-sm font-bold text-foreground">{cartCount} items</span>
                  </div>
                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400 leading-tight">
                    ₹{Number(cartTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <Button
                onClick={onClose}
                className="h-11 px-5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md flex items-center gap-2 text-sm"
              >
                <Check className="h-4 w-4" />
                Done Scanning
              </Button>
            </div>
          ) : null}

          {/* Quick Tools Row (AI OCR / Upload / Enter Code) */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={runOCR}
              className="flex-1 py-1.5 px-2 bg-muted/60 hover:bg-muted text-foreground text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 border border-border/50 transition-all"
            >
              <BrainCircuit className="h-3.5 w-3.5 text-primary" /> AI OCR Read
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-1.5 px-2 bg-muted/60 hover:bg-muted text-foreground text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 border border-border/50 transition-all"
            >
              <Upload className="h-3.5 w-3.5 text-blue-500" /> Photo Scan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className="flex-1 py-1.5 px-2 bg-muted/60 hover:bg-muted text-foreground text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 border border-border/50 transition-all"
            >
              <Keyboard className="h-3.5 w-3.5 text-amber-500" /> Type Code
            </button>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes scan {
          0% { top: 2%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 98%; opacity: 0; }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
}
