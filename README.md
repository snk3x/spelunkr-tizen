# Spelunkr for Samsung TV (personal wrapper)

A tiny Tizen app that opens https://spelunkr.tv/ full screen from the TV's home screen.
It works like Spelunkr's own Android TV app, which is the site full screen. Not affiliated with Spelunkr.

- `app/` holds the TV app: `config.xml`, a splash page (`index.html`) that loads the site, and `icon.png`.
- `deploy.ps1` packages, signs, installs and launches it on the TV at 192.168.1.53.

## One-time setup

1. **Install Tizen Studio** from https://developer.tizen.org/development/tizen-studio/download.
   In its Package Manager, under Extension SDK, install **TV Extensions** and **Samsung Certificate Extension**.
   The certificate add-on must be version 2.0.73 or newer.
2. **Turn on Developer Mode on the TV.** Open Apps, type `12345` on the remote, switch Developer Mode on,
   enter this PC's IP address, then hold the power button to restart the TV.
3. **Create a Samsung certificate.** In Tizen Studio, open Tools → Certificate Manager → `+` → Samsung.
   Choose TV, sign in with your Samsung account, and when asked for a device, connect to the TV so its DUID is added.
   Note the profile name you choose.

## Install

```powershell
.\deploy.ps1 -CertProfile <your profile name>
```

Spelunkr then shows up in the TV's Apps list. To pin it, highlight it, press Down, then choose Move or Add to Home.

## Remote

- **Arrows and OK** work the site's guide.
- **Channel Up / Down** change the channel. The TV reports these buttons as key codes 427 and 428;
  the patch re-sends them under the site's `ChannelUp`/`ChannelDown` names. The mapping is swapped
  on purpose, because unswapped it felt backwards on the remote.
- **Volume** starts at full. The site's player defaults to 50% and doesn't remember changes,
  so the patch doubles every volume the site sets, capped at 100%.
- **Back** leaves full screen first. Otherwise the site uses it, for example to go from a channel back to the guide.
  On the home screen, if the site doesn't use Back for anything, it closes the app.
- **Home** always leaves the app.

## How video playback is fixed

Samsung's video player fails when it seeks deep into an Internet Archive video through archive.org's redirect
(`PIPELINE_ERROR_NETWORK`), but it plays fine from the direct file address. That's why Spelunkr's videos
don't play in the TV's browser.

To get around it, `app/main.js` downloads the spelunkr.tv page and loads it inside the app instead of just opening the site.
It adds a `<base href="https://spelunkr.tv/">` tag and a small patch that:

- swaps every `archive.org/download/...` video address for its direct server address
  (it follows the redirect once and remembers the result);
- keeps the site's in-app navigation on the local page so the patch stays active;
- closes the app when you press Back and there's no page left to go back to.

If the page can't be downloaded, the app falls back to opening spelunkr.tv directly.

**Fragile by nature:** this depends on how Spelunkr's site is built today. If they change it a lot, the patch may need
updating. The proper fix is on their side: use the direct file address before seeking.

## Debugging on the TV

Launch in debug mode and forward DevTools:

```powershell
C:\tizen-studio\tools\sdb.exe shell 0 debug SpLnkrTV01.Spelunkr
C:\tizen-studio\tools\sdb.exe forward tcp:9222 tcp:<port printed above>
```

Then open `http://127.0.0.1:9222/json` for the DevTools WebSocket address.
