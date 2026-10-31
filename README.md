# My Finances

A personal balance sheet, monthly budget planner, goals planner and ISA allowance tracker for iPhone. It's an installable web app: no App Store, no account, no subscription.

## Put it on your iPhone (free)

The app has to be served over HTTPS once so Safari can install it. After that it works offline. Free option, about 10 minutes:

1. Create a free account at github.com.
2. Create a new repository, e.g. `my-finances`. Public is fine: only the app's code is uploaded, never your data.
3. Click **Add file › Upload files** and drag in everything in this folder (`index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest` and the `icons` folder). The `tests` folder is optional.
4. In the repository, open **Settings › Pages**. Under "Build and deployment" choose **Deploy from a branch**, branch `main`, folder `/ (root)`, then **Save**.
5. After a minute or two the page shows your address, like `https://yourname.github.io/my-finances/`.
6. On your iPhone, open that address in **Safari**, tap **Share**, then **Add to Home Screen**.
7. Open it from the new icon. It runs full-screen and offline from then on.

Cost: £0. GitHub Pages is free for this. A custom domain (about £10 a year) is optional.

## Using it

- **Type amounts straight into the lists.** Tap **⋯** on any row for advanced options: formulas, one-off vs recurring, actual amounts and more.
- **Formulas** start with a reference in square brackets, e.g. `[Savings: Cash ISA / Fixed Deposit] * 30%` or `[Plan: Rent / mortgage @ previous month]`. Tap "Tap a value to insert it" to pick values instead of typing.
- **Borrowing:** in Plan, tap ⋯ on a liability to record new borrowing that month (e.g. spending on a card). It raises the balance and counts as money in, so you don't need a workaround income row.
- **New month:** at the start of each month the app asks you to confirm your real balances. The forecast is filled in; change what's different.
- **Growth projection:** on Overview, enter a yearly return (e.g. 8%) to see what your savings could be with investment growth, month by month and as a dotted line on the trend chart (can be hidden). It never changes your main forecast.
- **Growth %:** edit an investment category to add an expected yearly growth for forecasts.
- **Notes:** any category, liability, plan row, goal or goal line can have a note.
- **Goals** (e.g. an India trip): add lines that add up to the money for that goal. Each line can be typed or a formula pulling from other tabs. The target and date are optional.

## Where your data is stored

Only on your iPhone, in the installed app's private storage. Nothing is sent anywhere: no server database, no analytics, no tracking. The hosting site only serves the app's files.

Important:
- Deleting the Home Screen icon deletes the app's data. Use **Settings › Full backup (.json)** regularly and save it to Files or iCloud Drive. The app reminds you if your last backup is more than 30 days old.
- Data in the installed app is separate from data in a Safari tab, even at the same address.
- **Restore from backup** brings back everything exactly: values, formulas, formatting, hidden months and settings.

## Exports

- **Full backup (.json)**: complete and exact, and the only format the app can import.
- **Excel / Numbers (.xlsx)**: one sheet each for Savings and Liabilities, one per Plan month, plus ISA. Most calculated cells are real spreadsheet formulas that recalculate when you change a typed value. Numbers opens .xlsx files directly.
- **CSV**: values only.

## Updating the app

Upload the changed files to the same repository. The installed app picks up the new version the next time it opens with internet access.

## Tests

`tests/engine-tests.js` holds the calculation tests. To run them, open the app in a desktop browser, open the developer console and run:

```js
await (await fetch('tests/engine-tests.js')).text().then(eval)
```

They run on throwaway in-memory data and never save. Reload the page afterwards. `TEST-REPORT.md` has the full results.
