import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Loader2, 
  Store, 
  Save, 
  Phone, 
  MapPin, 
  Hash, 
  ShieldCheck, 
  UserPlus, 
  Trash2, 
  Key, 
  CheckCircle,
  Copy
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, getOfflineQueue, syncOfflineQueue } from '../lib/api';
import { 
  getGreenApiConfig, 
  saveGreenApiConfig, 
  checkGreenApiStatus, 
  getGreenApiQrCode, 
  logoutGreenApi, 
  sendGreenApiMessage 
} from '../lib/greenApi';
import type { GreenApiConfig, GreenApiStatus } from '../lib/greenApi';

// Modular Sub-components
import { HardwareSettingsTab } from '../components/settings/HardwareSettingsTab';
import type { HardwareSettingsState } from '../components/settings/HardwareSettingsTab';
import { WhatsAppSettingsTab } from '../components/settings/WhatsAppSettingsTab';
import type { GreenApiConfigState, WhatsAppTabSettingsState } from '../components/settings/WhatsAppSettingsTab';
import { DataVaultSettingsTab } from '../components/settings/DataVaultSettingsTab';
import { StaffPermissionsModal } from '../components/settings/StaffPermissionsModal';

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
  const [hardwareSettings, setHardwareSettings] = useState<HardwareSettingsState>({
    paperSize: '80mm',
    printerType: 'usb',
    autoPrintReceipt: true,
    receiptHeader: '',
    receiptFooter: '',
    bluetoothDeviceName: '',
    scannerBeep: true,
    scannerAutoAdd: true
  });
  const [savingHardware, setSavingHardware] = useState(false);
  const [bluetoothConnecting, setBluetoothConnecting] = useState(false);

  // Barcode Scanner Live Testing
  const [scannerTestInput, setScannerTestInput] = useState('');
  const [scannerResults, setScannerResults] = useState<{
    code: string;
    time: string;
    product?: any;
  }[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);

  // Staff State
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);

  // WhatsApp State
  const [whatsappStatus, setWhatsappStatus] = useState<any>(null);
  const [startingWhatsapp, setStartingWhatsapp] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Green API & Multi-Provider WhatsApp State
  const [waProvider, setWaProvider] = useState<'green_api' | 'baileys'>('green_api');
  const [greenConfig, setGreenConfig] = useState<GreenApiConfigState>({
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
  const [whatsappSettings, setWhatsappSettings] = useState<WhatsAppTabSettingsState>({
    summaryEnabled: true,
    summaryTime: '21:30',
    summaryPhone: '',
    billDelaySeconds: 5
  });

  // Data Vault State
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Staff Permissions Modal State
  const [selectedStaffForPerms, setSelectedStaffForPerms] = useState<any | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);

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

      const settings = (shopData as any).settings || {};
      setWhatsappSettings({
        summaryEnabled: settings.whatsappSummaryEnabled !== false,
        summaryTime: settings.whatsappSummaryTime || '21:30',
        summaryPhone: settings.whatsappSummaryPhone || shopData.phone || '',
        billDelaySeconds: typeof settings.billDelaySeconds === 'number' ? settings.billDelaySeconds : 5
      });

      const savedGreen = getGreenApiConfig();
      const shopGreen = settings.greenApi;
      const initialGreen: GreenApiConfigState = {
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

      if (initialGreen.idInstance && initialGreen.apiTokenInstance && !initialGreen.idInstance.includes('@')) {
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
    setTimeout(() => {
      window.print();
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
    if (greenConfig.idInstance.includes('@')) {
      alert('Invalid Instance ID! Please enter your numeric Green API idInstance (e.g. 7103123456), NOT your login email address.');
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
    if (greenConfig.idInstance.includes('@')) {
      alert('Invalid Instance ID! Please enter your numeric Green API idInstance (e.g. 7103123456), NOT your email address.');
      return;
    }
    setSavingGreen(true);
    try {
      saveGreenApiConfig(greenConfig);
      if (shopData?.shopId) {
        await api.shops.update({
          name: formData.shopName,
          ownerName: formData.ownerName,
          phone: formData.phone,
          address: formData.address,
          gstNumber: formData.gstNumber?.trim() || null,
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
    if (waProvider === 'green_api' && greenConfig.idInstance.includes('@')) {
      alert('Invalid Instance ID! Please enter your numeric Green API idInstance (e.g. 7103123456), NOT your email address.');
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
        publicUrl: formData.publicUrl.trim().replace(/\/$/, ''),
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
                placeholder="e.g. 9876543210@paytm or shop@okhdfcbank"
              />
              <p className="text-xs text-muted-foreground">
                This UPI ID will generate dynamic QR codes on customer thermal bills and receipts.
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium flex items-center gap-2">
                Public App URL (Domain / Vercel URL)
              </label>
              <Input 
                type="url"
                value={formData.publicUrl}
                onChange={e => setFormData({...formData, publicUrl: e.target.value})}
                placeholder="https://martgpt.vercel.app"
              />
              <p className="text-xs text-muted-foreground">
                Domain URL used in WhatsApp bill view links.
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" /> Shop Address
              </label>
              <Input 
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                placeholder="Shop No. 4, Market Road..."
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button type="submit" disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Shop Profile
            </Button>
          </div>
        </form>
      )}

      {/* Staff Management Section */}
      <div className="bg-card text-card-foreground border rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" /> Staff Accounts & Granular Permissions
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Add cashiers, assign module access (POS, Stock, Udhar, Reports), and protect sensitive shop data.
            </p>
          </div>
          <span className="text-xs bg-primary/10 text-primary font-bold px-3 py-1.5 rounded-full border border-primary/20 self-start sm:self-auto">
            {staffList.length} Active Staff
          </span>
        </div>

        <div className="p-6">
          {loadingStaff ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : staffList.length === 0 ? (
            <div className="text-center p-8 border border-dashed rounded-xl">
              <UserPlus className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
              <p className="font-semibold text-foreground">No staff accounts found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tell your cashiers to sign up and enter your Shop Access Code: <strong>{shopData?.shopId}</strong>
              </p>
            </div>
          ) : (
            <div className="divide-y border rounded-xl overflow-hidden bg-card">
              {staffList.map((staff) => (
                <div key={staff.uid || staff.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        {staff.displayName || staff.name || staff.email}
                      </span>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${staff.role === 'admin' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-blue-500/10 text-blue-600 border-blue-500/20'}`}>
                        {staff.role || 'Staff'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{staff.email}</p>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-1">
                      <Key className="h-3 w-3 text-primary" />
                      <span>
                        Access: {Array.isArray(staff.permissions) && staff.permissions.length > 0 ? `${staff.permissions.length} modules allowed` : 'Default Cashier Permissions'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenPermissionsModal(staff)}
                      className="text-xs h-8 gap-1.5 font-semibold border-primary/30 text-primary hover:bg-primary/10"
                    >
                      <Key className="h-3.5 w-3.5" />
                      Manage Permissions
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveStaff(staff.uid, staff.displayName || staff.email)}
                      className="text-xs h-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* POS Hardware: Thermal Printer & Barcode Scanner Tab */}
      <HardwareSettingsTab
        hardwareSettings={hardwareSettings}
        setHardwareSettings={setHardwareSettings}
        bluetoothConnecting={bluetoothConnecting}
        handleConnectBluetooth={handleConnectBluetooth}
        handlePrintTestReceipt={handlePrintTestReceipt}
        scannerTestInput={scannerTestInput}
        setScannerTestInput={setScannerTestInput}
        handleScannerTest={handleScannerTest}
        scannerResults={scannerResults}
        playScannerBeep={playScannerBeep}
        handleSaveHardware={handleSaveHardware}
        savingHardware={savingHardware}
        shopName={formData.shopName}
      />

      {/* WhatsApp Cloud Delivery & Bot Tab */}
      <WhatsAppSettingsTab
        waProvider={waProvider}
        setWaProvider={setWaProvider}
        greenStatus={greenStatus}
        greenConfig={greenConfig}
        setGreenConfig={setGreenConfig}
        checkingGreen={checkingGreen}
        handleCheckGreenApi={handleCheckGreenApi}
        handleLogoutGreen={handleLogoutGreen}
        greenQrData={greenQrData}
        handleFetchGreenQr={handleFetchGreenQr}
        loadingGreenQr={loadingGreenQr}
        handleSaveGreenApiSettings={handleSaveGreenApiSettings}
        savingGreen={savingGreen}
        testPhone={testPhone}
        setTestPhone={setTestPhone}
        handleSendTestMessage={handleSendTestMessage}
        testSending={testSending}
        testResult={testResult}
        whatsappStatus={whatsappStatus}
        startingWhatsapp={startingWhatsapp}
        handleStartWhatsapp={handleStartWhatsapp}
        handleLogoutWhatsapp={handleLogoutWhatsapp}
        whatsappSettings={whatsappSettings}
        setWhatsappSettings={setWhatsappSettings}
      />

      {/* Shop Data Vault & Resilience Tab */}
      <DataVaultSettingsTab
        isExporting={isExporting}
        handleExportShopBackup={handleExportShopBackup}
        isImporting={isImporting}
        handleImportShopBackup={handleImportShopBackup}
        fileInputRef={fileInputRef}
        offlinePendingCount={offlinePendingCount}
        handleManualSyncOffline={handleManualSyncOffline}
        isSyncingOffline={isSyncingOffline}
        handleClearCorruptCache={handleClearCorruptCache}
        shopData={shopData}
      />

      {/* Staff Granular Permissions Modal */}
      <StaffPermissionsModal
        selectedStaff={selectedStaffForPerms}
        onClose={() => setSelectedStaffForPerms(null)}
        editingPermissions={editingPermissions}
        setEditingPermissions={setEditingPermissions}
        handleApplyPreset={handleApplyPreset}
        handleTogglePermission={handleTogglePermission}
        handleSavePermissions={handleSaveStaffPermissions}
        savingPermissions={savingPermissions}
      />
    </div>
  );
}
