# sp-keepawake

Super Productivity plugin that keeps the screen on while the app is open, on
desktop (Electron), Android, and iOS 16.4+. Uses the standard [Screen Wake
Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
as the primary mechanism everywhere — no native build changes needed.

On Linux desktop, Chromium's Wake Lock backend is unreliable under
Wayland/Ozone (the default session type on current KDE Plasma): the API call
can resolve without actually blocking idle/sleep. As a desktop-only fallback,
the plugin also shells out to `systemd-inhibit` directly via the plugin
`nodeExecution` permission. The first time you turn Keep Awake on, Super
Productivity will show a native "Allow this plugin to run code on your
machine?" consent prompt — accept it once per device. If you decline, or
`systemd-inhibit` isn't available, the plugin silently falls back to
Wake-Lock-only behavior.

The native inhibitor is intentionally short-lived (2.5 min) and renewed every
2 min while enabled, rather than held open indefinitely — so a crashed or
force-quit app can never leave the screen permanently wedged awake; it just
expires on its own within a couple of minutes.

## Build

```sh
npm run build
```

Produces `dist/sp-keepawake.zip`. Or grab it from the
[latest release](https://github.com/BigWebstas/sp-keepawake/releases/latest).

## Install

Settings → Plugins → Choose Plugin File → select `sp-keepawake.zip`.

## Use

A "Keep Awake" button appears in the header on the Today, Project, and Tag
views (not on Settings or other screens — that's the trade-off for the icon
being able to update live). The eye icon is open when the wake lock is on and
slashed when it's off. Click it to toggle. The choice is remembered per
device (`localStorage`) and re-applied on next launch and whenever the app
returns to the foreground.

## Known limitations

- iOS/iPadOS versions before 16.4 don't implement the Wake Lock API in
  WKWebView; the button will show an error snack there instead of doing
  nothing silently.
- Re-uploading an updated `sp-keepawake.zip` over an existing install clears
  the `nodeExecution` consent grant, so the native-fallback prompt reappears
  once after an update.
