# New Special Eyebrows & Beauty

Static website (`index.html`) plus a staff-only admin page (`admin.html`) for:

- **Appointments**: booking requests from the website are saved and their times show as taken in the calendar. Staff can accept, decline or cancel them, and customers are emailed if they left an email address.
- **Rewards program**: sign customers up with name, phone and an optional email. Each visit adds a **punch** (every N visits earns a reward) and **points** (per $ spent, redeemable for $ off).
- **Services & prices**: add, edit, reorder, hide or delete services. The website menu and booking form update automatically.

Data is stored in **Firebase** (Firestore + Authentication). Until Firebase is configured, the public site shows the default menu from `js/services-data.js`.

## Files

| File | Purpose |
|---|---|
| `index.html` | Public site. Loads live services from Firestore and falls back to defaults if Firebase isn't set up |
| `admin.html`, `js/admin.js` | Staff admin: Appointments, Rewards, Services & Prices, Settings |
| `js/firebase-config.js` | **Paste your Firebase web config here** |
| `js/email-config.js` | **Paste your email script URL here** (booking + accept/decline emails) |
| `email-script/` | Free email sender (Google Apps Script + Gmail): copy into script.google.com |
| `js/services-data.js` | Default services (with durations), categories, reward rules, opening hours |
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
9. **Emails**: free, sent from your Gmail. See [Emails](#emails-free-via-gmail) below.

## Emails (free, via Gmail)

Emails are sent by a small Google Apps Script that runs under your Google account. It's free, with no card needed.
A regular Gmail account can send about **100 emails a day**; Google Workspace accounts can send about 1,500.

| When | Who gets it |
|---|---|
| A customer requests a booking | You (with all the details), plus a "request received" email to the customer if they gave an email |
| You accept, decline or cancel | The customer, if they gave an email (with your reason, if you typed one) |

The website only sends the booking's ID. The script looks the booking up in Firebase itself and sends each email only once, so nobody can use it to send their own messages.

**Setup (about 5 minutes):**
1. Sign in to <https://script.google.com> with **the same Google account that owns the Firebase project** and click **New project**.
2. Replace the contents of `Code.gs` with `email-script/Code.gs` from this repo.
   At the top, set `OWNER_EMAIL` to the inbox that should receive new requests. Optionally set `ADMIN_URL`.
3. Click ⚙ **Project Settings** and tick **Show "appsscript.json" manifest file in editor**.
   Then back in the editor, replace `appsscript.json` with `email-script/appsscript.json`.
4. Select the `testSetup` function and click **▶ Run**. Allow the permissions it asks for: Gmail sending, external requests and Firestore.
   The log should say `Firestore access: OK`.
5. Click **Deploy → New deployment**. Pick type **Web app**, with *Execute as*: **Me** and *Who has access*: **Anyone**. Click **Deploy**, then copy the **Web app URL**.
6. Paste that URL into `js/email-config.js` (`EMAIL_SCRIPT_URL`) and publish the site.

If you later edit `Code.gs`, use **Deploy → Manage deployments → Edit → Version: New version**. That keeps the same URL.

Without the script URL, bookings are still saved and shown in admin, but no emails are sent. Use the Call/Text links instead.

## Using the admin page

The **Staff Login** link is in the site footer, or go to `/admin.html`.

- **Appointments** (opens first; the badge shows how many requests are waiting)
  - **Pending**: new requests. **Accept** confirms the booking. **Decline** asks for an optional reason and frees the time.
  - **Upcoming** / **Past**: accepted appointments. Upcoming ones can be **cancelled**, which frees the time.
  - **Declined**: declined and cancelled requests, with the reason.
  - Each card has Call / Text / Email links. If the phone number belongs to a rewards member, a tag opens their rewards card.
- **How times are blocked**
  - The website offers 30-minute start times from 9:00 AM to 6:00 PM (closed Sundays). The studio closes at 6:30 PM.
  - A request blocks enough 30-minute slots to cover the total duration of the services picked. For example, a 60-min Luxe Facial at 10:00 blocks 10:00 and 10:30.
  - **Pending and accepted** requests block their time. **Declined and cancelled** ones release it.
  - **Settings → Booking** sets how many customers you can take at the same time. A time is unavailable once that many bookings overlap it.
  - If two people pick the same last spot at the same moment, the second is asked to choose another time.

- **Rewards**
  - **New**: sign up a member (name, phone, optional email). The phone number is the unique ID, so duplicates are blocked.
  - Search by phone digits, name or email.
  - **Record a visit**: tap the services performed to fill in the amount, or type it, then click **Record visit**.
    This adds one punch and `amount × points-per-$` points. Each full punch card adds one "reward ready".
  - **Redeem** a punch-card reward or redeem points. **Adjust** adds or removes points manually, with a reason.
  - Every action is saved in the member's *Recent activity*.
- **Services & Prices**: edit a row (name, category, price, **duration**) and click **Save changes**. Use the **Live** checkbox to hide or show a service, the arrows to reorder, and the bin icon to delete.
  Luxe Facial, Brow Tint and Basic Henna have their own cards on the website. Any new service outside Threading appears under **More Services**.
- **Settings**: booking capacity, plus reward rules (punch-card size and reward, points per $1, and points needed to redeem with their $ value).

> **Updating from an earlier version?** Re-publish `firestore.rules`, because it now includes rules for `appointments` and `slots`. Also open **Services & Prices** and set a duration for each service (services without one count as 30 min).

## Local testing with the emulator (optional)

```bash
firebase emulators:start --only firestore,auth --project demo-salon
```
```bash
python3 -m http.server 5500
```
Open `http://localhost:5500/admin.html?emulator`. The `?emulator` flag connects to the local emulators instead of the live project.
Create a test user in the emulator with the email listed in `firestore.rules`.
