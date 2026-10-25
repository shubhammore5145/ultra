import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2, Store, Save, Phone, MapPin, Hash, ShieldCheck, UserPlus, Copy, CheckCircle, Smartphone, LogOut, Clock, MessageCircle, Send, Sparkles, Printer, Barcode, Bluetooth, Usb, Volume2, VolumeX, CheckCircle2, Play, Sliders } from 'lucide-react';
// Firebase removed
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../contexts/PlanContext';
import { api } from '../lib/api';

export default function Settings() {
  const { userData, shopData, logout } = useAuth();
  const { plan, canAccess, openUpgradeModal, maxStaffAllowed } = usePlan();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    shopName: '',
    ownerName: '',
    phone: '',
    address: '',
    gstNumber: '',
    upiId: '',
    publicUrl: ''
  });

  // POS Hardware State (Thermal Printer & Barcode Scanner Gun)
  const [hardwareSettings, setHardwareSettings] = useState({
    paperSize: '80mm', // '80mm' | '58mm'
    printerType: 'usb', // 'usb' | 'bluetooth'
    autoPrintReceipt: true,
    receiptHeader: '',
    receiptFooter: '',
    bluetoothDeviceName: '',
    scannerBeep: true,
    scannerAutoAdd: true
  });
  const [savingHardware, setSavingHardware] = useState(false);
  const [bluetoothConnecting, setBluetoothConnecting] = useState(false);
  const [isPrintingTest, setIsPrintingTest] = useState(false);

  // Barcode Scanner Live Testing
  const [scannerTestInput, setScannerTestInput] = useState('');
  const [scannerResults, setScannerResults] = useState<{
    code: string;
    time: string;
    product?: any;
  }[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);

  const [staffList, setStaffList] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<any>(null);
  const [startingWhatsapp, setStartingWhatsapp] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // WhatsApp Summary & Bill Settings
  const [whatsappSettings, setWhatsappSettings] = useState({
    summaryEnabled: true,
    summaryTime: '21:30',
    summaryPhone: '',
    billDelaySeconds: 5
  });
  const [savingWaSettings, setSavingWaSettings] = useState(false);

  const fetchStaff = async () => {
    setLoadingStaff(true);
    try {
      const data = await api.staff.list();
      setStaffList(data);
    } catch (err) {
      console.error('Failed to load staff list', err);
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleRemoveStaff = async (uid: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove ${name} from your shop?`)) {
      try {
        await api.staff.remove(uid);
        alert(`${name} removed successfully.`);
        fetchStaff();
      } catch (err: any) {
        alert(err.message || 'Failed to remove staff.');
      }
    }
  };

  const fetchWhatsappStatus = async () => {
    try {
      if (!shopData?.shopId) return;
      const data = await api.whatsapp.status(shopData.shopId);
      setWhatsappStatus(data);
    } catch (err) {
      console.error('Error fetching WA status', err);
    }
  };

  useEffect(() => {
    if (shopData) {
      setFormData({
        shopName: shopData.shopName || shopData.name || '',
        ownerName: shopData.ownerName || '',
        phone: shopData.phone || '',
        address: shopData.address || '',
        gstNumber: shopData.gstNumber || '',
        upiId: shopData.upiId || '',
        publicUrl: (shopData as any).publicUrl || ''
      });
      // Load WhatsApp settings from shop.settings JSON
      const settings = (shopData as any).settings || {};
      setWhatsappSettings({
        summaryEnabled: settings.whatsappSummaryEnabled !== false,
        summaryTime: settings.whatsappSummaryTime || '21:30',
        summaryPhone: settings.whatsappSummaryPhone || shopData.phone || '',
        billDelaySeconds: settings.billDelaySeconds ?? 5
      });

      // Load Hardware Settings
      setHardwareSettings({
        paperSize: settings.paperSize || (shopData as any).receiptPaperSize || '80mm',
        printerType: settings.printerType || 'usb',
        autoPrintReceipt: settings.autoPrintReceipt !== false,
        receiptHeader: settings.receiptHeader || (shopData as any).receiptHeader || '',
        receiptFooter: settings.receiptFooter || (shopData as any).receiptFooter || '',
        bluetoothDeviceName: settings.bluetoothDeviceName || '',
        scannerBeep: settings.scannerBeep !== false,
        scannerAutoAdd: settings.scannerAutoAdd !== false
      });

      // Fetch all products for scanner testing
      api.products.list().then(prods => {
        if (Array.isArray(prods)) setAllProducts(prods);
      }).catch(() => {});

      setLoading(false);
      fetchStaff();
      
      // Fetch status every 3 seconds
      fetchWhatsappStatus();
      const interval = setInterval(fetchWhatsappStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [shopData]);

  // ── Hardware Helper Functions ──────────────────────────────
  const playScannerBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1750, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
  };

  const handleConnectBluetooth = async () => {
    if (!navigator.bluetooth) {
      alert('Web Bluetooth API is supported in Google Chrome, Microsoft Edge, and Android Chrome. Please use Chrome browser.');
      return;
    }
    setBluetoothConnecting(true);
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455'
        ]
      });
      setHardwareSettings(prev => ({
        ...prev,
        printerType: 'bluetooth',
        bluetoothDeviceName: device.name || 'Bluetooth Thermal Printer'
      }));
      alert(`Bluetooth Thermal Printer "${device.name || 'Printer'}" जोडला गेला! ✅`);
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        alert('Bluetooth Connection error: ' + (err.message || 'Device pair failed'));
      }
    } finally {
      setBluetoothConnecting(false);
    }
  };

  const handlePrintTestReceipt = () => {
    setIsPrintingTest(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setIsPrintingTest(false), 800);
    }, 250);
  };

  const handleScannerTest = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = scannerTestInput.trim();
    if (!code) return;

    if (hardwareSettings.scannerBeep) {
      playScannerBeep();
    }

    const matched = allProducts.find(p => 
      (p.barcode && p.barcode.trim().toLowerCase() === code.toLowerCase()) ||
      (p.shortCode && String(p.shortCode).trim() === code) ||
      (p.sku && p.sku.trim().toLowerCase() === code.toLowerCase())
    );

    setScannerResults(prev => [
      {
        code,
        time: new Date().toLocaleTimeString('en-IN'),
        product: matched
      },
      ...prev.slice(0, 4)
    ]);

    setScannerTestInput('');
  };

  const handleSaveHardware = async () => {
    setSavingHardware(true);
    try {
      await api.shops.update({
        name: formData.shopName,
        ownerName: formData.ownerName,
        phone: formData.phone,
        address: formData.address,
        upiId: formData.upiId,
        publicUrl: formData.publicUrl,
        receiptHeader: hardwareSettings.receiptHeader,
        receiptFooter: hardwareSettings.receiptFooter,
        receiptPaperSize: hardwareSettings.paperSize,
        settings: {
          ...((shopData as any)?.settings || {}),
          ...hardwareSettings
        }
      });
      alert('हार्डवेअर (प्रिंटर & बारकोड स्कॅनर) सेटिंग्ज सेव्ह झाल्या! ✅');
    } catch (err: any) {
      alert('सेटिंग्ज सेव्ह करण्यात अडचण आली: ' + (err.message || 'Error'));
    } finally {
      setSavingHardware(false);
    }
  };

  const handleStartWhatsapp = async () => {
    if (!canAccess('whatsapp_bills')) {
      openUpgradeModal('whatsapp_bills');
      return;
    }
    setStartingWhatsapp(true);
    try {
      await api.whatsapp.start(shopData?.shopId);
      for (let i = 0; i < 4; i++) {
        await new Promise(r => setTimeout(r, 1200));
        await fetchWhatsappStatus();
      }
    } catch (err: any) {
      alert('Failed to start WhatsApp bot: ' + (err.message || 'Error'));
    } finally {
      setStartingWhatsapp(false);
    }
  };

  const handleLogoutWhatsapp = async () => {
    try {
      await api.whatsapp.logout(shopData?.shopId);
      fetchWhatsappStatus();
    } catch (err) {
      alert('Failed to logout WhatsApp bot.');
    }
  };

  const handleSendTestMessage = async () => {
    if (!canAccess('whatsapp_bills')) {
      openUpgradeModal('whatsapp_bills');
      return;
    }
    if (!testPhone || testPhone.trim().length !== 10) {
      alert('कृपया वैध 10-अंकी मोबाइल नंबर टाका');
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      await api.whatsapp.send(
        testPhone,
        `🏪 *${formData.shopName || 'Kirana Store'}*\n\n✅ *WhatsApp Bot Test Successful!*\nआपला किराणा ऑटो व्हॉट्सअॅप बॉट यशस्वीरित्या काम करत आहे.`,
        shopData?.shopId
      );
      setTestResult('व्हॉट्सअॅप चाचणी मेसेज यशस्वीरित्या पाठवला! ✅');
    } catch (e: any) {
      setTestResult(`त्रुटी: ${e.message}`);
    } finally {
      setTestSending(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopData?.shopId) return;

    setSaving(true);
    try {
      await api.shops.update({
        name: formData.shopName,
        ownerName: formData.ownerName,
        phone: formData.phone,
        address: formData.address,
        gstNumber: formData.gstNumber?.trim() || null,
        upiId: formData.upiId,
        publicUrl: formData.publicUrl.trim().replace(/\/$/, ''), // remove trailing slash
        settings: {
          ...((shopData as any)?.settings || {}),
          whatsappSummaryEnabled: whatsappSettings.summaryEnabled,
          whatsappSummaryTime: whatsappSettings.summaryTime,
          whatsappSummaryPhone: whatsappSettings.summaryPhone,
          billDelaySeconds: whatsappSettings.billDelaySeconds
        }
      });
      alert("Settings updated successfully!");
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Store className="h-8 w-8" /> Shop Settings
        </h1>
        <p className="text-muted-foreground">Manage your shop profile, address, and GST details.</p>
      </div>

      <div className="bg-primary/10 border border-primary/20 rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-primary flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Shop Access Code (Shop ID)
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Give this code to your cashiers/staff when they sign up to join your shop.
          </p>
        </div>
        
        <div className="bg-background px-4 py-2 rounded-lg border font-mono font-bold select-all flex-shrink-0 text-foreground">
          {shopData?.shopId}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="bg-card text-card-foreground border rounded-xl p-6 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Shop Name *</label>
              <Input 
                required
                value={formData.shopName}
                onChange={e => setFormData({...formData, shopName: e.target.value})}
                placeholder="Kirana Store"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Owner Name *</label>
              <Input 
                required
                value={formData.ownerName}
                onChange={e => setFormData({...formData, ownerName: e.target.value})}
                placeholder="Ramesh Bhai"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" /> Contact Number
              </label>
              <Input 
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                placeholder="Shop Contact Number"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" /> GST Number
              </label>
              <Input 
                value={formData.gstNumber}
                onChange={e => setFormData({...formData, gstNumber: e.target.value})}
                placeholder="Optional GSTIN"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" /> UPI ID (For Digital Payments)
              </label>
              <Input 
                value={formData.upiId}
                onChange={e => setFormData({...formData, upiId: e.target.value})}
                placeholder="e.g. 9876543210@ybl or shopname@sbi"
                className="bg-background border-muted focus:ring-primary/50"
              />
            </div>
            <div className="space-y-2 md:col-span-2 p-4 rounded-xl border border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Smartphone className="h-4 w-4 text-primary" /> Deployed Website URL (For Customer WhatsApp Receipts)
                </label>
                {window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setFormData(prev => ({ ...prev, publicUrl: window.location.origin }))}
                  >
                    Use Current Domain
                  </Button>
                )}
              </div>
              <Input 
                value={formData.publicUrl}
                onChange={e => setFormData({...formData, publicUrl: e.target.value})}
                placeholder="e.g. https://ultra-u3ej.onrender.com"
                className="bg-background border-muted font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Enter your live deployed URL (e.g. <code>https://ultra-u3ej.onrender.com</code>). Customers will receive this link on WhatsApp to view and download their PDF bills.
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" /> Shop Address
              </label>
              <Input 
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                placeholder="Complete shop address for bills"
              />
            </div>
          </div>

          <div className="pt-4 border-t flex justify-end">
            <Button type="submit" disabled={saving} className="w-full md:w-auto">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        </form>
      )}

      {/* ── POS Hardware: Thermal Printer & Barcode Scanner ── */}
      <div className="bg-card text-card-foreground border rounded-xl shadow-sm mt-8 overflow-hidden">
        <div className="p-6 border-b bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-primary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Printer className="h-6 w-6 text-amber-500" /> POS Hardware: Thermal Printer & Barcode Scanner
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              थर्मल बिल प्रिंटर (58mm / 80mm, USB/Bluetooth) आणि बारकोड स्कॅनर गन जोडा, टेस्ट करा व सेव्ह करा.
            </p>
          </div>
          <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-semibold self-start sm:self-auto flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> Hardware Ready
          </span>
        </div>

        <div className="p-6 space-y-8">
          {/* 1. THERMAL PRINTER SETUP */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                <Printer className="h-5 w-5 text-primary" /> 1. Thermal Printer Setup (थर्मल प्रिंटर)
              </h3>
              <span className="text-xs text-muted-foreground font-mono">58mm / 80mm ESC-POS</span>
            </div>

            {/* Connection Mode Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                onClick={() => setHardwareSettings(prev => ({ ...prev, printerType: 'usb' }))}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${hardwareSettings.printerType === 'usb' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-muted-foreground/30'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${hardwareSettings.printerType === 'usb' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                    <Usb className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">USB / Windows Driver Print</h4>
                    <p className="text-xs text-muted-foreground">Standard Cable (TVS, Everycom, POS-80, Epson)</p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span> 
                  Plug & Play — संगणकाला USB केबल जोडा, थेट 1-Click प्रिंट चालते.
                </div>
              </div>

              <div 
                onClick={() => setHardwareSettings(prev => ({ ...prev, printerType: 'bluetooth' }))}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${hardwareSettings.printerType === 'bluetooth' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-muted-foreground/30'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${hardwareSettings.printerType === 'bluetooth' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <Bluetooth className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">Bluetooth Wireless Printer</h4>
                      <p className="text-xs text-muted-foreground">MPT-II, Portable 58mm/80mm Bluetooth</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                    {hardwareSettings.bluetoothDeviceName ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        Connected: {hardwareSettings.bluetoothDeviceName}
                      </span>
                    ) : (
                      'ब्लूटूथ प्रिंटर शोधून जोडा'
                    )}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConnectBluetooth();
                    }}
                    disabled={bluetoothConnecting}
                    className="h-7 text-xs border-primary/40 text-primary hover:bg-primary/10 shrink-0"
                  >
                    {bluetoothConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Bluetooth className="h-3.5 w-3.5 mr-1" />}
                    {hardwareSettings.bluetoothDeviceName ? 'Re-pair' : 'Pair Bluetooth'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Paper Size & Auto-Print Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30 border">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Paper Width (कागदाचा आकार)</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setHardwareSettings(prev => ({ ...prev, paperSize: '80mm' }))}
                    className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${hardwareSettings.paperSize === '80mm' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background hover:bg-muted text-muted-foreground'}`}
                  >
                    80mm (3-Inch Standard) ⭐
                  </button>
                  <button
                    type="button"
                    onClick={() => setHardwareSettings(prev => ({ ...prev, paperSize: '58mm' }))}
                    className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold transition-all ${hardwareSettings.paperSize === '58mm' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background hover:bg-muted text-muted-foreground'}`}
                  >
                    58mm (2-Inch Mini)
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  सुपरमार्केट/मोठ्या काऊंटरसाठी 80mm आणि छोट्या हँडहेल्ड प्रिंटरसाठी 58mm निवडा.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Auto-Print on Checkout</Label>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setHardwareSettings(prev => ({ ...prev, autoPrintReceipt: !prev.autoPrintReceipt }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${hardwareSettings.autoPrintReceipt ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${hardwareSettings.autoPrintReceipt ? 'translate-x-6' : ''}`} />
                  </button>
                  <span className="text-xs font-medium">
                    {hardwareSettings.autoPrintReceipt ? 'चालू (बिल बनताच प्रिंट विंडो उघडा)' : 'बंद (मॅन्युअल प्रिंट बटण दाबावे लागेल)'}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  कॅशियरचा वेळ वाचवण्यासाठी ऑटो-प्रिंट चालू ठेवणे फायदेशीर ठरते.
                </p>
              </div>

              {/* Receipt Header & Footer */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Custom Receipt Header (बिलावर वर काय लिहायचे?)</Label>
                <Input
                  value={hardwareSettings.receiptHeader}
                  onChange={e => setHardwareSettings(prev => ({ ...prev, receiptHeader: e.target.value }))}
                  placeholder="उदा. || श्री गणेशाय नमः || किंवा Welcome!"
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Custom Receipt Footer (बिलाच्या खाली संदेश)</Label>
                <Input
                  value={hardwareSettings.receiptFooter}
                  onChange={e => setHardwareSettings(prev => ({ ...prev, receiptFooter: e.target.value }))}
                  placeholder="उदा. वस्तू बदलून मिळणार नाही. पुन्हा भेट द्या!"
                  className="text-xs font-mono"
                />
              </div>
            </div>

            {/* Test Print Action */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrintTestReceipt}
                className="w-full sm:w-auto text-xs font-bold border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 flex items-center gap-2"
              >
                <Printer className="h-4 w-4" /> Print Test Receipt (चाचणी पावती प्रिंट करा)
              </Button>

              <span className="text-xs text-muted-foreground text-center sm:text-right">
                थर्मल प्रिंटर योग्य जोडला आहे का हे पाहण्यासाठी टेस्ट प्रिंट बटण दाबा.
              </span>
            </div>
          </div>

          <hr className="border-border" />

          {/* 2. BARCODE SCANNER GUN SETUP */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                <Barcode className="h-5 w-5 text-primary" /> 2. Barcode Scanner Gun Setup & Live Test (बारकोड स्कॅनर गन)
              </h3>
              <span className="text-xs text-muted-foreground font-mono">USB / 2.4G / Bluetooth HID</span>
            </div>

            {/* Interactive Live Scanner Testing Zone */}
            <div className="p-5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> Live Barcode Scanner Test (इथे स्कॅन करून तपासा)
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    आपल्या हातातील बारकोड गन कोणत्याही प्रॉडक्टवर रोखा आणि बटण दाबा.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={playScannerBeep}
                  className="text-xs h-7 text-primary hover:bg-primary/10 self-start sm:self-auto flex items-center gap-1.5"
                >
                  <Volume2 className="h-3.5 w-3.5" /> Test Audio Beep
                </Button>
              </div>

              <form onSubmit={handleScannerTest} className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    value={scannerTestInput}
                    onChange={e => setScannerTestInput(e.target.value)}
                    placeholder="बारकोड गनने इथे स्कॅन करा किंवा नंबर टाईप करा..."
                    className="pl-9 font-mono text-sm bg-background border-primary/30 focus-visible:ring-primary"
                  />
                </div>
                <Button type="submit" className="shrink-0 text-xs px-4">
                  Test Scan
                </Button>
              </form>

              {/* Scanned Log Results */}
              {scannerResults.length > 0 ? (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-semibold text-muted-foreground">Recent Scans (अलीकडील स्कॅन):</div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {scannerResults.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-background border text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          <span className="font-mono font-bold text-foreground">{item.code}</span>
                          <span className="text-muted-foreground text-[10px]">({item.time})</span>
                        </div>
                        <div>
                          {item.product ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              ✓ {item.product.name} (₹{item.product.sellingPrice})
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              नवीन बारकोड (प्रॉडक्ट जोडण्यासाठी सज्ज)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-2 text-xs text-muted-foreground italic">
                  स्कॅनर गनचे बटण दाबताच इथे बारकोड आपोआप दिसेल आणि बीप आवाज येईल.
                </div>
              )}
            </div>

            {/* Scanner Preferences */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30 border">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <Volume2 className="h-4 w-4 text-primary" /> Audio Beep on Scan (स्कॅन बीप)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    वस्तू स्कॅन झाल्यावर सुपरमार्केटसारखा पुष्टी आवाज (Beep) वाजेल.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHardwareSettings(prev => ({ ...prev, scannerBeep: !prev.scannerBeep }))}
                  className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ml-2 ${hardwareSettings.scannerBeep ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${hardwareSettings.scannerBeep ? 'translate-x-6' : ''}`} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <Play className="h-4 w-4 text-primary" /> Auto-Add to Bill Cart (थेट बिलात जोडा)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    POS मध्ये स्कॅनरचे बटण दाबताच वस्तू आपोआप कार्टमध्ये जमा होईल.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHardwareSettings(prev => ({ ...prev, scannerAutoAdd: !prev.scannerAutoAdd }))}
                  className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ml-2 ${hardwareSettings.scannerAutoAdd ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${hardwareSettings.scannerAutoAdd ? 'translate-x-6' : ''}`} />
                </button>
              </div>
            </div>

            {/* Hardware Guide */}
            <div className="p-4 bg-muted/40 rounded-xl border text-xs text-muted-foreground space-y-2">
              <h4 className="font-bold text-foreground">💡 बारकोड स्कॅनर गन कशी जोडावी? (3 Easy Steps)</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Wired USB Gun:</strong> स्कॅनरची USB केबल लॅपटॉप/कम्प्युटरला लावा. कोणत्याही सॉफ्टवेअर किंवा ड्रायव्हरची गरज नाही (HID Plug & Play).</li>
                <li><strong>Wireless 2.4GHz Gun:</strong> स्कॅनरसोबत आलेला छोटा USB Dongle लॅपटॉपला लावा.</li>
                <li><strong>POS बिलिंग:</strong> POS स्क्रीनवर असताना स्कॅनरचे बटण दाबा. सर्च बारवर क्लिक करण्याचीही गरज नाही, वस्तू थेट बिलात ॲड होईल!</li>
              </ul>
            </div>
          </div>

          {/* Save Hardware Button */}
          <div className="pt-2 flex justify-end">
            <Button
              type="button"
              onClick={handleSaveHardware}
              disabled={savingHardware}
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-2 shadow-sm"
            >
              {savingHardware ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Hardware Settings (हार्डवेअर सेव्ह करा)
            </Button>
          </div>
        </div>
      </div>

      {/* Staff Accounts Section (Live Real Staff Management) */}
      <div className="bg-card text-card-foreground border rounded-xl shadow-sm mt-8 overflow-hidden">
        <div className="p-6 border-b bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" /> Staff Accounts & Security
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Manage who has access to your shop. Cashiers can only access billing and basic operations.</p>
          </div>
          <span className="text-xs px-3 py-1.5 rounded-full bg-background border font-semibold text-foreground self-start sm:self-auto shrink-0 shadow-sm">
            Staff Limit: {staffList.length} / {maxStaffAllowed >= 999 ? 'Unlimited' : maxStaffAllowed}
          </span>
        </div>
        <div className="p-6 space-y-6">
          {staffList.length >= maxStaffAllowed && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-700 dark:text-amber-300">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
                <span>
                  <strong>Staff quota reached:</strong> You have {staffList.length} / {maxStaffAllowed} team member accounts on your <strong>{plan.toUpperCase()}</strong> plan. Upgrade to invite more cashiers!
                </span>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-8 text-xs border-amber-500/40 text-amber-600 hover:bg-amber-500/15 shrink-0 font-bold self-start sm:self-auto" 
                onClick={() => openUpgradeModal('multi_staff')}
              >
                Upgrade Plan ⚡
              </Button>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Active Team Members</h3>
            {loadingStaff ? (
              <div className="flex justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : staffList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No staff accounts found.</p>
            ) : (
              staffList.map((member) => (
                <div key={member.uid} className="flex items-center justify-between p-4 border rounded-xl bg-background">
                  <div>
                    <p className="font-bold text-foreground">{member.displayName || member.email}</p>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider ${
                      member.role === 'admin' 
                        ? 'bg-primary/10 text-primary border border-primary/20' 
                        : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                    }`}>
                      {member.role || 'Staff'}
                    </span>
                    {member.role !== 'admin' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        onClick={() => handleRemoveStaff(member.uid, member.displayName || member.email)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="border-t pt-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Invite Staff / Cashier</h3>
            <p className="text-sm text-muted-foreground mb-4">Share your Shop ID with your cashier. They can select "Join Shop (Cashier)" during sign-up.</p>
            <div className="flex gap-3">
              <div className="flex-1 bg-muted rounded-lg px-4 py-3 font-mono text-sm text-foreground select-all border">
                {shopData?.shopId || 'Loading...'}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (shopData?.shopId) {
                    navigator.clipboard.writeText(shopData.shopId);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
              >
                {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (staffList.length >= maxStaffAllowed) {
                    openUpgradeModal('multi_staff');
                    return;
                  }
                  const text = `Hello! Join my shop on MartGPT. Sign up at the app and select 'Join Shop (Cashier)' with this Shop ID: ${shopData?.shopId}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                }}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                <UserPlus className="h-4 w-4 mr-2" /> WhatsApp Invite
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Bot Section */}
      <div className="bg-card text-card-foreground border rounded-xl shadow-sm mt-8 overflow-hidden">
        <div className="p-6 border-b bg-green-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-green-600">
              <Smartphone className="h-6 w-6" /> Auto WhatsApp Bot
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Scan the QR code to automatically send bills to customers without clicking "Send".</p>
          </div>
          {!canAccess('whatsapp_bills') && (
            <button
              onClick={() => openUpgradeModal('whatsapp_bills')}
              className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-all self-start sm:self-auto shrink-0 cursor-pointer"
            >
              🔒 Plus Plan Feature
            </button>
          )}
        </div>
    <div className="p-6">
      <div className="flex flex-col items-center justify-center p-6 border rounded-xl bg-background text-center">
        {!whatsappStatus || whatsappStatus.status === 'DISCONNECTED' ? (
          <div className="space-y-4 max-w-md mx-auto">
            <p className="text-muted-foreground">Bot is currently disconnected.</p>
            {whatsappStatus?.error && (
              <div className="bg-red-50 dark:bg-red-950/40 p-3 rounded-lg border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 font-mono text-left">
                <p className="font-bold mb-1">Bot Error:</p>
                <p className="break-words">{whatsappStatus.error}</p>
                {whatsappStatus.error.toLowerCase().includes('chrome') && (
                  <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300 font-sans">
                    💡 टीप: Render मोफत क्लाउड सर्व्हरवर Chromium ब्राऊझर इन्स्टॉल नसतो. ऑटो व्हॉट्सअॅप बॉट तुमच्या दुकानाच्या कॉम्प्युटरवर (Localhost) १००% ॲक्टिव्ह आहे.
                  </p>
                )}
              </div>
            )}
            <Button 
              onClick={handleStartWhatsapp} 
              disabled={startingWhatsapp}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 mx-auto"
            >
              {startingWhatsapp ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting WhatsApp Bot...
                </>
              ) : (
                'Start WhatsApp Bot'
              )}
            </Button>
          </div>
        ) : whatsappStatus.status === 'PAIRING' ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-green-600 mb-4" />
            <p className="font-bold text-green-600 text-lg">QR Scanned! Linking Device...</p>
            <p className="text-muted-foreground text-sm mt-2">कृपया थांबा, WhatsApp connect होत आहे...</p>
          </>
        ) : whatsappStatus.status === 'CONNECTING' ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
            <p className="font-bold text-blue-600 text-lg">Reconnecting...</p>
            <p className="text-muted-foreground text-sm mt-2">WhatsApp पुन्हा connect होत आहे, कृपया थांबा.</p>
          </>
        ) : whatsappStatus.status === 'INITIALIZING' ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-green-600 mb-4" />
            <p className="text-muted-foreground">Initializing WhatsApp Client... Please wait.</p>
          </>
        ) : whatsappStatus.status === 'NEEDS_QR' ? (
          <>
            <p className="font-bold text-lg mb-4">Scan this QR Code in WhatsApp App</p>
            {whatsappStatus.qr ? (
              <div className="p-4 bg-white rounded-lg border">
                <img src={whatsappStatus.qr} alt="WhatsApp QR Code" className="w-64 h-64" />
              </div>
            ) : (
              <Loader2 className="h-8 w-8 animate-spin" />
            )}
            <p className="text-sm text-muted-foreground mt-4">Open WhatsApp {'->'} Linked Devices {'->'} Link a Device</p>
          </>
        ) : whatsappStatus.status === 'AUTHENTICATED' || whatsappStatus.status === 'CONNECTED' ? (
          <div className="w-full max-w-md mx-auto space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h3 className="text-xl font-bold text-green-600">Connected & Ready!</h3>
            <p className="text-muted-foreground text-sm">
              Your bot is active. Bills will be sent automatically to customers after checkout.
            </p>
            {whatsappStatus.info?.phone && (
              <div className="bg-green-50 dark:bg-green-950/40 p-3 rounded-lg border border-green-200 dark:border-green-800 text-sm font-medium text-green-800 dark:text-green-300">
                Connected Number: <span className="font-mono font-bold">+{whatsappStatus.info.phone}</span>
                {whatsappStatus.info.pushname && ` (${whatsappStatus.info.pushname})`}
              </div>
            )}

            {/* Test WhatsApp Message Tool */}
            <div className="p-4 bg-muted/40 rounded-xl border border-border text-left space-y-3 mt-4">
              <Label className="text-xs font-semibold text-foreground">Send Test Message:</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="10-digit mobile number"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  className="font-mono text-sm"
                />
                <Button 
                  onClick={handleSendTestMessage} 
                  disabled={testSending || testPhone.length !== 10}
                  className="bg-green-600 hover:bg-green-700 text-white shrink-0 text-xs px-3"
                >
                  {testSending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Test'}
                </Button>
              </div>
              {testResult && (
                <p className={`text-xs font-medium ${testResult.includes('यशस्वीरित्या') ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                  {testResult}
                </p>
              )}
            </div>

            <Button onClick={handleLogoutWhatsapp} variant="outline" className="text-red-500 hover:text-red-600 hover:bg-red-50 mt-2">
              Disconnect Bot
            </Button>
          </div>
        ) : (
          <p>Unknown Status: {whatsappStatus.status}</p>
        )}
      </div>
    </div>
  </div>


      {/* WhatsApp Bill & Summary Settings */}
      <div className="bg-card text-card-foreground border rounded-xl shadow-sm mt-8 overflow-hidden">
        <div className="p-6 border-b bg-blue-500/10">
          <h2 className="text-xl font-bold flex items-center gap-2 text-blue-600">
            <Clock className="h-6 w-6" /> WhatsApp Bill & Summary Settings
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            बिल पाठवण्याचा delay आणि daily summary timing सेट करा.
          </p>
        </div>
        <div className="p-6 space-y-6">
          {/* Bill Delay Setting */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-base font-semibold">
              <Send className="h-4 w-4 text-green-600" /> Auto Bill Send Delay (Seconds)
            </Label>
            <p className="text-xs text-muted-foreground -mt-1">
              बिलिंग नंतर किती seconds मध्ये WhatsApp बिल पाठवायचे? (0 = तात्काळ)
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {[0, 3, 5, 8, 10].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setWhatsappSettings(prev => ({...prev, billDelaySeconds: val}))}
                  className={`px-4 py-2 rounded-lg border font-bold text-sm transition-all ${whatsappSettings.billDelaySeconds === val ? 'bg-green-600 text-white border-green-600 shadow-md scale-105' : 'bg-muted/50 text-foreground border-border hover:bg-muted'}`}
                >
                  {val === 0 ? 'तात्काळ' : `${val}s`}
                </button>
              ))}
              <Input
                type="number"
                min={0}
                max={30}
                value={whatsappSettings.billDelaySeconds}
                onChange={e => setWhatsappSettings(prev => ({...prev, billDelaySeconds: Math.min(30, Math.max(0, parseInt(e.target.value) || 0))}))}
                className="w-20 font-mono text-center"
              />
            </div>
          </div>

          <hr className="border-border" />

          {/* Summary Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-base font-semibold">
                <MessageCircle className="h-4 w-4 text-blue-600" /> Daily Business Summary (WhatsApp)
              </Label>
              {!canAccess('nightly_summary') && (
                <button
                  type="button"
                  onClick={() => openUpgradeModal('nightly_summary')}
                  className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 hover:bg-purple-500/25 transition-all flex items-center gap-1 cursor-pointer"
                >
                  ⚡ Pro Feature
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!canAccess('nightly_summary')) {
                    openUpgradeModal('nightly_summary');
                    return;
                  }
                  setWhatsappSettings(prev => ({...prev, summaryEnabled: !prev.summaryEnabled}));
                }}
                className={`relative w-12 h-6 rounded-full transition-colors ${whatsappSettings.summaryEnabled && canAccess('nightly_summary') ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${whatsappSettings.summaryEnabled && canAccess('nightly_summary') ? 'translate-x-6' : ''}`} />
              </button>
              <span className="text-sm font-medium">{whatsappSettings.summaryEnabled && canAccess('nightly_summary') ? 'चालू (Enabled)' : 'बंद (Disabled)'}</span>
            </div>

            {whatsappSettings.summaryEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl border">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Summary पाठवण्याची वेळ (IST)</Label>
                  <Input
                    type="time"
                    value={whatsappSettings.summaryTime}
                    onChange={e => setWhatsappSettings(prev => ({...prev, summaryTime: e.target.value}))}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    रोज या वेळी ऑटो summary WhatsApp वर येईल
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Summary कुठे पाठवायचे? (Phone)</Label>
                  <Input
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={whatsappSettings.summaryPhone}
                    onChange={e => setWhatsappSettings(prev => ({...prev, summaryPhone: e.target.value.replace(/\D/g, '').slice(0, 10)}))}
                    maxLength={10}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    मालकाचा WhatsApp नंबर (daily report इथे येईल)
                  </p>
                </div>
              </div>
            )}
          </div>

          <Button
            type="button"
            onClick={async () => {
              setSavingWaSettings(true);
              try {
                await api.shops.update({
                  name: formData.shopName,
                  ownerName: formData.ownerName,
                  phone: formData.phone,
                  address: formData.address,
                  upiId: formData.upiId,
                  publicUrl: formData.publicUrl,
                  settings: {
                    ...((shopData as any)?.settings || {}),
                    whatsappSummaryEnabled: whatsappSettings.summaryEnabled,
                    whatsappSummaryTime: whatsappSettings.summaryTime,
                    whatsappSummaryPhone: whatsappSettings.summaryPhone,
                    billDelaySeconds: whatsappSettings.billDelaySeconds
                  }
                });
                alert('WhatsApp settings saved! ✅');
              } catch {
                alert('Settings save failed.');
              } finally {
                setSavingWaSettings(false);
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2"
          >
            {savingWaSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save WhatsApp Settings
          </Button>
        </div>
      </div>

  {/* Account & Session Management */}
  <div className="bg-card text-card-foreground border rounded-xl shadow-sm mt-8 overflow-hidden">
    <div className="p-6 border-b flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Account & Session
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Manage your active login session and sign out.</p>
      </div>
    </div>
    <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20">
      <div>
        <p className="font-bold text-base text-foreground">{userData?.displayName || 'User'}</p>
        <p className="text-sm text-muted-foreground">
          Logged in as: <span className="capitalize font-semibold text-primary">{userData?.role || 'Staff'}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          Shop ID: <span className="bg-muted px-2 py-0.5 rounded border">{shopData?.shopId || 'N/A'}</span>
        </p>
      </div>
      <Button
        variant="destructive"
        onClick={() => {
          if (window.confirm('Are you sure you want to log out of MartGPT?')) {
            logout();
          }
        }}
        className="bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center gap-2 shadow-sm"
      >
        <LogOut className="h-4 w-4" /> Log Out of Account
      </Button>
    </div>
  </div>

  {/* Hidden Thermal Printer Test Slip for window.print() */}
  <div 
        id="test-receipt-template" 
        className={`hidden print:block absolute left-0 top-0 bg-white text-black text-[12px] leading-[1.3] font-mono z-0 p-3 ${hardwareSettings.paperSize === '58mm' ? 'w-[58mm]' : 'w-[80mm]'}`}
        style={{ width: hardwareSettings.paperSize === '58mm' ? '58mm' : '80mm' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          {hardwareSettings.receiptHeader && (
            <p style={{ margin: '0 0 3px 0', fontSize: '11px', fontWeight: 'bold' }}>{hardwareSettings.receiptHeader}</p>
          )}
          <h2 style={{ margin: '0 0 2px 0', fontSize: '16px', fontWeight: '900' }}>
            {(formData.shopName || shopData?.name || 'KIRANA STORE').toUpperCase()}
          </h2>
          {formData.address && (
            <p style={{ margin: '2px 0', fontSize: '10px' }}>{formData.address}</p>
          )}
          {formData.phone && (
            <p style={{ margin: '2px 0', fontSize: '10px' }}>Ph: {formData.phone}</p>
          )}
          <div style={{ margin: '6px 0 2px 0', fontWeight: 'bold', fontSize: '12px', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '3px 0' }}>
            *** PRINTER TEST SLIP ***
          </div>
        </div>

        <div style={{ fontSize: '11px', marginBottom: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span><strong>Date:</strong> {new Date().toLocaleDateString('en-IN')}</span>
            <span><strong>Time:</strong> {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span><strong>Paper:</strong> {hardwareSettings.paperSize.toUpperCase()}</span>
            <span><strong>Mode:</strong> {hardwareSettings.printerType.toUpperCase()}</span>
          </div>
        </div>

        <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>

        {/* Alignment & Font Test */}
        <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
          <div style={{ textAlign: 'left' }}>&lt; Left Alignment</div>
          <div style={{ textAlign: 'center' }}>= Center Alignment =</div>
          <div style={{ textAlign: 'right' }}>Right Alignment &gt;</div>
        </div>

        <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>

        {/* Characters & Currency Test */}
        <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Standard Rate:</span>
            <span>₹100.00</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
            <span>Bold Rate:</span>
            <span>₹250.00</span>
          </div>
        </div>

        <div style={{ borderBottom: '1.5px solid #000', margin: '6px 0' }}></div>

        <div style={{ textAlign: 'center', padding: '4px 0', fontSize: '12px', fontWeight: 'bold' }}>
          ✅ PRINTER WORKING PERFECTLY!
        </div>

        {hardwareSettings.receiptFooter && (
          <div style={{ textAlign: 'center', marginTop: '4px', fontSize: '10px' }}>
            {hardwareSettings.receiptFooter}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '9px', color: '#666' }}>
          --------------------------------<br />
          MartGPT POS • Cut Here
        </div>
      </div>
    </div>
  );
}
