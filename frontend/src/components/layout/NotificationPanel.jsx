/**
 * ============================================
 * NotificationPanel
 * ============================================
 * The dropdown behind the bell icon: live alerts for due and overdue
 * installments, low stock, supplier payables, investor payouts and Zakat.
 *
 * Alerts are raised by the server's sweep, not invented here. This panel
 * displays them, marks them read, and offers a "Check now" that re-runs the
 * sweep on demand - useful right after recording payments, when the user wants
 * the badge to settle immediately rather than at the next scheduled run.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, BellOff, CheckCheck, RefreshCw, X, AlertTriangle, AlertCircle,
  Info, CheckCircle2, ExternalLink, Loader2,
} from 'lucide-react';

import { useUIStore } from '../../context/uiStore.js';
import { useToastStore } from '../../context/toastStore.js';
import { notificationService } from '../../services/entities.js';
import { useInterval, useClickOutside } from '../../hooks/index.js';
import { cn, timeAgo } from '../../utils/index.js';
import { CountBadge } from '../common/Badge.jsx';
import EmptyState from '../common/EmptyState.jsx';
import { ListSkeleton } from '../common/Skeleton.jsx';

/** Icon and colour per severity. */
const severityMeta = {
  error: { icon: AlertCircle, tone: 'text-danger-600 bg-danger-50', ring: 'ring-danger-100' },
  warning: { icon: AlertTriangle, tone: 'text-warning-600 bg-warning-50', ring: 'ring-warning-100' },
  success: { icon: CheckCircle2, tone: 'text-success-600 bg-success-50', ring: 'ring-success-100' },
  info: { icon: Info, tone: 'text-info-600 bg-info-50', ring: 'ring-info-100' },
};

export default function NotificationPanel() {
  const navigate = useNavigate();
  const toast = useToastStore();
  const {
    notificationsOpen, setNotificationsOpen,
    unreadCount, setUnreadCount, isOnline,
  } = useUIStore();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('unread');

  const panelRef = useClickOutside(() => setNotificationsOpen(false), notificationsOpen);

  // ---- Load ------------------------------------------------------------
  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const params = { limit: 25 };
        if (filter === 'unread') params.isRead = false;

        const response = await notificationService.list(params);
        setNotifications(response.data.notifications);
        setUnreadCount(response.data.unreadCount);
      } catch {
        // A failed poll is not worth a toast - the bell simply shows stale data
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [filter, setUnreadCount]
  );

  useEffect(() => {
    if (notificationsOpen) load();
  }, [notificationsOpen, load]);

  /**
   * Poll the unread count every two minutes while online.
   * Only the count - fetching the whole list in the background would be waste.
   */
  useInterval(
    () => {
      if (!isOnline || notificationsOpen) return;
      notificationService
        .list({ limit: 1, isRead: false })
        .then((r) => setUnreadCount(r.data.unreadCount))
        .catch(() => {});
    },
    isOnline ? 120_000 : null
  );

  // ---- Actions ---------------------------------------------------------
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await notificationService.refresh();
      await load({ silent: true });

      const created = Object.values(response.data?.created || {}).reduce((a, b) => a + b, 0);
      toast.success(
        created > 0 ? `${created} new alert${created === 1 ? '' : 's'} found.` : 'Everything is up to date.'
      );
    } catch (error) {
      toast.apiError(error, 'Could not refresh notifications.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkRead = async (notification, event) => {
    event?.stopPropagation();
    if (notification.isRead) return;

    // Optimistic: the badge should drop the instant it is tapped
    setNotifications((list) =>
      list.map((n) => (n._id === notification._id ? { ...n, isRead: true } : n))
    );
    setUnreadCount(Math.max(0, unreadCount - 1));

    try {
      await notificationService.markRead(notification._id);
    } catch {
      load({ silent: true }); // Re-sync if the server disagreed
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((list) => list.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read.');
      if (filter === 'unread') load({ silent: true });
    } catch (error) {
      toast.apiError(error);
    }
  };

  const handleDismiss = async (notification, event) => {
    event?.stopPropagation();
    setNotifications((list) => list.filter((n) => n._id !== notification._id));
    if (!notification.isRead) setUnreadCount(Math.max(0, unreadCount - 1));

    try {
      await notificationService.delete(notification._id);
    } catch {
      load({ silent: true });
    }
  };

  const handleOpen = (notification) => {
    handleMarkRead(notification);
    setNotificationsOpen(false);
    if (notification.actionPath) navigate(notification.actionPath);
  };

  const visible = filter === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell */}
      <button
        type="button"
        onClick={() => setNotificationsOpen(!notificationsOpen)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={notificationsOpen}
        className={cn(
          'relative p-2 rounded-lg text-navy-600 transition-all duration-200',
          'hover:bg-navy-100 hover:text-navy-950 active:scale-95',
          notificationsOpen && 'bg-navy-100 text-navy-950'
        )}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5">
            <CountBadge count={unreadCount} />
          </span>
        )}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {notificationsOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'absolute right-0 mt-2 z-dropdown bg-white rounded-xl border border-navy-100 shadow-modal overflow-hidden flex flex-col',
              // Nearly full width on a phone, fixed panel on desktop
              'w-[calc(100vw-2rem)] max-w-[380px] sm:w-[380px]',
              'max-h-[min(70vh,520px)]',
              // Keep it on screen when the trigger sits near the right edge
              '-right-2 sm:right-0'
            )}
            role="dialog"
            aria-label="Notifications"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-navy-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-display font-semibold text-navy-950">Notifications</h3>
                {unreadCount > 0 && <CountBadge count={unreadCount} variant="gold" />}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={refreshing || !isOnline}
                  title="Check for new alerts now"
                  aria-label="Check for new alerts"
                  className="p-1.5 rounded-md text-navy-400 hover:bg-navy-100 hover:text-navy-700 transition-colors disabled:opacity-40"
                >
                  {refreshing ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <RefreshCw size={15} />
                  )}
                </button>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    title="Mark all as read"
                    aria-label="Mark all as read"
                    className="p-1.5 rounded-md text-navy-400 hover:bg-navy-100 hover:text-navy-700 transition-colors"
                  >
                    <CheckCheck size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-navy-100 flex-shrink-0">
              {[
                { id: 'unread', label: 'Unread' },
                { id: 'all', label: 'All' },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilter(option.id)}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                    filter === option.id
                      ? 'bg-navy-950 text-white'
                      : 'text-navy-500 hover:bg-navy-100 hover:text-navy-900'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
              {loading ? (
                <div className="p-4">
                  <ListSkeleton items={4} />
                </div>
              ) : visible.length === 0 ? (
                <EmptyState
                  icon={filter === 'unread' ? CheckCircle2 : BellOff}
                  title={filter === 'unread' ? 'All caught up' : 'No notifications'}
                  message={
                    filter === 'unread'
                      ? 'There are no unread alerts right now.'
                      : 'Alerts about due payments, low stock and payouts will appear here.'
                  }
                  size="sm"
                />
              ) : (
                <ul className="divide-y divide-navy-100">
                  {visible.map((notification, index) => {
                    const meta = severityMeta[notification.severity] || severityMeta.info;
                    const Icon = meta.icon;

                    return (
                      <li key={notification._id} style={{ '--i': index }} className="stagger">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => handleOpen(notification)}
                          onKeyDown={(e) => e.key === 'Enter' && handleOpen(notification)}
                          className={cn(
                            'relative w-full flex items-start gap-3 px-4 py-3 text-left cursor-pointer',
                            'transition-colors duration-150 hover:bg-navy-50 group',
                            !notification.isRead && 'bg-gold-50/40'
                          )}
                        >
                          {!notification.isRead && (
                            <span
                              className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-gold-500"
                              aria-label="Unread"
                            />
                          )}

                          <span
                            className={cn(
                              'flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ring-4',
                              meta.tone,
                              meta.ring
                            )}
                          >
                            <Icon size={15} />
                          </span>

                          <span className="flex-1 min-w-0">
                            <span className="block text-xs font-semibold text-navy-950 leading-snug">
                              {notification.title}
                            </span>
                            <span className="block text-xs text-navy-600 mt-0.5 leading-snug line-clamp-2">
                              {notification.message}
                            </span>
                            <span className="flex items-center gap-2 mt-1 text-2xs text-navy-400">
                              {timeAgo(notification.createdAt)}
                              {notification.actionPath && (
                                <span className="inline-flex items-center gap-0.5 text-gold-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <ExternalLink size={9} /> Open
                                </span>
                              )}
                            </span>
                          </span>

                          <button
                            type="button"
                            onClick={(e) => handleDismiss(notification, e)}
                            aria-label="Dismiss this notification"
                            className="p-1 rounded-md text-navy-300 hover:bg-navy-100 hover:text-navy-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all flex-shrink-0"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
