# sp-keepawake

Super Productivity plugin that keeps the screen on while the app is open, on
desktop (Electron), Android, and iOS 16.4+. Uses the standard [Screen Wake
Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
everywhere — no native build changes needed, and no elevated permissions.

**Known gap:** on Linux desktop, Chromium's Wake Lock backend is unreliable
under Wayland/Ozone (the default session type on current KDE Plasma) — the
API call can resolve without actually blocking idle/sleep, so the toggle may
silently do nothing there. There's no plugin-API way to work around this
without shelling out to a native process (`nodeExecution`, with its "full
machine access" consent prompt), which was judged not worth the trade-off
for this plugin. If you hit this, a workaround outside the plugin is forcing
X11 instead of Wayland for the app (`--ozone-platform=x11`).

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

Every time you click the button, the plugin checks GitHub for a newer release
(at most once per day, via the `http` permission) and, if one exists, shows a
popup with a link to it. This is a passive check against the public GitHub
API only — no telemetry is sent.

## Known limitations

- iOS/iPadOS versions before 16.4 don't implement the Wake Lock API in
  WKWebView; the button will show an error snack there instead of doing
  nothing silently.
- See the Wayland/KDE gap noted above.
