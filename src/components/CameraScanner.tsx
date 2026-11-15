import { useEffect, useState, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import Tesseract from 'tesseract.js';
import { 
  X, Camera, CheckCircle2, Loader2, Zap, ZapOff, 
  Sparkles, BrainCircuit, Keyboard, RefreshCw, 
  Upload, AlertTriangle, ShieldAlert, ShoppingCart, 
  Check, Repeat, HelpCircle, Globe, Smartphone
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
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(() => {
    try { return localStorage.getItem('preferredCameraId'); } catch(e) { return null; }
  });
  
  // OCR & Image processing states
  const [isOCRProcessing, setIsOCRProcessing] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');

  // Manual entry state
  const [manualBarcode, setManualBarcode] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const loopRef = useRef<number>(0);
  const isMounted = useRef(true);

  // Refs to track states inside async event loops without stale closures
  const scanSuccessRef = useRef(false);
  const isOCRProcessingRef = useRef(false);
  const isContinuousRef = useRef(isContinuous);
  const onScanRef = useRef(onScan);

  // Cooldown tracker to prevent duplicate accidental scans of the exact same barcode in continuous mode
  const lastScannedCodeRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  useEffect(() => { onScanRef.current = onScan; }, [onScan]);
  useEffect(() => { scanSuccessRef.current = scanSuccess; }, [scanSuccess]);
  useEffect(() => { isOCRProcessingRef.current = isOCRProcessing; }, [isOCRProcessing]);
  useEffect(() => { isContinuousRef.current = isContinuous; }, [isContinuous]);

  const stopScanner = useCallback(() => {
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = 0;
    }
    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop();
      } catch (e) {}
      zxingControlsRef.current = null;
    }
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
      gainNode.gain.linearRampToValueAtTime(0.18, audioCtx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.08);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.08);
    } catch (e) {
      console.warn("[CameraScanner] Audio context blocked or unsupported:", e);
    }
  };

  /** Create ZXing reader with all supermarket barcode formats enabled */
  const createZxingReader = () => {
    const hints = new Map<DecodeHintType, any>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    return new BrowserMultiFormatReader(hints);
  };

  const handleFoundCode = (code: string) => {
    if (!isMounted.current) return;
    const cleanCode = code.trim();
    if (!cleanCode) return;

    const now = Date.now();
    // Cooldown check: if the exact same barcode was scanned within 1.3 seconds, ignore duplicate
    if (lastScannedCodeRef.current === cleanCode && (now - lastScannedTimeRef.current) < 1300) {
      return;
    }

    lastScannedCodeRef.current = cleanCode;
    lastScannedTimeRef.current = now;

    console.log('[CameraScanner] Barcode confirmed:', cleanCode);

    playBeep();

    // Visual feedback for cashier / staff
    setLastScannedCode(cleanCode);
    setFlashActive(true);
    setTimeout(() => {
      if (isMounted.current) setFlashActive(false);
    }, 450);

    if (isContinuousRef.current) {
      // Continuous mode: keep camera running and notify POS to add to cart
      onScanRef.current(cleanCode, false);
    } else {
      // Single scan mode: stop scanner, show success screen and auto-close
      stopScanner();
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

  /** Process barcode from uploaded photo or direct camera capture */
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
        // Scale canvas down to max 1280px to prevent mobile GPU OOM and ensure instant decoding
        const maxDim = 1280;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setIsOCRProcessing(false);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);

        // 1. Try native BarcodeDetector if available
        if ('BarcodeDetector' in window) {
          try {
            const detector = new (window as any).BarcodeDetector({
              formats: ['code_128', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e', 'code_39']
            });
            const barcodes = await detector.detect(canvas);
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
          const result = zxing.decodeFromCanvas(canvas);
          if (result && result.getText()) {
            setIsOCRProcessing(false);
            handleFoundCode(result.getText());
            return;
          }
        } catch (_zxingErr) {
          console.log('[CameraScanner] Image ZXing decode attempt failed, checking OCR');
        }

        // 3. Fallback to Tesseract OCR to read barcode digits directly
        setOcrStatus('AI reading barcode numbers...');
        try {
          const { data: { text } } = await Tesseract.recognize(canvas.toDataURL('image/jpeg', 0.85), 'eng');
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
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Check HTTPS security requirement for mobile browsers
    if (!window.isSecureContext && !isLocalhost) {
      const err = new Error('Insecure HTTP context - HTTPS required for camera');
      err.name = 'InsecureContextError';
      throw err;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = new Error('Camera API not supported on this browser');
      err.name = 'NotSupportedError';
      throw err;
    }

    const attempts: MediaStreamConstraints[] = [];

    // 1. Explicit preferred device if chosen and valid
    if (targetDeviceId) {
      attempts.push({
        video: { deviceId: { exact: targetDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      attempts.push({
        video: { deviceId: { exact: targetDeviceId } }
      });
    }

    // 2. High-speed 1080p Environment (Back) camera - standard for ultra-fast barcode recognition
    attempts.push({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    });

    // 3. Relaxed 720p environment camera
    attempts.push({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    // 4. Basic environment camera
    attempts.push({
      video: { facingMode: { ideal: 'environment' } }
    });

    // 5. Standard 720p any camera
    attempts.push({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } }
    });

    // 6. Bare video constraint (guaranteed fallback for laptops, webcams, front cams)
    attempts.push({
      video: true
    });

    let lastError: any = null;
    for (let i = 0; i < attempts.length; i++) {
      const constraints = attempts[i];
      try {
        console.log('[CameraScanner] Trying camera constraints attempt', i + 1, constraints);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) return stream;
      } catch (err: any) {
        console.warn('[CameraScanner] Constraint attempt failed:', err.name, err.message);
        lastError = err;
        
        // If preferred device failed, clear it so it doesn't break future attempts
        if (targetDeviceId && i <= 1) {
          try { localStorage.removeItem('preferredCameraId'); } catch(e) {}
        }
        
        // Only stop early on NotAllowedError if we are past deviceId attempts
        if ((err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') && (!targetDeviceId || i >= 2)) {
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
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // 1. Insecure HTTP Context (Mobile phone opened via http://192.168.x.x without HTTPS)
    if (name === 'InsecureContextError' || (!window.isSecureContext && !isLocalhost)) {
      return {
        type: 'insecure',
        title: 'HTTPS Connection Required For Phone Camera',
        message: 'Google Chrome and mobile browsers automatically block live camera video on local HTTP addresses (e.g. http://192.168.x.x). To use live camera on phone, open via HTTPS or Vercel link, or use the "Take Photo" button below.'
      };
    }

    // 2. Permission Denied
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || msg.toLowerCase().includes('permission')) {
      return {
        type: 'permission',
        title: 'Camera Permission Blocked',
        message: 'Your browser has blocked camera access. Please click the lock 🔒 or camera icon in your address bar, set Camera to "Allow", and click Retry.'
      };
    }

    // 3. No Camera Hardware
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return {
        type: 'notFound',
        title: 'No Camera Detected',
        message: 'No camera hardware was found on this phone or device. You can type the barcode number or upload a photo below.'
      };
    }

    // 4. Camera In Use by Another App
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return {
        type: 'inUse',
        title: 'Camera Is In Use',
        message: 'The camera is currently being used by another app (e.g. WhatsApp, Instagram, or another browser tab). Please close that app and retry.'
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

    // Stop existing stream if any
    stopScanner();

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

      // Safe video element initialization
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

      // ========= PRIMARY ENGINE 1: ZXing Direct Video Stream Decoder =========
      // This is the proven rock-solid engine that decodes EAN-13 / Code-128 in milliseconds
      try {
        const codeReader = createZxingReader();
        zxingReaderRef.current = codeReader;
        if (videoRef.current) {
          const controls = await codeReader.decodeFromVideoElement(
            videoRef.current,
            (result) => {
              if (!isMounted.current || scanSuccessRef.current || isOCRProcessingRef.current) return;
              if (result && result.getText()) {
                handleFoundCode(result.getText());
              }
            }
          );
          zxingControlsRef.current = controls;
        }
      } catch (zxingErr) {
        console.warn('[CameraScanner] ZXing live stream binding notice:', zxingErr);
      }

      // ========= TURBO ENGINE 2: Hardware Accelerated Native BarcodeDetector =========
      // Runs in parallel if supported by browser/device for instant sub-frame detection
      if ('BarcodeDetector' in window) {
        try {
          const nativeDetector = new (window as any).BarcodeDetector({
            formats: [
              'code_128', 'code_39', 'code_93', 'codabar', 
              'data_matrix', 'ean_13', 'ean_8', 'itf', 'pdf417', 
              'qr_code', 'upc_a', 'upc_e'
            ]
          });
          setUsingNative(true);

          const nativeScanLoop = async () => {
            if (!isMounted.current || scanSuccessRef.current || isOCRProcessingRef.current) return;
            const video = videoRef.current;
            if (video && video.readyState >= 2) {
              try {
                const barcodes = await nativeDetector.detect(video);
                if (barcodes.length > 0 && barcodes[0].rawValue) {
                  handleFoundCode(barcodes[0].rawValue);
                  if (!isContinuousRef.current) return;
                }
              } catch (_e) {}
            }
            loopRef.current = requestAnimationFrame(nativeScanLoop);
          };

          loopRef.current = requestAnimationFrame(nativeScanLoop);
        } catch (_e) {
          setUsingNative(false);
        }
      }

    } catch (err: any) {
      console.error('[CameraScanner] Camera access failed:', err);
      if (isMounted.current) {
        setErrorInfo(parseCameraError(err));
        setIsInitializing(false);
      }
    }
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
    try {
      localStorage.setItem('preferredCameraId', nextCameraId);
    } catch(e) {}
    setIsInitializing(true);
  };

  const runOCR = async () => {
    if (!videoRef.current) return;
    setIsOCRProcessing(true);
    setOcrStatus('Capturing image...');

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Canvas context failed");
      ctx.drawImage(videoRef.current, 0, 0);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.85);
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
    <div className="dark fixed inset-0 z-[100] flex flex-col justify-between sm:items-center sm:justify-center bg-black/95 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200 text-white">
      <div className="bg-slate-950 text-white p-0 rounded-none sm:rounded-2xl border-0 sm:border border-slate-800 shadow-2xl w-full sm:max-w-md h-full sm:h-auto max-h-full sm:max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        
        {/* Top Header */}
        <div className="bg-emerald-600 p-3.5 sm:p-4 text-white flex justify-between items-center shrink-0 shadow-md">
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
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 p-1.5 shrink-0 gap-1 text-white">
          <div className="flex gap-1 flex-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('camera');
                if (errorInfo) startCamera();
              }}
              className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'camera' 
                  ? 'bg-slate-800 text-emerald-400 shadow-xs border border-slate-700' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Camera className="h-3.5 w-3.5" /> Camera
            </button>
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="py-1.5 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 text-slate-400 hover:text-white transition-all"
            >
              <Upload className="h-3.5 w-3.5" /> Upload / Photo
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'manual' 
                  ? 'bg-slate-800 text-emerald-400 shadow-xs border border-slate-700' 
                  : 'text-slate-400 hover:text-white'
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
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Repeat className={`h-3 w-3 ${isContinuous ? 'animate-spin-slow' : ''}`} />
            {isContinuous ? 'Multi-Scan' : 'Single'}
          </button>
        </div>

        {/* Hidden File Input for Native Camera & Photo Scanning */}
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
        <div className="relative flex-1 bg-black min-h-[320px] sm:min-h-[380px] flex items-center justify-center overflow-hidden">
          {/* Single-Scan Mode Success Overlay */}
          {scanSuccess && !isContinuous ? (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-emerald-600 text-white animate-in zoom-in duration-300">
              <CheckCircle2 className="h-20 w-20 mb-3 animate-bounce" />
              <h2 className="text-3xl font-black tracking-widest uppercase drop-shadow-md">SCANNED!</h2>
              <p className="text-sm font-medium mt-1 text-emerald-100">Adding product to bill...</p>
            </div>
          ) : activeTab === 'manual' ? (
            /* Manual Barcode Entry Mode */
            <div className="w-full h-full p-6 flex flex-col items-center justify-center gap-4 z-10 bg-slate-950 text-white">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center ring-4 ring-emerald-500/10">
                <Keyboard className="h-7 w-7" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg text-white">Enter Barcode Number</h3>
                <p className="text-xs text-slate-400 mt-0.5">
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
                  className="h-14 text-2xl text-center font-mono tracking-widest font-bold border-2 border-slate-700 bg-slate-900 text-white focus-visible:ring-emerald-500"
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 h-11 bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
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
                    className="flex-1 h-11 font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    Add Product
                  </Button>
                </div>
              </form>
            </div>
          ) : errorInfo ? (
            /* High-Contrast Helpful Camera Error & Permission Recovery View */
            <div className="w-full max-w-sm p-5 sm:p-6 bg-slate-900/95 text-white rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col items-center text-center z-10 animate-in fade-in zoom-in-95 m-3">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3 ring-4 ring-amber-500/10">
                {errorInfo.type === 'permission' ? (
                  <ShieldAlert className="h-8 w-8 text-amber-400" />
                ) : errorInfo.type === 'insecure' ? (
                  <Globe className="h-8 w-8 text-blue-400" />
                ) : (
                  <AlertTriangle className="h-8 w-8 text-rose-400" />
                )}
              </div>
              
              <h3 className="font-bold text-lg text-white mb-1">{errorInfo.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-3">
                {errorInfo.message}
              </p>

              {/* Specific Guidance for Insecure HTTP on Mobile Network */}
              {errorInfo.type === 'insecure' && (
                <div className="w-full bg-slate-950/80 border border-slate-800 p-3 rounded-xl text-left text-xs text-slate-200 mb-4 space-y-1.5">
                  <p className="font-bold text-blue-400 flex items-center gap-1.5 text-xs">
                    <Smartphone className="h-3.5 w-3.5" /> मोबाईलवर कॅमेरा कसा वापरावा (Phone Options):
                  </p>
                  <p className="leading-snug text-[11px] text-slate-300">
                    <strong>पर्याय १:</strong> खालील <strong>"Upload / Take Photo"</strong> दाबा — याने फोनचा मूळ कॅमेरा थेट उघडतो आणि बारकोड स्कॅन होतो (कोणतीही अडचण येत नाही).
                  </p>
                  <p className="leading-snug text-[11px] text-slate-300">
                    <strong>पर्याय २:</strong> PC वर <code>npm run tunnel</code> रन करून मिळालेली सुरक्षित HTTPS लिंक फोनवर उघडा.
                  </p>
                </div>
              )}

              {/* Specific Guidance for Blocked Permissions */}
              {errorInfo.type === 'permission' && (
                <div className="w-full bg-slate-950/80 border border-slate-800 p-3 rounded-xl text-left text-xs text-slate-200 mb-4 space-y-1.5">
                  <p className="font-bold text-amber-400 flex items-center gap-1.5 text-xs">
                    <HelpCircle className="h-3.5 w-3.5" /> कॅमेरा कसा सुरू करावा (How to Unblock):
                  </p>
                  <p className="leading-snug text-[11px] text-slate-300">
                    1. ब्राउझरच्या वर <strong>Address Bar</strong> मध्ये <strong>Lock 🔒</strong> किंवा <strong>Camera ❌</strong> आयकॉन दाबा.
                  </p>
                  <p className="leading-snug text-[11px] text-slate-300">
                    2. <strong>Camera</strong> समोर <strong>Allow (चालू करा)</strong> निवडा.
                  </p>
                  <p className="leading-snug text-[11px] text-slate-300">
                    3. खालील <strong>"Try Camera Again"</strong> बटनावर टॅप करा.
                  </p>
                </div>
              )}

              <div className="w-full space-y-2.5">
                <Button 
                  onClick={startCamera} 
                  className="w-full h-11 font-bold flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg"
                >
                  <RefreshCw className="h-4 w-4" /> Try Camera Again
                </Button>

                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-11 font-medium flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700"
                >
                  <Upload className="h-4 w-4 text-emerald-400" /> Upload / Take Photo
                </Button>

                <Button 
                  variant="secondary" 
                  onClick={() => setActiveTab('manual')}
                  className="w-full h-11 font-medium flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"
                >
                  <Keyboard className="h-4 w-4 text-amber-400" /> Enter Barcode Manually
                </Button>
              </div>
            </div>
          ) : (
            /* Live Camera Stream View */
            <div className="w-full h-full flex flex-col items-center justify-center relative">
              {isInitializing && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 text-white/90 p-6 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-400 mb-3" />
                  <p className="text-sm font-semibold text-white">Starting Smartphone Camera...</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Please allow camera access permission in your browser if prompted
                  </p>
                </div>
              )}
              
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                <video 
                  ref={videoRef} 
                  playsInline
                  webkit-playsinline="true"
                  muted
                  autoPlay
                  className={`w-full h-full object-cover transition-opacity duration-300 ${isOCRProcessing ? 'opacity-30 blur-sm' : 'opacity-100'}`}
                />
                
                {/* Aiming Reticle / Laser Scanning Guide Overlay */}
                {!isInitializing && !isOCRProcessing && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
                    <div 
                      className={`w-[85%] max-w-[340px] h-44 rounded-2xl border-2 transition-all duration-200 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] ${
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
                    <BrainCircuit className="h-12 w-12 text-emerald-400 animate-pulse mb-3" />
                    <p className="font-bold tracking-wide text-sm">{ocrStatus}</p>
                  </div>
                )}

                {/* Floating Top Left Badge: Engine Indicator */}
                {!isInitializing && !isOCRProcessing && (
                  <div className="absolute top-3 left-3 flex flex-col gap-1 z-20">
                    <div className="px-2.5 py-1 bg-black/70 backdrop-blur-md rounded-lg text-[10px] text-white font-mono flex items-center gap-1.5 border border-white/15 shadow-md">
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
                            ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.6)]' 
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
                  <div className="absolute bottom-4 left-3 right-3 z-30 flex items-center justify-between bg-emerald-600 text-white px-3.5 py-2.5 rounded-xl shadow-2xl border border-emerald-400/50 backdrop-blur-md animate-in slide-in-from-bottom-2 duration-150">
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
              
              {/* Bottom Quick-Action Toolbar inside camera view */}
              {!isInitializing && !isOCRProcessing && (
                <div className="p-2.5 bg-slate-950/90 border-t border-slate-800 flex items-center justify-around w-full shrink-0 z-20">
                  <Button 
                    size="sm"
                    onClick={runOCR} 
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs h-9 px-3"
                  >
                    <BrainCircuit className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                    AI OCR Read
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => fileInputRef.current?.click()} 
                    variant="outline"
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs h-9 px-3"
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5 text-blue-400" />
                    Photo Scan
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => setActiveTab('manual')} 
                    variant="outline"
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs h-9 px-3"
                  >
                    <Keyboard className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
                    Type Code
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Cart Status & Done Scanning Action Bar */}
        <div className="bg-slate-900 border-t border-slate-800 p-3 sm:p-4 flex items-center justify-between shrink-0 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">
                Cart: <span className="text-white font-bold">{cartCount !== undefined ? cartCount : 0} items</span>
              </p>
              <p className="text-base font-black text-emerald-400 leading-tight">
                ₹{cartTotal !== undefined ? cartTotal.toFixed(2) : '0.00'}
              </p>
            </div>
          </div>

          <Button
            onClick={onClose}
            className="h-11 px-5 font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg flex items-center gap-2"
          >
            <Check className="h-4 w-4" /> Done Scanning
          </Button>
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
