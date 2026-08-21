# Packaging biblio for Android

**Status: ready to package.** The repo now carries everything the tooling needs;
the build itself happens outside it.

## What kind of app this is

A **Trusted Web Activity** — an Android shell that runs biblio in Chrome's
engine, full screen, with no browser furniture. Not a WebView wrapper, and the
distinction matters:

> **Google blocks OAuth sign-in inside embedded WebViews.** A Capacitor or
> Cordova wrapper would look like an app and then fail at the front door, which
> is the one screen it cannot afford to fail at.

A TWA is Chrome underneath, so sign-in, IndexedDB, the service worker,
biometrics and Drive all behave exactly as they do in the browser. It also
shares storage with Chrome, so someone who used the site is already signed in
inside the app.

**The APK is a shell.** biblio itself still loads from Vercel, which means every
deploy reaches the app immediately with nothing to reinstall.

## The quick way — PWABuilder

No tooling to install.

1. Go to **pwabuilder.com**, enter the deployment URL
2. **Package for stores → Android**
3. Leave *Trusted Web Activity* selected; check the package id (something like
   `app.vercel.wam_biblio.twa`) — **it can never change afterwards**
4. Download the zip. It contains the APK, an AAB for the Play Store later, and
   `signing.keystore` plus `signing-key-info.txt`

**Keep that keystore somewhere safe and backed up.** Lose it and you can never
update the app on the Play Store — only start again under a new listing.

## Then tell the site the app is genuine

The zip contains an `assetlinks.json` with a SHA-256 fingerprint. Without it the
app runs but Chrome shows the address bar across the top.

In Vercel, set:

| Variable | Value |
|---|---|
| `ANDROID_PACKAGE` | the package id you chose |
| `ANDROID_CERT_FINGERPRINTS` | the SHA-256 fingerprint, `AA:BB:CC:…` |

Redeploy, then check `https://<your-app>/.well-known/assetlinks.json` returns
your fingerprint. Several may be listed comma-separated — an upload key plus
Play's own signing key needs exactly that.

Verification is cached, so install the app **after** the fingerprint is live.

## Side-loading it

1. Put the APK on the phone (email, Drive, USB)
2. Open it; Android will ask permission to install from that source — allow it
   for that app only
3. It installs as *biblio*, with the icon and no browser bar

## What to check on the old phone

- **The address bar is gone.** If it isn't, asset links aren't verified yet.
- **Sign in with Google** — the one thing a WebView wrapper would break
- **Aeroplane mode** — it should still open and let you write
- **A photo** — Drive upload from a real device
- **Biometrics** — the fingerprint reader on an older phone is a good test

## If you'd rather build it locally

`@bubblewrap/cli` does the same job from a terminal and gives more control. It
needs JDK 17+ and downloads the Android SDK (about a gigabyte). PWABuilder runs
Bubblewrap for you, so the output is the same thing.

## Later, the Play Store

Internal testing takes up to 100 testers by email and needs no review, which is
a gentler distribution than sending an APK around. It needs the AAB from the
same zip, a developer account (one-off fee), a privacy policy URL and a store
listing. Nothing here has to change for it.
