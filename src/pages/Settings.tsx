import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Loader2, Store, Save, Phone, MapPin, Hash, ShieldCheck, UserPlus, Copy, CheckCircle } from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function Settings() {
  const { shopData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    shopName: '',
    ownerName: '',
    phone: '',
    address: '',
    gstNumber: '',
    upiId: ''
  });

  useEffect(() => {
    const fetchShopDetails = async () => {
      if (!shopData?.shopId) return;
      try {
        const docRef = doc(db, 'shops', shopData.shopId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            shopName: data.shopName || '',
            ownerName: data.ownerName || '',
            phone: data.phone || '',
            address: data.address || '',
            gstNumber: data.gstNumber || '',
            upiId: data.upiId || ''
          });
        }
      } catch (error) {
        console.error('Error fetching shop details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchShopDetails();
  }, [shopData?.shopId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopData?.shopId) return;

    setSaving(true);
    try {
      const docRef = doc(db, 'shops', shopData.shopId);
      await updateDoc(docRef, formData);
      alert('Shop settings updated successfully!');
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
        
        {shopData?.plan === 'pro' ? (
          <div className="bg-background px-4 py-2 rounded-lg border font-mono font-bold select-all flex-shrink-0 text-foreground">
            {shopData?.shopId}
          </div>
        ) : (
          <div className="flex-shrink-0">
            <Button onClick={() => window.location.href = '/upgrade'} className="shadow-md bg-yellow-500 hover:bg-yellow-600 text-black">
              👑 Upgrade to Pro to Add Staff
            </Button>
          </div>
        )}
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

      {/* Staff Accounts Section (UI Demo for now) */}
      <div className="bg-card text-card-foreground border rounded-xl shadow-sm mt-8 overflow-hidden">
        <div className="p-6 border-b bg-muted/30">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Staff Accounts & Security
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Manage who has access to your shop. Staff accounts cannot see reports or edit settings.</p>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-xl bg-background">
              <div>
                <p className="font-bold">{shopData?.ownerName || 'Admin'}</p>
                <p className="text-sm text-muted-foreground">{shopData?.email}</p>
              </div>
              <span className="bg-primary/10 text-primary font-bold px-3 py-1 rounded-full text-xs uppercase tracking-widest">Admin</span>
            </div>
          </div>
          
          <div className="border-t pt-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Invite Staff / Cashier</h3>
            <p className="text-sm text-muted-foreground mb-4">Share your Shop ID with your cashier. They can use it to join your shop during sign-up.</p>
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
                  const text = `Hello! Join my shop on KiranaPro. Sign up at the app and use this Shop ID to join: ${shopData?.shopId}`;
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
    </div>
  );
}
