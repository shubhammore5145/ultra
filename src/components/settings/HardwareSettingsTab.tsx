import React from 'react';
import { 
  Printer, 
  CheckCircle2, 
  Usb, 
  Bluetooth, 
  Loader2, 
  Barcode, 
  Sparkles, 
  Volume2, 
  Play, 
  Save 
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export interface HardwareSettingsState {
  paperSize: string;
  printerType: string;
  autoPrintReceipt: boolean;
  receiptHeader: string;
  receiptFooter: string;
  bluetoothDeviceName: string;
  scannerBeep: boolean;
  scannerAutoAdd: boolean;
}

interface HardwareSettingsTabProps {
  hardwareSettings: HardwareSettingsState;
  setHardwareSettings: React.Dispatch<React.SetStateAction<HardwareSettingsState>>;
  bluetoothConnecting: boolean;
  handleConnectBluetooth: () => void;
  handlePrintTestReceipt: () => void;
  scannerTestInput: string;
  setScannerTestInput: (v: string) => void;
  handleScannerTest: (e: React.FormEvent) => void;
  scannerResults: { code: string; time: string; product?: any }[];
  playScannerBeep: () => void;
  handleSaveHardware: () => void;
  savingHardware: boolean;
  shopName?: string;
}

export function HardwareSettingsTab({
  hardwareSettings,
  setHardwareSettings,
  bluetoothConnecting,
  handleConnectBluetooth,
  handlePrintTestReceipt,
  scannerTestInput,
  setScannerTestInput,
  handleScannerTest,
  scannerResults,
  playScannerBeep,
  handleSaveHardware,
  savingHardware,
  shopName
}: HardwareSettingsTabProps) {
  return (
    <>
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

    {/* Hidden Print Template for Printer Alignment Test */}
    <div 
      id="test-receipt-print" 
      className="hidden print:block text-black bg-white"
      style={{
        width: hardwareSettings.paperSize === '58mm' ? '48mm' : '72mm',
        padding: '4mm',
        margin: '0 auto',
        fontFamily: 'monospace'
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0' }}>{shopName || 'KIRANA STORE'}</h2>
        <p style={{ fontSize: '11px', margin: '2px 0' }}>*** HARDWARE TEST RECEIPT ***</p>
        <p style={{ fontSize: '10px', color: '#555', margin: '0' }}>{new Date().toLocaleString('en-IN')}</p>
      </div>

      {hardwareSettings.receiptHeader && (
        <div style={{ textAlign: 'center', marginBottom: '6px', fontSize: '11px' }}>
          {hardwareSettings.receiptHeader}
        </div>
      )}

      <div style={{ borderBottom: '1px dashed #000', margin: '4px 0' }}></div>

      {/* Paper & Mode Spec */}
      <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
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
  </>
  );
}
