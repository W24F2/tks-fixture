/**
 * Push notification subscription management.
 *
 * Manages service worker push subscriptions and communicates with the backend
 * to register/unregister the device for fixture alerts.
 */

export type AlertLevel = 'none' | 'live' | 'all';

export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
  platform: string;
  alerts: AlertLevel;
  device_id: string;
}

/** Detect the platform for the subscription metadata. */
function getPlatform(): string {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints === 0) return 'macos';
  if (/Windows/.test(ua)) return 'windows';
  return 'other';
}

/** Check if the browser supports push notifications. */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Check if notification permission has been granted. */
export function isNotificationGranted(): boolean {
  if (!('Notification' in window)) return false;
  return Notification.permission === 'granted';
}

/**
 * Request notification permission from the user.
 * Returns true if granted, false otherwise.
 */
export async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;

  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

/**
 * Subscribe to push notifications.
 * Calls the service worker's PushManager to get a subscription,
 * then sends it to the backend for storage.
 */
export async function subscribeToPush(alerts: AlertLevel = 'all'): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const permissionGranted = await requestPermission();
    if (!permissionGranted) return false;

    const registration = await navigator.serviceWorker.ready;
    if (!registration.pushManager) return false;

    // Subscribe to push
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(getVAPIDPublicKey()) as BufferSource,
    });

    // Send subscription to backend
    const data: PushSubscriptionData = {
      endpoint: subscription.endpoint,
      p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
      auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
      platform: getPlatform(),
      alerts,
      device_id: localStorage.getItem('sf_device_id') || '',
    };

    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch {
      // Backend not available yet — subscription still works on this device
      localStorage.setItem('sf_push_subscription', JSON.stringify(subscription.toJSON()));
      localStorage.setItem('sf_push_alerts', alerts);
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Unsubscribe from push notifications.
 */
export async function unsubscribePush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.pushManager) return;

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();

      // Notify backend
      try {
        const deviceId = localStorage.getItem('sf_device_id') || '';
        await fetch(`/api/push/subscribe?device_id=${deviceId}`, {
          method: 'DELETE',
        });
      } catch {
        // Backend not available yet
        localStorage.removeItem('sf_push_subscription');
      }
    }
  } catch {
    // ignore
  }
}

/** Get the current alert level setting. */
export function getAlertLevel(): AlertLevel {
  return (localStorage.getItem('sf_push_alerts') as AlertLevel) || 'all';
}

/** Set the alert level for push notifications. */
export function setAlertLevel(alerts: AlertLevel): void {
  localStorage.setItem('sf_push_alerts', alerts);
}

/**
 * Convert a VAPID public key string from base64 to Uint8Array.
 * Needed for pushManager.subscribe().
 */
function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Get the VAPID public key for push subscriptions.
 * This should match the private key configured on the backend.
 * For development, this is a placeholder — replace with your actual VAPID key.
 */
function getVAPIDPublicKey(): string {
  // Placeholder VAPID key — replace with your actual key in production
  // Generate one at: https://pushpad.xyz/ or https://web-push-codelab.glitch.me/
  return 'BKagCclDsiIdeGZLd1WxUFP2nvmHzP2YyqDqKjG1F3K0lGmKjRrJqXjZ3jY1xN2bK3lM4oP5qR6sT7uV8wX9y';
}
