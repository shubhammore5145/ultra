import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  MessageSquare, 
  Crown, 
  Sparkles, 
  CheckCheck, 
  RefreshCw, 
  Search, 
  Calendar,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../contexts/PlanContext';

export interface AppNotification {
  id: string;
  shopId?: string | null;
  title: string;
  message: string;
  type?: 'broadcast' | 'plan_upgrade' | 'announcement' | 'reminder' | 'offer' | string;
  channel?: 'whatsapp_broadcast' | 'system' | 'superadmin' | string;
  actionUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function Notifications() {
  const { shopData } = useAuth();
  const { plan, openUpgradeModal } = usePlan();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'broadcast' | 'plan_upgrade' | 'announcement' | 'unread'>('all');
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await api.notifications.list();
      if (res && res.notifications) {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => fetchNotifications(true), 15000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.notifications.markRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.notifications.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      // Tab filter
      if (activeTab === 'unread' && n.isRead) return false;
      if (activeTab === 'broadcast' && n.type !== 'broadcast' && n.channel !== 'whatsapp_broadcast') return false;
      if (activeTab === 'plan_upgrade' && n.type !== 'plan_upgrade') return false;
      if (activeTab === 'announcement' && n.type !== 'announcement' && n.type !== 'offer') return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          n.title?.toLowerCase().includes(query) ||
          n.message?.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [notifications, activeTab, searchQuery]);

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-fadeInUp">
      {/* Header Banner */}
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase tracking-wider flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                Live Notification Center
              </span>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white animate-pulse">
                  {unreadCount} New
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Notifications & WhatsApp Broadcasts
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Stay updated with system announcements, WhatsApp broadcast messages, and subscription plan upgrades from Super Admin.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="bg-white/10 hover:bg-white/20 border-white/20 text-white text-xs font-semibold flex items-center gap-1.5 h-10"
              >
                <CheckCheck className="w-4 h-4" />
                Mark All Read
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchNotifications(true)}
              disabled={refreshing}
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white h-10 w-10 shrink-0"
              title="Refresh Notifications"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            All ({notifications.length})
          </button>
          
          <button
            onClick={() => setActiveTab('broadcast')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'broadcast'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
            WhatsApp Broadcasts
          </button>

          <button
            onClick={() => setActiveTab('plan_upgrade')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'plan_upgrade'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            Plan Updates
          </button>

          <button
            onClick={() => setActiveTab('announcement')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'announcement'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Announcements
          </button>

          {unreadCount > 0 && (
            <button
              onClick={() => setActiveTab('unread')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'unread'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Unread ({unreadCount})
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative sm:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-card"
          />
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center bg-card rounded-2xl border">
            <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">Loading notifications...</p>
            <p className="text-xs text-muted-foreground mt-1">Checking for broadcasts and system updates</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center bg-card rounded-3xl border border-dashed text-muted-foreground space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto shadow-inner">
              <Bell className="w-8 h-8 opacity-40" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">No Notifications Found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `No messages match your search "${searchQuery}".`
                  : activeTab === 'unread'
                  ? 'All notifications have been read! You are fully caught up.'
                  : 'You do not have any notifications in this category right now.'}
              </p>
            </div>
            {activeTab !== 'all' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setActiveTab('all'); setSearchQuery(''); }}
                className="text-xs"
              >
                View All Notifications
              </Button>
            )}
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const isBroadcast = notif.type === 'broadcast' || notif.channel === 'whatsapp_broadcast';
            const isPlanUpgrade = notif.type === 'plan_upgrade';
            const isAnnouncement = notif.type === 'announcement' || notif.type === 'offer';

            return (
              <div
                key={notif.id}
                onClick={() => {
                  if (!notif.isRead) handleMarkAsRead(notif.id);
                }}
                className={`group relative p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                  notif.isRead
                    ? 'bg-card border-border hover:border-muted-foreground/30 shadow-sm opacity-90'
                    : 'bg-card border-primary/40 shadow-md ring-1 ring-primary/20 hover:ring-primary/40'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Leading Icon */}
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                      isBroadcast
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : isPlanUpgrade
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        : isAnnouncement
                        ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                        : 'bg-primary/10 text-primary border border-primary/20'
                    }`}
                  >
                    {isBroadcast ? (
                      <MessageSquare className="w-5 h-5" />
                    ) : isPlanUpgrade ? (
                      <Crown className="w-5 h-5" />
                    ) : isAnnouncement ? (
                      <Sparkles className="w-5 h-5" />
                    ) : (
                      <Bell className="w-5 h-5" />
                    )}
                  </div>

                  {/* Content Area */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {/* Header: Title, Tags & Timestamp */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm sm:text-base text-foreground tracking-tight leading-snug">
                          {notif.title}
                        </h4>

                        {/* Category Tag */}
                        {isBroadcast && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <MessageSquare className="w-2.5 h-2.5" /> WhatsApp Broadcast
                          </span>
                        )}

                        {isPlanUpgrade && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            <Crown className="w-2.5 h-2.5" /> Plan Update
                          </span>
                        )}

                        {isAnnouncement && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> Announcement
                          </span>
                        )}

                        {!notif.isRead && (
                          <span className="inline-block w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-pulse" />
                        )}
                      </div>

                      {/* Timestamp */}
                      <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(notif.createdAt)}
                      </span>
                    </div>

                    {/* Message Body */}
                    <div className="text-xs sm:text-sm text-foreground/80 leading-relaxed whitespace-pre-line pt-1 font-sans">
                      {notif.message}
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 mt-2">
                      <div className="flex items-center gap-2">
                        {notif.actionUrl && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!notif.isRead) handleMarkAsRead(notif.id);
                              if (notif.actionUrl?.startsWith('http')) {
                                window.open(notif.actionUrl, '_blank');
                              } else {
                                navigate(notif.actionUrl || '/upgrade');
                              }
                            }}
                            className={`h-7 text-xs font-bold gap-1 shadow-sm ${
                              isPlanUpgrade
                                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                            }`}
                          >
                            <span>Open Details</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {isBroadcast && (
                          <span className="text-[11px] text-muted-foreground italic flex items-center gap-1">
                            💬 Broadcast sent to shopkeeper WhatsApp & in-app
                          </span>
                        )}
                      </div>

                      {/* Read status button */}
                      <div>
                        {notif.isRead ? (
                          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 opacity-70">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Read
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleMarkAsRead(notif.id, e)}
                            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-primary/10 transition-colors"
                          >
                            <CheckCheck className="w-3.5 h-3.5" /> Mark as Read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
