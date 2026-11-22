import React, { useRef } from 'react';
import { 
  Database, 
  ShieldCheck, 
  Download, 
  Upload, 
  Loader2, 
  HardDrive, 
  RefreshCw 
} from 'lucide-react';
import { Button } from '../ui/button';

interface DataVaultSettingsTabProps {
  isExporting: boolean;
  handleExportShopBackup: () => void;
  isImporting: boolean;
  handleImportShopBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  offlinePendingCount: number;
  handleManualSyncOffline: () => void;
  isSyncingOffline: boolean;
  handleClearCorruptCache: () => void;
  shopData: any;
}

export function DataVaultSettingsTab({
  isExporting,
  handleExportShopBackup,
  isImporting,
  handleImportShopBackup,
  fileInputRef,
  offlinePendingCount,
  handleManualSyncOffline,
  isSyncingOffline,
  handleClearCorruptCache,
  shopData
}: DataVaultSettingsTabProps) {
  return (
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
  );
}
