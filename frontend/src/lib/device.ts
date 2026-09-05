export function getDeviceId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  let deviceId = localStorage.getItem('sf_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('sf_device_id', deviceId);
  }
  return deviceId;
}