# Spelunkr for Samsung TV

A small Tizen app that brings [spelunkr.tv](https://spelunkr.tv/) to Samsung TVs, launched from the TV's
home screen and run with the remote. It fixes the problem that stops Spelunkr's videos from playing in the
TV's own browser, and makes the remote's Back, Channel and volume behave like a TV.

Not affiliated with Spelunkr. All programming comes from Spelunkr and the Internet Archive.

- `app/` holds the TV app: `config.xml`, a splash page (`index.html`, `style.css`), the loader and patch (`main.js`), and `icon.png`.
- `deploy.ps1` packages, signs, installs and launches the app on your TV.

## Requirements

- A **Samsung smart TV running Tizen** (2017 or newer). Tested on a 2023 Crystal UHD CU7000 running Tizen 9.0.
- A **Windows PC** on the same home network as the TV.
- A free **Samsung account**, used to create the signing certificate Samsung TVs require.
- About **10 GB** of disk space for Tizen Studio.

## Install

### 1. Get the code

Download this repo as a ZIP from GitHub (**Code → Download ZIP**) and unzip it, or clone it:

```powershell
git clone https://github.com/snk3x/spelunkr-tizen.git
```

### 2. Find your PC's and TV's IP addresses

- **PC:** run `ipconfig` and note the IPv4 address, for example `192.168.1.64`.
- **TV:** on the TV, open **Settings → All Settings → Connection → Network → Network Status → IP Settings**.

It helps to give both a fixed IP in your router, so you don't have to redo the setup when an address changes.

### 3. Turn on Developer Mode on the TV

1. Press **Home** and open **Apps**.
2. Type **1 2 3 4 5** with the remote. On remotes without number keys, use the on-screen number pad from the **123** button.
3. Switch **Developer Mode** to **On**, enter your **PC's IP address**, and press **OK**.
4. **Unplug the TV from the wall for 30 seconds**, then plug it back in. Turning it off with the remote usually isn't enough.
5. Open **Apps** again. A **Developer Mode** label at the top of the screen means it worked.

### 4. Install Tizen Studio

1. Download the **Tizen Studio with IDE installer** for Windows from
   https://developer.tizen.org/development/tizen-studio/download and install it to `C:\tizen-studio`.
2. In Tizen Studio's **Package Manager**:
   - **Main SDK** tab: install **Tizen SDK tools**.
   - **Extension SDK** tab: install **TV Extensions Tools**, **Web app. tools** (TV Extensions), and
     **Samsung Certificate Extension** (version 2.0.73 or newer).

### 5. Connect to the TV

In Tizen Studio, open **Tools → Device Manager → Remote Device Manager**, add your TV's IP address with port
**26101**, and switch **Connection** on. Or from PowerShell:

```powershell
C:\tizen-studio\tools\sdb.exe connect <TV IP>
```

### 6. Create a Samsung certificate

1. Open **Tools → Certificate Manager**. If it doesn't open, run
   `C:\tizen-studio\tools\certificate-manager\CertificateManager.bat`.
2. Click **+**, choose **Samsung**, then **TV**.
3. Enter a profile name, for example `SpelunkrTV`.
4. Create a new **author certificate** with a name and a password. Keep the password: you'll need it to renew the certificate.
5. **Sign in with your Samsung account** when asked.
6. For the **distributor certificate**, keep the privilege at **Public** and make sure your TV's **DUID** is listed.
   It fills in automatically while the TV is connected.

### 7. Install the app

From the repo folder:

```powershell
.\deploy.ps1 -CertProfile SpelunkrTV -TvIp <TV IP>
```

The script packages and signs the app, installs it and opens it on the TV. **Spelunkr** then appears in the
TV's **Apps** list. To pin it to the home bar, highlight it, press **Down**, and choose **Add to Home**.

If Tizen Studio isn't installed in `C:\tizen-studio`, add `-TizenStudio <path>`.

### Updating

Pull or download the latest version and run the same `deploy.ps1` command again.

## Troubleshooting

- **`failed to connect to remote target`:** Developer Mode isn't active, or it points at a different PC IP.
  Check the IP in the 12345 menu and unplug the TV for 30 seconds.
- **Developer Mode won't stay on:** the TV needs a full restart after you change it. Unplug it; the remote's power button isn't enough.
- **Install fails with a certificate error:** the certificate must include your TV's DUID. Recreate the
  distributor certificate while the TV is connected.
- **The app disappeared:** firmware updates can remove sideloaded apps. Run `deploy.ps1` again.
- **Videos stop playing after a Spelunkr update:** see *How video playback is fixed* below. The patch may need updating.

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
- handles the remote keys described above.

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

## License

[MIT](LICENSE)
