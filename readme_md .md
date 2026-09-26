# Life Tracker PWA 📱

A modern, mobile-first, installable Progressive Web App (PWA) built to streamline your personal life tracking. **Life Tracker** combines expense logging, due dates, renewal schedules, warranties, documents, subscriptions, and reminders into a single offline-first interface.

---

## 🌟 Key Features

- **Smart Dashboard**: Instantly see today's spending, current month spending, upcoming dues, and items requiring immediate attention.
- **Expense Tracking**: Quick logging with category tags, custom categories, note fields, and budget tracking.
- **Due & Expiry Tracking**: Track recurring bills, insurances, vehicle service/PUC, ID document validity, and gadget warranties.
- **Pay & Log Integration**: Marking a recurring bill as completed can automatically log the payment as an expense and generate the next renewal date.
- **Unified Timeline & Calendar**: View all upcoming commitments, renewals, and expenses organized chronologically.
- **100% Offline & Private**: All data stays securely in your browser's local storage (`localStorage`). No external servers, no tracking, and no third-party data sharing.
- **Installable (PWA)**: Works like a native mobile app via "Add to Home Screen" on iOS and Android.

---

## 📁 Repository Structure

Ensure your repository has these core files in the root folder:

```text
├── index.html              # Main application (UI, Tailwind styling, Chart.js, and app logic)
├── manifest.json           # Web app manifest for mobile installability
├── sw.js                   # Service Worker providing offline caching
├── life-tracker-logo.png   # App icon (512x512 PNG)
└── README.md               # Documentation
```

---

## 🚀 How to Deploy to GitHub Pages

1. **Create Repository**: Create a new repository on GitHub (e.g., `life-tracker`).
2. **Upload Files**: Upload the following files to the `main` branch:
   - `index.html`
   - `manifest.json`
   - `sw.js`
   - `life-tracker-logo.png`
   - `README.md`
3. **Enable Pages**:
   - Go to your repository's **Settings** tab.
   - On the left sidebar, click **Pages**.
   - Under **Build and deployment > Source**, select **Deploy from a branch**.
   - Under **Branch**, select `main` and folder `/ (root)`, then click **Save**.
4. **Access App**: After 1–2 minutes, your app will be live at:
   ```text
   https://<your-username>.github.io/life-tracker/
   ```

---

## 📲 Installing on Your Phone

### On Android (Chrome)
1. Open your GitHub Pages URL in Google Chrome.
2. Tap the three dots menu (**⋮**) in the top-right corner.
3. Tap **Install app** or **Add to Home screen**.

### On iOS (Safari)
1. Open your GitHub Pages URL in Apple Safari.
2. Tap the **Share** button (box with an upward arrow) at the bottom.
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add** in the top-right corner.

---

## 🔒 Privacy & Local Storage

This app operates entirely client-side. Document numbers, expenses, and personal reminders never leave your device.