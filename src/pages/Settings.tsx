import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Loader2, Store, Save, Phone, MapPin, Hash, ShieldCheck, UserPlus, Copy, CheckCircle, Smartphone, LogOut } from 'lucide-react';
// Firebase removed
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

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

  const [staffList, setStaffList] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<any>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

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
      const res = await fetch('/api/whatsapp/status');
      const data = await res.json();
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
      setLoading(false);
      fetchStaff();
      
      // Fetch status every 3 seconds
      fetchWhatsappStatus();
      const interval = setInterval(fetchWhatsappStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [shopData]);

  const handleStartWhatsapp = async () => {
    try {
      await fetch('/api/whatsapp/start', { method: 'POST' });
      fetchWhatsappStatus();
    } catch (err) {
      alert('Failed to start WhatsApp bot.');
    }
  };

  const handleLogoutWhatsapp = async () => {
    try {
      await fetch('/api/whatsapp/logout', { method: 'POST' });
      fetchWhatsappStatus();
    } catch (err) {
      alert('Failed to logout WhatsApp bot.');
    }
  };

  const handleSendTestMessage = async () => {
    if (!testPhone || testPhone.trim().length !== 10) {
      alert('कृपया वैध 10-अंकी मोबाइल नंबर टाका');
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          message: `🏪 *${formData.shopName || 'Kirana Store'}*\n\n✅ *WhatsApp Bot Test Successful!*\nआपला किराणा ऑटो व्हॉट्सअॅप बॉट यशस्वीरित्या काम करत आहे.`
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult('व्हॉट्सअॅप चाचणी मेसेज यशस्वीरित्या पाठवला! ✅');
      } else {
        setTestResult(`त्रुटी: ${data.error || 'Failed to send'}`);
      }
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
        upiId: formData.upiId,
        publicUrl: formData.publicUrl.trim().replace(/\/$/, '') // remove trailing slash
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
                placeholder="e.g. https://s-mart-ed1z.onrender.com"
                className="bg-background border-muted font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Enter your live deployed URL (e.g. <code>https://s-mart-ed1z.onrender.com</code>). Customers will receive this link on WhatsApp to view and download their PDF bills.
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

      {/* Staff Accounts Section (Live Real Staff Management) */}
      <div className="bg-card text-card-foreground border rounded-xl shadow-sm mt-8 overflow-hidden">
        <div className="p-6 border-b bg-muted/30">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Staff Accounts & Security
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Manage who has access to your shop. Cashiers can only access billing and basic operations.</p>
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
                  const text = `Hello! Join my shop on KiranaPro. Sign up at the app and select 'Join Shop (Cashier)' with this Shop ID: ${shopData?.shopId}`;
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
    <div className="p-6 border-b bg-green-500/10">
      <h2 className="text-xl font-bold flex items-center gap-2 text-green-600">
        <Smartphone className="h-6 w-6" /> Auto WhatsApp Bot
      </h2>
      <p className="text-sm text-muted-foreground mt-1">Scan the QR code to automatically send bills to customers without clicking "Send".</p>
    </div>
    <div className="p-6">
      <div className="flex flex-col items-center justify-center p-6 border rounded-xl bg-background text-center">
        {!whatsappStatus || whatsappStatus.status === 'DISCONNECTED' ? (
          <>
            <p className="text-muted-foreground mb-4">Bot is currently disconnected.</p>
            <Button onClick={handleStartWhatsapp} className="bg-green-600 hover:bg-green-700 text-white">Start WhatsApp Bot</Button>
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
          if (window.confirm('Are you sure you want to log out of KiranaPro?')) {
            logout();
          }
        }}
        className="bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center gap-2 shadow-sm"
      >
        <LogOut className="h-4 w-4" /> Log Out of Account
      </Button>
    </div>
  </div>
</div>
);
}
