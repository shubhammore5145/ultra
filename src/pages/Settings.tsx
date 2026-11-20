import { useState, useEffect, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2, Store, Save, Phone, MapPin, Hash, ShieldCheck, UserPlus, Copy, CheckCircle, Smartphone, LogOut, Clock, MessageCircle, Send, Sparkles, Printer, Barcode, Bluetooth, Usb, Volume2, CheckCircle2, Play, Sliders, Download, Upload, Database, HardDrive, RefreshCw, AlertCircle, Shield, X, QrCode, Cloud, Server } from 'lucide-react';
import { APP_PERMISSIONS, STAFF_ROLE_PRESETS } from '../lib/permissions';
// Firebase removed
import { useAuth } from '../contexts/AuthContext';
import { api, getOfflineQueue, syncOfflineQueue } from '../lib/api';
import { getGreenApiConfig, saveGreenApiConfig, checkGreenApiStatus, getGreenApiQrCode, logoutGreenApi, sendGreenApiMessage } from '../lib/greenApi';
import type { GreenApiConfig, GreenApiStatus } from '../lib/greenApi';

export default function Settings() {
  const { userData, shopData, logout } = useAuth();
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

  // Green API & Multi-Provider WhatsApp State
  const [waProvider, setWaProvider] = useState<'green_api' | 'baileys'>('green_api');
  const [greenConfig, setGreenConfig] = useState<GreenApiConfig>({
    idInstance: '',
    apiTokenInstance: '',
    apiUrl: 'https://api.green-api.com',
    enabled: true
  });
  const [greenStatus, setGreenStatus] = useState<GreenApiStatus | null>(null);
  const [checkingGreen, setCheckingGreen] = useState(false);
  const [greenQrData, setGreenQrData] = useState<string | null>(null);
  const [loadingGreenQr, setLoadingGreenQr] = useState(false);
  const [savingGreen, setSavingGreen] = useState(false);

  // WhatsApp Summary & Bill Settings
  const [whatsappSettings, setWhatsappSettings] = useState({
    summaryEnabled: true,
    summaryTime: '21:30',
    summaryPhone: '',
    billDelaySeconds: 5
  });
  const [savingWaSettings, setSavingWaSettings] = useState(false);

  // Data Vault State
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOfflinePendingCount(getOfflineQueue().length);
  }, []);

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

  // Staff Permissions Modal State
  const [selectedStaffForPerms, setSelectedStaffForPerms] = useState<any | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const handleOpenPermissionsModal = (staff: any) => {
    setSelectedStaffForPerms(staff);
    const existingPerms = Array.isArray(staff.permissions) && staff.permissions.length > 0
      ? [...staff.permissions]
      : ['pos', 'bill_store', 'products', 'barcode_print', 'customers'];
    setEditingPermissions(existingPerms);
  };

  const handleTogglePermission = (permId: string) => {
    setEditingPermissions(prev => 
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
  };

  const handleApplyPreset = (presetPerms: string[]) => {
    setEditingPermissions([...presetPerms]);
  };

  const handleSaveStaffPermissions = async () => {
    if (!selectedStaffForPerms) return;
    setSavingPermissions(true);
    try {
      await api.staff.updatePermissions(selectedStaffForPerms.uid, editingPermissions);
      alert(`Permissions updated successfully for ${selectedStaffForPerms.displayName || selectedStaffForPerms.email}!`);
      setSelectedStaffForPerms(null);
      fetchStaff();
    } catch (err: any) {
      alert(err.message || 'Failed to update staff permissions.');
    } finally {
      setSavingPermissions(false);
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

      // Load Green API settings from shop settings or localStorage
      const savedGreen = getGreenApiConfig();
      const shopGreen = settings.greenApi;
      const initialGreen: GreenApiConfig = {
        idInstance: (shopGreen?.idInstance || savedGreen.idInstance || '').trim(),
        apiTokenInstance: (shopGreen?.apiTokenInstance || savedGreen.apiTokenInstance || '').trim(),
        apiUrl: (shopGreen?.apiUrl || savedGreen.apiUrl || 'https://api.green-api.com').trim(),
        enabled: shopGreen?.enabled !== undefined ? Boolean(shopGreen.enabled) : (savedGreen.enabled || Boolean(savedGreen.idInstance))
      };
      setGreenConfig(initialGreen);
      if (settings.whatsappProvider) {
        setWaProvider(settings.whatsappProvider);
      } else if (initialGreen.idInstance || initialGreen.enabled) {
        setWaProvider('green_api');
      }

      if (initialGreen.idInstance && initialGreen.apiTokenInstance) {
        checkGreenApiStatus(initialGreen).then(st => setGreenStatus(st)).catch(() => {});
      }

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
    const nav = navigator as any;
    if (!nav.bluetooth) {
      alert('Web Bluetooth API is supported in Google Chrome, Microsoft Edge, and Android Chrome. Please use Chrome browser.');
      return;
    }
    setBluetoothConnecting(true);
    try {
      const device = await nav.bluetooth.requestDevice({
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
      alert(`Bluetooth Thermal Printer "${device.name || 'Printer'}" connected! ✅`);
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
      alert('Hardware (Printer & Barcode Scanner) settings saved! ✅');
    } catch (err: any) {
      alert('Error saving settings: ' + (err.message || 'Error'));
    } finally {
      setSavingHardware(false);
    }
  };

  const handleStartWhatsapp = async () => {
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

  const handleCheckGreenApi = async () => {
    if (!greenConfig.idInstance || !greenConfig.apiTokenInstance) {
      alert('Please enter your Instance ID and API Token first.');
      return;
    }
    setCheckingGreen(true);
    try {
      const st = await checkGreenApiStatus(greenConfig);
      setGreenStatus(st);
      if (st.state === 'notAuthorized') {
        handleFetchGreenQr();
      }
    } catch (err: any) {
      setGreenStatus({
        state: 'error',
        isAuthorized: false,
        message: err.message
      });
    } finally {
      setCheckingGreen(false);
    }
  };

  const handleFetchGreenQr = async () => {
    setLoadingGreenQr(true);
    try {
      const res = await getGreenApiQrCode(greenConfig);
      setGreenQrData(res.qr);
      if (!res.qr && res.message) {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to fetch QR');
    } finally {
      setLoadingGreenQr(false);
    }
  };

  const handleSaveGreenApiSettings = async () => {
    setSavingGreen(true);
    try {
      saveGreenApiConfig(greenConfig);
      if (shopData?.shopId) {
        await api.shops.update({
          name: formData.shopName,
          ownerName: formData.ownerName,
          phone: formData.phone,
          address: formData.address,
          upiId: formData.upiId,
          publicUrl: formData.publicUrl,
          settings: {
            ...((shopData as any)?.settings || {}),
            greenApi: greenConfig,
            whatsappProvider: waProvider
          }
        });
      }
      alert('Green API settings saved successfully! ✅');
      if (greenConfig.idInstance && greenConfig.apiTokenInstance) {
        handleCheckGreenApi();
      }
    } catch (err: any) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setSavingGreen(false);
    }
  };

  const handleLogoutGreen = async () => {
    if (!confirm('Are you sure you want to disconnect Green API WhatsApp?')) return;
    try {
      await logoutGreenApi(greenConfig);
      setGreenStatus({
        state: 'notAuthorized',
        isAuthorized: false,
        message: 'Disconnected successfully.'
      });
      setGreenQrData(null);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleSendTestMessage = async () => {
    if (!testPhone || testPhone.trim().length !== 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      const msg = `🏪 *${formData.shopName || 'Kirana Store'}*\n\n✅ *WhatsApp Bot Test Successful!*\nYour store WhatsApp messaging is active and ready to deliver customer bills & receipts.\n\n_Delivery: ${waProvider === 'green_api' ? 'Green API Cloud (24/7)' : 'Baileys Local Bot'}_`;

      if (waProvider === 'green_api') {
        const res = await sendGreenApiMessage(testPhone, msg, greenConfig);
        if (res.success) {
          setTestResult(`WhatsApp test message delivered successfully! ✅ (ID: ${res.idMessage || 'sent'})`);
        } else {
          setTestResult(`Error: ${res.error || 'Failed to send'}`);
        }
      } else {
        await api.whatsapp.send(testPhone, msg, shopData?.shopId);
        setTestResult('WhatsApp test message sent successfully! ✅');
      }
    } catch (e: any) {
      setTestResult(`Error: ${e.message}`);
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

  const handleExportShopBackup = async () => {
    setIsExporting(true);
    try {
      const [products, customers, transactions, udhar, expenses, suppliers] = await Promise.all([
        api.products.list().catch(() => []),
        api.customers.list().catch(() => []),
        api.transactions.list().catch(() => []),
        api.udhar.list().catch(() => []),
        api.expenses.list().catch(() => []),
        api.suppliers.list().catch(() => [])
      ]);

      const backupData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        shopId: shopData?.shopId,
        shopInfo: {
          name: formData.shopName,
          owner: formData.ownerName,
          phone: formData.phone,
          address: formData.address,
          gstNumber: formData.gstNumber,
          upiId: formData.upiId
        },
        settings: {
          hardware: hardwareSettings,
          whatsapp: whatsappSettings
        },
        counts: {
          products: Array.isArray(products) ? products.length : 0,
          customers: Array.isArray(customers) ? customers.length : 0,
          transactions: Array.isArray(transactions) ? transactions.length : 0,
          udhar: Array.isArray(udhar) ? udhar.length : 0,
          expenses: Array.isArray(expenses) ? expenses.length : 0
        },
        data: {
          products: Array.isArray(products) ? products : [],
          customers: Array.isArray(customers) ? customers : [],
          transactions: Array.isArray(transactions) ? transactions : [],
          udhar: Array.isArray(udhar) ? udhar : [],
          expenses: Array.isArray(expenses) ? expenses : [],
          suppliers: Array.isArray(suppliers) ? suppliers : []
        }
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      const shopSlug = (formData.shopName || 'Shop').replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `MartGPT_Backup_${shopSlug}_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      alert(`✅ Full data backup saved successfully!\nCheck your downloads folder.\n(Products: ${backupData.counts.products}, Customers: ${backupData.counts.customers}, Bills: ${backupData.counts.transactions})`);
    } catch (err: any) {
      alert('Error downloading backup: ' + (err.message || 'Error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportShopBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const backup = JSON.parse(content);

        if (!backup.data || !Array.isArray(backup.data.products)) {
          alert('Invalid backup file! Please select a valid .json file generated from MartGPT.');
          return;
        }

        const prodsCount = backup.data.products?.length || 0;
        const custsCount = backup.data.customers?.length || 0;

        const confirmRestore = window.confirm(
          `Backup file detected:\n• Products: ${prodsCount}\n• Customers: ${custsCount}\n• Date: ${backup.exportedAt ? new Date(backup.exportedAt).toLocaleDateString('en-IN') : 'N/A'}\n\nDo you want to restore and import this data?`
        );

        if (!confirmRestore) return;

        setIsImporting(true);
        let importedProds = 0;
        for (const prod of (backup.data.products || [])) {
          try {
            await api.products.create({
              name: prod.name,
              barcode: prod.barcode || '',
              sellingPrice: prod.sellingPrice || prod.price || 0,
              purchasePrice: prod.purchasePrice || 0,
              stock: prod.stock || 0,
              unit: prod.unit || 'pcs',
              category: prod.category || 'General',
              isLoose: Boolean(prod.isLoose)
            });
            importedProds++;
          } catch {}
        }

        let importedCusts = 0;
        for (const cust of (backup.data.customers || [])) {
          try {
            await api.customers.create({
              name: cust.name,
              phone: cust.phone || '',
              address: cust.address || '',
              totalBalance: cust.totalBalance || 0
            });
            importedCusts++;
          } catch {}
        }

        alert(`✅ Restore complete!\n• Products restored: ${importedProds}/${prodsCount}\n• Customers restored: ${importedCusts}/${custsCount}`);
        window.location.reload();
      } catch (err: any) {
        alert('Error restoring backup: ' + (err.message || 'Invalid JSON'));
      } finally {
        setIsImporting(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleManualSyncOffline = async () => {
    setIsSyncingOffline(true);
    try {
      const res = await syncOfflineQueue();
      setOfflinePendingCount(res.remaining);
      alert(`Offline sync complete: ${res.synced} bills synced to cloud. Remaining: ${res.remaining}`);
    } catch {
      alert('Offline sync failed. Please check your internet connection.');
    } finally {
      setIsSyncingOffline(false);
    }
  };

  const handleClearCorruptCache = () => {
    if (window.confirm('Do you want to reset your local browser cache? (Your login will remain active)')) {
      const token = localStorage.getItem('auth_token');
      const user = localStorage.getItem('auth_user');
      const shop = localStorage.getItem('auth_shop');

      localStorage.clear();

      if (token) localStorage.setItem('auth_token', token);
      if (user) localStorage.setItem('auth_user', user);
      if (shop) localStorage.setItem('auth_shop', shop);

      alert('Cache cleared! Refreshing page...');
      window.location.reload();
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
              Configure thermal bill printer (58mm / 80mm, USB/Bluetooth) and barcode scanner gun.
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
                <Printer className="h-5 w-5 text-primary" /> 1. Thermal Printer Setup
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
                  Plug & Play — connect USB cable to computer for 1-click direct printing.
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
                      'Find & pair Bluetooth printer'
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
                <Label className="text-xs font-semibold">Paper Width</Label>
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
                  Choose 80mm for supermarket / billing counters and 58mm for small handheld printers.
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
                    {hardwareSettings.autoPrintReceipt ? 'Enabled (Auto-opens print window upon checkout)' : 'Disabled (Requires manual print button click)'}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Enabling auto-print saves cashier time during peak rush hours.
                </p>
              </div>

              {/* Receipt Header & Footer */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Custom Receipt Header</Label>
                <Input
                  value={hardwareSettings.receiptHeader}
                  onChange={e => setHardwareSettings(prev => ({ ...prev, receiptHeader: e.target.value }))}
                  placeholder="e.g. Welcome to MartGPT!"
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Custom Receipt Footer</Label>
                <Input
                  value={hardwareSettings.receiptFooter}
                  onChange={e => setHardwareSettings(prev => ({ ...prev, receiptFooter: e.target.value }))}
                  placeholder="e.g. Items once sold will not be returned. Thank you!"
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
                <Printer className="h-4 w-4" /> Print Test Receipt
              </Button>

              <span className="text-xs text-muted-foreground text-center sm:text-right">
                Click print test to verify the thermal printer is working.
              </span>
            </div>
          </div>

          <hr className="border-border" />

          {/* 2. BARCODE SCANNER GUN SETUP */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                <Barcode className="h-5 w-5 text-primary" /> 2. Barcode Scanner Gun Setup & Live Test
              </h3>
              <span className="text-xs text-muted-foreground font-mono">USB / 2.4G / Bluetooth HID</span>
            </div>

            {/* Interactive Live Scanner Testing Zone */}
            <div className="p-5 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> Live Barcode Scanner Test
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Point your barcode scanner gun at any product barcode and pull the trigger.
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
                    placeholder="Scan with barcode gun or type code..."
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
                  <div className="text-xs font-semibold text-muted-foreground">Recent Scans:</div>
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
                              New Barcode (Ready to assign to product)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-2 text-xs text-muted-foreground italic">
                  Scanned barcodes will appear here automatically with a confirmation beep.
                </div>
              )}
            </div>

            {/* Scanner Preferences */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30 border">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <Volume2 className="h-4 w-4 text-primary" /> Audio Beep on Scan
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Plays an authentic supermarket confirmation beep when a product is scanned.
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
                    <Play className="h-4 w-4 text-primary" /> Auto-Add to Bill Cart
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Automatically adds item to cart when scanned in POS.
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
              <h4 className="font-bold text-foreground">💡 How to Connect Barcode Scanner Gun (3 Easy Steps)</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Wired USB Gun:</strong> Plug the scanner's USB cable into your laptop/PC. No driver required (HID Plug & Play).</li>
                <li><strong>Wireless 2.4GHz Gun:</strong> Plug the included 2.4GHz USB wireless dongle into your PC.</li>
                <li><strong>POS Billing:</strong> Press the trigger on the POS screen. The item is automatically added to cart without even clicking the search bar!</li>
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
              Save Hardware Settings
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
            Active Staff: {staffList.length}
          </span>
        </div>
        <div className="p-6 space-y-6">

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
                <div key={member.uid} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl bg-background gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-foreground text-sm sm:text-base">{member.displayName || member.email}</p>
                      <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${
                        member.role === 'admin' 
                          ? 'bg-primary/10 text-primary border border-primary/20' 
                          : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      }`}>
                        {member.role || 'Staff'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                    {member.role !== 'admin' && (
                      <p className="text-[11px] text-primary/80 font-medium mt-1 flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        {Array.isArray(member.permissions) && member.permissions.length > 0 
                          ? `${member.permissions.length} module permissions assigned`
                          : 'Standard Cashier access (Default)'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {member.role !== 'admin' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs h-8 border-primary/30 text-primary hover:bg-primary/10 flex items-center gap-1"
                        onClick={() => handleOpenPermissionsModal(member)}
                      >
                        <Shield className="h-3.5 w-3.5" /> Permissions
                      </Button>
                    )}
                    {member.role !== 'admin' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
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

      {/* WhatsApp Delivery & Bot Section */}
      <div className="bg-card text-card-foreground border rounded-xl shadow-sm mt-8 overflow-hidden">
        <div className="p-6 border-b bg-green-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-green-600">
              <Smartphone className="h-6 w-6" /> WhatsApp Cloud Delivery & Bot
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Deliver digital bills, receipts, and Udhar payment reminders automatically to customer phones.
            </p>
          </div>
        </div>

        {/* Provider Switcher Tabs */}
        <div className="flex border-b border-border bg-muted/20 px-6 pt-3 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setWaProvider('green_api')}
            className={`pb-3 px-4 font-bold text-sm border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              waProvider === 'green_api'
                ? 'border-green-600 text-green-600 dark:text-green-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Cloud className="h-4 w-4" /> Green API (Cloud - Recommended)
            <span className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 font-extrabold px-2 py-0.5 rounded-full border border-green-500/30">
              24/7 Cloud
            </span>
          </button>
          <button
            type="button"
            onClick={() => setWaProvider('baileys')}
            className={`pb-3 px-4 font-bold text-sm border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              waProvider === 'baileys'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Server className="h-4 w-4" /> Baileys Bot (Local Server)
            <span className="text-[10px] bg-muted text-muted-foreground font-semibold px-2 py-0.5 rounded-full border border-border">
              Self-Hosted
            </span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {waProvider === 'green_api' ? (
            /* ── GREEN API CLOUD PROVIDER ── */
            <div className="space-y-6">
              {/* Status Header */}
              {greenStatus?.isAuthorized ? (
                <div className="p-6 bg-green-500/10 dark:bg-green-950/30 rounded-2xl border border-green-300 dark:border-green-800 text-center space-y-3">
                  <CheckCircle className="h-14 w-14 text-green-600 dark:text-green-400 mx-auto" />
                  <h3 className="text-xl font-bold text-green-700 dark:text-green-300">
                    Green API WhatsApp Active & Connected! 🟢
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                    Your WhatsApp account is active in the cloud. Customer bills, receipts, and Udhar reminders will be delivered 24/7 automatically without keeping any computer running.
                  </p>
                  {greenStatus.phone && (
                    <div className="inline-block bg-white dark:bg-black/50 px-4 py-2 rounded-xl border border-green-300 dark:border-green-800 font-mono font-bold text-green-800 dark:text-green-300 text-sm shadow-2xs">
                      Linked Number: +{greenStatus.phone} {greenStatus.pushname && `(${greenStatus.pushname})`}
                    </div>
                  )}
                  <div className="flex justify-center gap-3 pt-2">
                    <Button
                      type="button"
                      onClick={handleCheckGreenApi}
                      disabled={checkingGreen}
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                    >
                      {checkingGreen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Refresh Status
                    </Button>
                    <Button
                      type="button"
                      onClick={handleLogoutGreen}
                      variant="outline"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      Unlink Device
                    </Button>
                  </div>
                </div>
              ) : greenStatus?.state === 'notAuthorized' ? (
                <div className="p-6 bg-amber-500/10 dark:bg-amber-950/30 rounded-2xl border border-amber-300 dark:border-amber-800 text-center space-y-4">
                  <AlertCircle className="h-12 w-12 text-amber-600 dark:text-amber-400 mx-auto" />
                  <h3 className="text-lg font-bold text-amber-800 dark:text-amber-300">
                    Scan QR Code to Link WhatsApp
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Instance is active. Please open WhatsApp on your phone and scan the QR code to connect your account.
                  </p>
                  {greenQrData ? (
                    <div className="inline-block p-4 bg-white rounded-2xl shadow-md border mx-auto">
                      <img src={greenQrData} alt="Green API WhatsApp QR Code" className="w-64 h-64 mx-auto" />
                      <p className="text-xs text-gray-500 mt-2 font-mono">Open WhatsApp &gt; Linked Devices &gt; Link a Device</p>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      onClick={handleFetchGreenQr}
                      disabled={loadingGreenQr}
                      className="bg-amber-600 hover:bg-amber-700 text-white gap-2 mx-auto"
                    >
                      {loadingGreenQr ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                      Show QR Code
                    </Button>
                  )}
                  <div className="flex justify-center gap-2">
                    <Button
                      type="button"
                      onClick={handleCheckGreenApi}
                      disabled={checkingGreen}
                      variant="outline"
                      size="sm"
                    >
                      {checkingGreen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Check Status After Scanning'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-5 bg-muted/40 rounded-2xl border border-dashed text-center space-y-2">
                  <Cloud className="h-10 w-10 text-muted-foreground mx-auto" />
                  <h4 className="font-bold text-foreground text-base">Green API Cloud WhatsApp Configuration</h4>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Connect your Green API account once. Bills and receipts will be delivered straight to customer WhatsApp numbers 24/7 with 99.9% uptime.
                  </p>
                  {greenStatus?.message && (
                    <p className="text-xs font-mono text-amber-600 dark:text-amber-400 mt-1">
                      Status: {greenStatus.message}
                    </p>
                  )}
                </div>
              )}

              {/* Green API Form */}
              <div className="space-y-4 p-5 rounded-2xl border bg-card/60 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-primary" /> API Credentials
                  </h4>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Provider: Green API (REST)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Instance ID (idInstance) *</Label>
                    <Input
                      placeholder="e.g. 7103123456"
                      value={greenConfig.idInstance}
                      onChange={e => setGreenConfig(prev => ({ ...prev, idInstance: e.target.value.trim() }))}
                      className="font-mono text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">Found on your green-api.com console</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">API Token (apiTokenInstance) *</Label>
                    <Input
                      type="password"
                      placeholder="e.g. d75b52a3b1c2..."
                      value={greenConfig.apiTokenInstance}
                      onChange={e => setGreenConfig(prev => ({ ...prev, apiTokenInstance: e.target.value.trim() }))}
                      className="font-mono text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">Secret token from your Green API instance</p>
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs font-semibold">API Host URL (Optional, defaults to https://api.green-api.com)</Label>
                    <Input
                      placeholder="https://api.green-api.com"
                      value={greenConfig.apiUrl || 'https://api.green-api.com'}
                      onChange={e => setGreenConfig(prev => ({ ...prev, apiUrl: e.target.value.trim() }))}
                      className="font-mono text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">Change only if using dedicated Green API host (e.g. https://7103.api.green-api.com)</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={greenConfig.enabled}
                      onChange={e => setGreenConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500 h-4 w-4"
                    />
                    <span>Enable Green API for automatic checkout billing</span>
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCheckGreenApi}
                      disabled={checkingGreen || !greenConfig.idInstance}
                      className="text-xs h-9 gap-1.5"
                    >
                      {checkingGreen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Test Connection
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveGreenApiSettings}
                      disabled={savingGreen}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs h-9 gap-1.5 font-semibold"
                    >
                      {savingGreen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save Green API Config
                    </Button>
                  </div>
                </div>
              </div>

              {/* Test WhatsApp Message Card */}
              <div className="p-4 bg-muted/40 rounded-xl border border-border text-left space-y-3">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-green-600" /> Send Test WhatsApp Message:
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="10-digit mobile number"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    maxLength={10}
                    className="font-mono text-sm max-w-xs"
                  />
                  <Button 
                    type="button"
                    onClick={handleSendTestMessage} 
                    disabled={testSending || testPhone.length !== 10}
                    className="bg-green-600 hover:bg-green-700 text-white shrink-0 text-xs px-4"
                  >
                    {testSending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Test'}
                  </Button>
                </div>
                {testResult && (
                  <p className={`text-xs font-medium ${testResult.includes('successfully') ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {testResult}
                  </p>
                )}
              </div>

              {/* Quick Setup Guide */}
              <div className="p-4 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-200/70 dark:border-blue-900/50 text-xs space-y-2">
                <p className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-blue-600" /> How to get free Green API credentials (in 2 minutes):
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground pl-1">
                  <li>Visit <a href="https://green-api.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline font-semibold">green-api.com</a> and sign up for a free developer account.</li>
                  <li>Click <strong>Create Instance</strong> (the "Developer" plan is completely free for testing).</li>
                  <li>Copy your <span className="font-mono font-semibold text-foreground">idInstance</span> and <span className="font-mono font-semibold text-foreground">apiTokenInstance</span> and paste them into the fields above.</li>
                  <li>Click <strong>Save Green API Config</strong>, then click <strong>Show QR Code</strong> and scan it using your WhatsApp phone (WhatsApp &gt; Linked Devices).</li>
                  <li>Done! Your shop's bills and reminders will now be sent automatically 24/7 without needing your PC or Node server running.</li>
                </ol>
              </div>
            </div>
          ) : (
            /* ── BAILEYS LOCAL BOT PROVIDER ── */
            <div className="flex flex-col items-center justify-center p-6 border rounded-xl bg-background text-center">
              {!whatsappStatus || whatsappStatus.status === 'DISCONNECTED' ? (
                <div className="space-y-4 max-w-md mx-auto">
                  <p className="text-muted-foreground">Local Bot is currently disconnected.</p>
                  {whatsappStatus?.error && (
                    <div className="bg-red-50 dark:bg-red-950/40 p-3 rounded-lg border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 font-mono text-left">
                      <p className="font-bold mb-1">Bot Error:</p>
                      <p className="break-words">{whatsappStatus.error}</p>
                      {whatsappStatus.error.toLowerCase().includes('chrome') && (
                        <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300 font-sans">
                          💡 Tip: Cloud servers without Chromium do not support the local WhatsApp bot. We recommend switching to the Green API tab above for 100% reliable cloud delivery.
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
                      'Start Local WhatsApp Bot'
                    )}
                  </Button>
                </div>
              ) : whatsappStatus.status === 'PAIRING' ? (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-green-600 mb-4" />
                  <p className="font-bold text-green-600 text-lg">QR Scanned! Linking Device...</p>
                  <p className="text-muted-foreground text-sm mt-2">Please wait, connecting WhatsApp...</p>
                </>
              ) : whatsappStatus.status === 'CONNECTING' ? (
                <>
                  <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
                  <p className="font-bold text-blue-600 text-lg">Reconnecting...</p>
                  <p className="text-muted-foreground text-sm mt-2">Reconnecting WhatsApp, please wait...</p>
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
                    Your local bot is active. Bills will be sent automatically to customers after checkout.
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
                      <p className={`text-xs font-medium ${testResult.includes('successfully') ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
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
          )}
        </div>
      </div>


      {/* WhatsApp Bill & Summary Settings */}
      <div className="bg-card text-card-foreground border rounded-xl shadow-sm mt-8 overflow-hidden">
        <div className="p-6 border-b bg-blue-500/10">
          <h2 className="text-xl font-bold flex items-center gap-2 text-blue-600">
            <Clock className="h-6 w-6" /> WhatsApp Bill & Summary Settings
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure automated bill delay and daily summary schedule.
          </p>
        </div>
        <div className="p-6 space-y-6">
          {/* Bill Delay Setting */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-base font-semibold">
              <Send className="h-4 w-4 text-green-600" /> Auto Bill Send Delay (Seconds)
            </Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Delay in seconds before sending WhatsApp bill upon checkout (0 = instant):
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {[0, 3, 5, 8, 10].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setWhatsappSettings(prev => ({...prev, billDelaySeconds: val}))}
                  className={`px-4 py-2 rounded-lg border font-bold text-sm transition-all ${whatsappSettings.billDelaySeconds === val ? 'bg-green-600 text-white border-green-600 shadow-md scale-105' : 'bg-muted/50 text-foreground border-border hover:bg-muted'}`}
                >
                  {val === 0 ? 'Instant' : `${val}s`}
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
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setWhatsappSettings(prev => ({...prev, summaryEnabled: !prev.summaryEnabled}))}
                className={`relative w-12 h-6 rounded-full transition-colors ${whatsappSettings.summaryEnabled ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${whatsappSettings.summaryEnabled ? 'translate-x-6' : ''}`} />
              </button>
              <span className="text-sm font-medium">{whatsappSettings.summaryEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>

            {whatsappSettings.summaryEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-xl border">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Summary Send Time (IST)</Label>
                  <Input
                    type="time"
                    value={whatsappSettings.summaryTime}
                    onChange={e => setWhatsappSettings(prev => ({...prev, summaryTime: e.target.value}))}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-summary report will be delivered every day at this time
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Recipient Mobile Number</Label>
                  <Input
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={whatsappSettings.summaryPhone}
                    onChange={e => setWhatsappSettings(prev => ({...prev, summaryPhone: e.target.value.replace(/\D/g, '').slice(0, 10)}))}
                    maxLength={10}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Store owner WhatsApp number (receives daily sales report)
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

      {/* ── Shop Data Vault & Resilience ── */}
      <div className="bg-card text-card-foreground border rounded-xl shadow-sm mt-8 overflow-hidden">
        <div className="p-6 border-b bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
              <Database className="h-6 w-6 text-blue-600" /> Shop Data Vault & Security
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Keep all your products, customers, bills, and ledger safe. Download backups in 1 click or restore to another computer.
            </p>
          </div>
          <span className="text-xs px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-semibold self-start sm:self-auto flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" /> Cloud & Local Vault
          </span>
        </div>

        <div className="p-6 space-y-6">
          {/* Backup & Restore Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Export Backup Card */}
            <div className="p-5 rounded-xl border bg-muted/20 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2.5 text-foreground font-bold text-base mb-1">
                  <Download className="h-5 w-5 text-emerald-600" /> 1-Click Full Backup
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Export all products, customer ledgers, credit, invoices, and settings instantly into a secure <code>.json</code> backup file.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  type="button"
                  onClick={handleExportShopBackup}
                  disabled={isExporting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {isExporting ? 'Generating backup...' : 'Download Full Shop Backup (.json)'}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center mt-2">
                  🔒 Data is encrypted and saved securely to your personal device.
                </p>
              </div>
            </div>

            {/* Import / Restore Backup Card */}
            <div className="p-5 rounded-xl border bg-muted/20 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2.5 text-foreground font-bold text-base mb-1">
                  <Upload className="h-5 w-5 text-blue-600" /> Restore from Backup
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Switching to a new laptop, phone, or computer? Select your backup file to restore your entire store in seconds.
                </p>
              </div>

              <div className="pt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportShopBackup}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="w-full border-blue-600/40 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 font-semibold text-xs flex items-center justify-center gap-2"
                >
                  {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {isImporting ? 'Restoring data...' : 'Choose Backup File to Restore (.json)'}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center mt-2">
                  ⚡ Existing product and customer databases will be updated.
                </p>
              </div>
            </div>
          </div>

          <hr className="border-border" />

          {/* Offline Resilience & Local Cache Health */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" /> Offline Resilience & Storage Health
            </h3>

            <div className="p-4 rounded-xl border bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${offlinePendingCount > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                  <span className="text-xs font-bold text-foreground">
                    {offlinePendingCount > 0
                      ? `${offlinePendingCount} bills stored offline (Pending Cloud Sync)`
                      : 'All bills safely synced to cloud (All Synced)'}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Bills created when offline or disconnected from Wi-Fi are securely cached in browser storage.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {offlinePendingCount > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleManualSyncOffline}
                    disabled={isSyncingOffline}
                    className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-1.5"
                  >
                    {isSyncingOffline ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Sync Now
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleClearCorruptCache}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground border-border"
                >
                  Clear Corrupt Cache
                </Button>
              </div>
            </div>
          </div>

          {/* Security & Isolation Notice */}
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-muted-foreground flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground mb-0.5">Data Privacy and Isolation Guarantee:</p>
              <p>
                Your store data (Shop ID: <span className="font-mono font-bold text-foreground">{shopData?.shopId}</span>) is private and never shared with any other store or third party. All communication is protected with HTTPS and JWT authentication.
              </p>
            </div>
          </div>
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

      {/* Staff Granular Permissions Modal */}
      {selectedStaffForPerms && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-card text-card-foreground border shadow-2xl rounded-2xl sm:rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b bg-muted/30 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
                    Staff Permissions
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold">
                      {editingPermissions.length} Active
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Assign feature access for <strong>{selectedStaffForPerms.displayName || selectedStaffForPerms.email}</strong>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStaffForPerms(null)}
                className="rounded-full h-8 w-8 hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* Quick Role Presets */}
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5 block">
                  ⚡ Quick Role Presets (1-Click Roles)
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STAFF_ROLE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleApplyPreset(preset.permissions)}
                      className="p-2.5 rounded-xl border text-left hover:border-primary/50 hover:bg-primary/5 transition-all text-xs flex flex-col justify-between group active:scale-95 bg-card"
                    >
                      <div>
                        <span className="font-bold text-foreground block group-hover:text-primary">
                          {preset.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground block line-clamp-1">
                          {preset.marathiName}
                        </span>
                      </div>
                      <span className="text-[10px] text-primary/80 font-mono mt-1 block">
                        {preset.permissions.length} modules
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Module-by-Module Permission Checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Granular Module Access (Permissions)
                  </Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingPermissions(APP_PERMISSIONS.map(p => p.id))}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-muted-foreground text-xs">•</span>
                    <button
                      type="button"
                      onClick={() => setEditingPermissions([])}
                      className="text-[11px] text-muted-foreground hover:underline"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {APP_PERMISSIONS.map((perm) => {
                    const isChecked = editingPermissions.includes(perm.id);
                    const Icon = perm.icon;
                    return (
                      <div
                        key={perm.id}
                        onClick={() => handleTogglePermission(perm.id)}
                        className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all select-none ${
                          isChecked 
                            ? 'bg-primary/5 border-primary/40 shadow-xs' 
                            : 'bg-muted/10 border-border hover:border-border/80 opacity-75'
                        }`}
                      >
                        <div className={`h-5 w-5 rounded-md mt-0.5 flex items-center justify-center shrink-0 border transition-all ${
                          isChecked 
                            ? 'bg-primary text-primary-foreground border-primary' 
                            : 'border-muted-foreground/40'
                        }`}>
                          {isChecked && <CheckCircle className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Icon className={`h-4 w-4 shrink-0 ${isChecked ? 'text-primary' : 'text-muted-foreground'}`} />
                            <span className="font-bold text-xs text-foreground truncate">{perm.name}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                            {perm.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t bg-muted/20 flex items-center justify-between gap-3 shrink-0">
              <p className="text-xs text-muted-foreground">
                Permissions take effect immediately for this staff member.
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSelectedStaffForPerms(null)}
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  disabled={savingPermissions}
                  onClick={handleSaveStaffPermissions}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 flex items-center gap-1.5"
                >
                  {savingPermissions ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Permissions
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
