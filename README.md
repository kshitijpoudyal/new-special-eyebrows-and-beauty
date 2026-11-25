# New Special Eyebrows & Beauty

Static website (`index.html`) plus a staff-only admin page (`admin.html`) for:

- **Rewards program**: sign customers up with name, phone and an optional email. Each visit adds a **punch** (every N visits earns a reward) and **points** (per $ spent, redeemable for $ off).
- **Services & prices**: add, edit, reorder, hide or delete services. The website menu and booking form update automatically.

Data is stored in **Firebase** (Firestore + Authentication). Until Firebase is configured, the public site shows the default menu from `js/services-data.js`.

## Files

| File | Purpose |
|---|---|
| `index.html` | Public site. Loads live services from Firestore and falls back to defaults if Firebase isn't set up |
| `admin.html`, `js/admin.js` | Staff admin: Rewards, Services & Prices, Reward Rules |
| `js/firebase-config.js` | **Paste your Firebase web config here** |
| `js/services-data.js` | Default services, categories and reward rules |
| `firestore.rules` | Security rules: **put your admin email(s) here** |
| `firebase.json` | Firebase CLI config (rules, hosting, emulators) |

## One-time setup

1. **Create a project** at <https://console.firebase.google.com> (Analytics is optional).
2. **Firestore**: open *Build → Firestore Database → Create database* and start in **production mode**.
3. **Authentication**: open *Build → Authentication → Get started* and enable **Email/Password**.
   Then on the *Users* tab, choose **Add user** and enter the email and password staff will use to sign in.
   (No public sign-up exists, so only accounts you create here can log in.)
4. **Web config**: open *Project settings → General → Your apps* and add a **Web app** (`</>`).
   Copy the `firebaseConfig` values into `js/firebase-config.js`.
5. **Admin allowlist**: in `firestore.rules`, replace `admin@example.com` with the email from step 3.
   For several admins, use `['owner@gmail.com', 'manager@gmail.com']`.
6. **Deploy the rules** using either option:
   - Console: *Firestore → Rules*. Paste the contents of `firestore.rules` and click **Publish**.
   - CLI:
     ```bash
     npm i -g firebase-tools
     ```
     ```bash
     firebase login
     ```
     ```bash
     firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
     ```
7. **Authorized domains**: if the site is hosted somewhere other than Firebase Hosting, add that domain under
   *Authentication → Settings → Authorized domains*.
8. Open `admin.html`, sign in, go to **Services & Prices** and click **Load default services**.

## Using the admin page

The **Staff Login** link is in the site footer, or go to `/admin.html`.

- **Rewards**
  - **New**: sign up a member (name, phone, optional email). The phone number is the unique ID, so duplicates are blocked.
  - Search by phone digits, name or email.
  - **Record a visit**: tap the services performed to fill in the amount, or type it, then click **Record visit**.
    This adds one punch and `amount × points-per-$` points. Each full punch card adds one "reward ready".
  - **Redeem** a punch-card reward or redeem points. **Adjust** adds or removes points manually, with a reason.
  - Every action is saved in the member's *Recent activity*.
- **Services & Prices**: edit a row and click **Save changes**. Use the **Live** checkbox to hide or show a service, the arrows to reorder, and the bin icon to delete.
  Luxe Facial, Brow Tint and Basic Henna have their own cards on the website. Any new service outside Threading appears under **More Services**.
- **Reward Rules**: punch-card size and reward, points per $1, and points needed to redeem with their $ value.

## Local testing with the emulator (optional)

```bash
firebase emulators:start --only firestore,auth --project demo-salon
```
```bash
python3 -m http.server 5500
```
Open `http://localhost:5500/admin.html?emulator`. The `?emulator` flag connects to the local emulators instead of the live project.
Create a test user in the emulator with the email listed in `firestore.rules`.
