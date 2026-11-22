import React from 'react';
import {
  Smartphone,
  Cloud,
  Server,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  QrCode,
  Sliders,
  Send,
  Save,
  Sparkles,
  Clock,
  MessageSquare
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export interface GreenApiConfigState {
  idInstance: string;
  apiTokenInstance: string;
  apiUrl: string;
  enabled: boolean;
}

export interface WhatsAppTabSettingsState {
  summaryEnabled: boolean;
  summaryTime: string;
  summaryPhone: string;
  billDelaySeconds: number;
}

interface WhatsAppSettingsTabProps {
  waProvider: 'green_api' | 'baileys';
  setWaProvider: (provider: 'green_api' | 'baileys') => void;
  greenStatus: any;
  greenConfig: GreenApiConfigState;
  setGreenConfig: React.Dispatch<React.SetStateAction<GreenApiConfigState>>;
  checkingGreen: boolean;
  handleCheckGreenApi: () => void;
  handleLogoutGreen: () => void;
  greenQrData: string | null;
  handleFetchGreenQr: () => void;
  loadingGreenQr: boolean;
  handleSaveGreenApiSettings: () => void;
  savingGreen: boolean;
  testPhone: string;
  setTestPhone: (v: string) => void;
  handleSendTestMessage: () => void;
  testSending: boolean;
  testResult: string | null;
  whatsappStatus: any;
  startingWhatsapp: boolean;
  handleStartWhatsapp: () => void;
  handleLogoutWhatsapp: () => void;
  whatsappSettings: WhatsAppTabSettingsState;
  setWhatsappSettings: React.Dispatch<React.SetStateAction<WhatsAppTabSettingsState>>;
}

export function WhatsAppSettingsTab({
  waProvider,
  setWaProvider,
  greenStatus,
  greenConfig,
  setGreenConfig,
  checkingGreen,
  handleCheckGreenApi,
  handleLogoutGreen,
  greenQrData,
  handleFetchGreenQr,
  loadingGreenQr,
  handleSaveGreenApiSettings,
  savingGreen,
  testPhone,
  setTestPhone,
  handleSendTestMessage,
  testSending,
  testResult,
  whatsappStatus,
  startingWhatsapp,
  handleStartWhatsapp,
  handleLogoutWhatsapp,
  whatsappSettings,
  setWhatsappSettings
}: WhatsAppSettingsTabProps) {
  const isEmailEntered = greenConfig.idInstance.includes('@');

  return (
    <>
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

              {/* Warning Alert if User entered Email */}
              {isEmailEntered && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-left space-y-1 animate-pulse">
                  <p className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Instance ID Error: You entered an Email address!
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300">
                    Green API <strong>Instance ID</strong> is a 10-digit number (e.g. <span className="font-mono font-bold">7103123456</span>), NOT your login email. 
                    Please copy it from your <a href="https://console.green-api.com" target="_blank" rel="noopener noreferrer" className="underline font-bold">Green API Console</a>.
                  </p>
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
                      onChange={e => {
                        let val = e.target.value.trim();
                        // Strip waInstance prefix if accidentally copied
                        if (val.startsWith('waInstance')) val = val.replace('waInstance', '');
                        setGreenConfig(prev => ({ ...prev, idInstance: val }));
                      }}
                      className={`font-mono text-sm ${isEmailEntered ? 'border-red-500 focus-visible:ring-red-500 bg-red-50/20' : ''}`}
                    />
                    {isEmailEntered ? (
                      <p className="text-xs text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        Enter numeric 10-digit ID (e.g. 7103123456), not email!
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Numeric ID (10 digits) found inside your Green API instance console
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">API Token (apiTokenInstance) *</Label>
                    <Input
                      type="password"
                      placeholder="e.g. d75b52a3b1c2e4f5..."
                      value={greenConfig.apiTokenInstance}
                      onChange={e => setGreenConfig(prev => ({ ...prev, apiTokenInstance: e.target.value.trim() }))}
                      className="font-mono text-sm"
                    />
                    {greenConfig.apiTokenInstance.length > 0 && greenConfig.apiTokenInstance.length < 20 ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        Warning: Token looks short. Green API tokens are usually 50+ characters.
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Long alphanumeric token copied from your Green API instance
                      </p>
                    )}
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
                      disabled={checkingGreen || !greenConfig.idInstance || isEmailEntered}
                      className="text-xs h-9 gap-1.5"
                    >
                      {checkingGreen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Test Connection
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveGreenApiSettings}
                      disabled={savingGreen || isEmailEntered}
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
                    disabled={testSending || testPhone.length !== 10 || isEmailEntered}
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
                  <li>Copy your <span className="font-mono font-semibold text-foreground">idInstance</span> (10-digit number) and <span className="font-mono font-semibold text-foreground">apiTokenInstance</span> and paste them into the fields above.</li>
                  <li>Click <strong>Save Green API Config</strong>, then click <strong>Show QR Code</strong> and scan it using your WhatsApp phone (WhatsApp &gt; Linked Devices).</li>
                  <li>Done! Your shop's bills and reminders will now be sent automatically 24/7 without needing your PC or Node server running.</li>
                </ol>
              </div>

              {/* Clarification Alert Box */}
              <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-900/60 text-xs space-y-2">
                <p className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-600" /> Important: What is Instance ID?
                </p>
                <p className="text-amber-800 dark:text-amber-300">
                  <strong>Instance ID</strong> is NOT your email address! And <strong>API Token</strong> is NOT your account password!
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-1">
                  <li><strong className="text-foreground">Instance ID (idInstance):</strong> This is a 10-digit number (e.g. <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">7103123456</code>).</li>
                  <li><strong className="text-foreground">API Token (apiTokenInstance):</strong> This is a 50+ character alphanumeric code (e.g. <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">d75b52a3b1c2e4f5a6b7c8d9...</code>).</li>
                  <li>Where to find both: Login to <a href="https://console.green-api.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-semibold">console.green-api.com</a> &gt; Click your instance &gt; Both codes are displayed right at the top!</li>
                </ul>
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
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="0"
                max="30"
                className="w-28 font-bold"
                value={whatsappSettings.billDelaySeconds}
                onChange={e => setWhatsappSettings(prev => ({ ...prev, billDelaySeconds: parseInt(e.target.value) || 0 }))}
              />
              <span className="text-sm font-medium text-muted-foreground">seconds</span>
            </div>
          </div>

          <hr className="border-border" />

          {/* Daily Summary Schedule */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="flex items-center gap-2 text-base font-semibold cursor-pointer">
                  <MessageSquare className="h-4 w-4 text-blue-600" /> Daily WhatsApp Sales & Udhar Summary
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Get a complete end-of-day summary message on your WhatsApp every evening.
                </p>
              </div>
              <input
                type="checkbox"
                checked={whatsappSettings.summaryEnabled}
                onChange={e => setWhatsappSettings(prev => ({ ...prev, summaryEnabled: e.target.checked }))}
                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </div>

            {whatsappSettings.summaryEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Delivery Time</Label>
                  <Input
                    type="time"
                    value={whatsappSettings.summaryTime}
                    onChange={e => setWhatsappSettings(prev => ({ ...prev, summaryTime: e.target.value }))}
                  />
                  <p className="text-[11px] text-muted-foreground">Default: 21:00 (9:00 PM)</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Owner WhatsApp Number</Label>
                  <Input
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={whatsappSettings.summaryPhone}
                    onChange={e => setWhatsappSettings(prev => ({ ...prev, summaryPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                    maxLength={10}
                    className="font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">Daily report will be sent to this WhatsApp number</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
