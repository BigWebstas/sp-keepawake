const STORAGE_KEY = 'sp-keepawake:enabled';
const BUTTON_LABEL = 'Keep Awake';
// registerWorkContextHeaderButton only renders on Today/Project/Tag views —
// unlike registerHeaderButton, it can be re-registered (same label) to swap
// icon/onClick live, which is what lets the eye / eye-slash icon reflect
// current state.
const SHOW_FOR = ['PROJECT', 'TAG', 'TODAY'];

// Chromium's Linux Wake Lock backend is unreliable under Wayland/Ozone (common on
// KDE Plasma, where it's the default session type) — navigator.wakeLock can resolve
// without actually inhibiting idle/sleep. `systemd-inhibit` talks to logind directly
// and works regardless of display server, so it's used as a desktop fallback.
//
// Each native inhibitor is short-lived (self-expires) instead of long-running, so a
// crashed/force-quit app can never leave the screen wedged awake: we just re-spawn a
// fresh one on an interval shorter than its own lifetime, while the toggle is on.
const NATIVE_RENEW_INTERVAL_MS = 120000; // 2 min
const NATIVE_INHIBIT_DURATION_SEC = 150; // 2.5 min — outlives one renewal interval

let wakeLock = null;
let enabled = localStorage.getItem(STORAGE_KEY) === 'true';
let nativeRenewTimer = null;
let nativeFallbackDead = false; // stop retrying after the first hard failure/denial

const isSupported = () => 'wakeLock' in navigator;
const hasNativeFallback = () =>
  typeof plugin !== 'undefined' && typeof plugin.executeNodeScript === 'function';

async function acquireWakeLock() {
  if (!isSupported() || wakeLock || document.visibilityState !== 'visible') {
    return;
  }
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch (err) {
    wakeLock = null;
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}

async function renewNativeInhibitor() {
  if (nativeFallbackDead || !hasNativeFallback()) {
    return;
  }
  try {
    await plugin.executeNodeScript({
      timeout: 10000,
      script: `
        const { spawn } = require('child_process');
        try {
          const child = spawn(
            'systemd-inhibit',
            [
              '--what=idle:sleep',
              '--who=Super Productivity (sp-keepawake)',
              '--why=Keep Awake plugin enabled',
              '--mode=block',
              'sleep', '${NATIVE_INHIBIT_DURATION_SEC}',
            ],
            { detached: true, stdio: 'ignore' },
          );
          child.on('error', () => {});
          child.unref();
        } catch (e) {
          // no systemd-inhibit on this system — fine, wakeLock is the baseline
        }
        return true;
      `,
    });
  } catch (err) {
    // Consent denied, no nodeExecution support, or script failed — stop retrying
    // so we don't re-trigger the consent prompt every renewal interval.
    nativeFallbackDead = true;
  }
}

function startNativeFallback() {
  if (nativeRenewTimer || nativeFallbackDead || !hasNativeFallback()) {
    return;
  }
  renewNativeInhibitor();
  nativeRenewTimer = setInterval(renewNativeInhibitor, NATIVE_RENEW_INTERVAL_MS);
}

function stopNativeFallback() {
  if (nativeRenewTimer) {
    clearInterval(nativeRenewTimer);
    nativeRenewTimer = null;
  }
}

async function acquire() {
  await acquireWakeLock();
  startNativeFallback();
}

function release() {
  releaseWakeLock();
  stopNativeFallback();
}

function renderButton() {
  PluginAPI.registerWorkContextHeaderButton({
    label: BUTTON_LABEL,
    icon: enabled ? 'visibility' : 'visibility_off',
    showFor: SHOW_FOR,
    onClick: toggle,
  });
}

async function toggle() {
  enabled = !enabled;
  localStorage.setItem(STORAGE_KEY, String(enabled));

  if (enabled) {
    if (!isSupported() && !hasNativeFallback()) {
      enabled = false;
      localStorage.setItem(STORAGE_KEY, 'false');
      renderButton();
      PluginAPI.showSnack({
        msg: 'Screen Wake Lock is not supported on this device/browser.',
        type: 'ERROR',
      });
      return;
    }
    await acquire();
    renderButton();
    PluginAPI.showSnack({
      msg: wakeLock || hasNativeFallback() ? 'Keep Awake: ON' : 'Could not keep the screen awake.',
      type: wakeLock || hasNativeFallback() ? 'SUCCESS' : 'ERROR',
    });
  } else {
    release();
    renderButton();
    PluginAPI.showSnack({ msg: 'Keep Awake: OFF', type: 'INFO' });
  }
}

// The OS/browser releases the Wake Lock sentinel whenever the document is hidden
// (tab switch, app backgrounded, screen lock). Re-request it once the app is
// visible again if the user still wants it on. The native fallback isn't tied to
// visibility — it keeps renewing regardless.
function onVisibilityChange() {
  if (enabled && document.visibilityState === 'visible') {
    acquireWakeLock();
  }
}

document.addEventListener('visibilitychange', onVisibilityChange);

if (enabled) {
  acquire();
}
renderButton();

if (typeof plugin !== 'undefined' && plugin.onUnload) {
  plugin.onUnload(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    stopNativeFallback();
    releaseWakeLock();
  });
}
