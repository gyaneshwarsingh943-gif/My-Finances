# Test report: My Finances 1.0

Date: 31 October 2026
Build tested: the files in this folder (offline cache version `my-finances-v3`), including the Goals tab and one-column Plan.
Environment: Chromium (the Claude desktop app's built-in browser) emulating a 375×812 iPhone screen, served from a local web server. Not a real iPhone; see "Not tested".

## Release decision

| Release condition | Status |
|---|---|
| All financial calculation tests pass | **Met.** 90 of 90 automated engine tests pass on the final build. |
| All data recovery tests pass | **Met.** 20 of 20 checks pass (persistence, corrupt storage, backup/restore, undo, confirmations). |
| No known defects causing wrong balances, lost data or broken core workflows | **Met.** Two such defects were found during testing and fixed (below). None known now. |
| Remaining minor issues documented | **Met.** See "Known minor issues". |
| Report states what was tested, passed and untested | **Met.** This document. |

**Verdict: ready to release for personal use**, with one recommendation: after installing, spend 10 minutes on the "First use on iPhone" checklist at the end. The real iPhone and Safari haven't been tested.

## Defects found and fixed during testing

1. **Formula saved on a Savings or Liabilities value could be silently lost** (data loss, serious). The app said "Formula saved", but nothing was stored, because validation restored a snapshot that replaced the data being written to. Fixed by restoring data in place and looking up the store again after validation. Retested: formulas on savings, liabilities, plan rows and repayments all save and recalculate.
2. **Pressing Enter in an inline amount field didn't always save** (broken workflow). Fixed: Enter now saves straight away, and a later blur doesn't save a second time, so there's one undo step, not two. Retested along with Escape (cancel).
3. **Unreadable saved data would have been overwritten on startup** (data-recovery risk). Fixed: the app now keeps a copy of the unreadable data, starts empty, and tells you to restore a backup. Retested by corrupting storage on purpose.

## What was tested and passed

### Calculation engine: 90/90 pass (`tests/engine-tests.js`)
- **Savings forecast:** typed balance; recurring allocation; one-off £1,200 that applies only to its month and then returns to the recurring £700; actual amount replacing planned; editing a plan amount updates every later month.
- **Worked example:** £1,200 November allocation, giving a Cash ISA forecast of £10,450 and a November total of £33,404.
- **Currency:** ₹ balance kept as typed and converted at the editable rate; a rate change updates £ totals; a £ allocation into a ₹ account is converted; ₹ amounts typed inside formulas are rejected, so different currencies are never added together.
- **Expected income:** excluded from totals by default; can be added through the total formula.
- **Formula language:** + − × ÷ ^ %, brackets, SUM/MIN/MAX/AVERAGE/ROUND/ABS, empty SUM, £ symbol.
- **Formula errors with helpful messages:** division by zero; "1,200" comma; unknown function; missing or extra bracket; empty formula; missing operator; bad number; formula ending too early.
- **References:** readable names stored by hidden ID; renaming keeps formulas working; unknown name; unknown month; case-insensitive names; references to a specific month, the previous month, totals and the rate.
- **Circular references:** two-cell loop with the path shown; a total referring to itself; a loop through Plan → automatic forecast → Plan; previous-month references correctly not flagged.
- **Deleted items:** the reference shows "Missing reference"; deleting removes the item from the total formula cleanly.
- **Liabilities:** never subtracted from savings; repayment on or off per month; skipping a month keeps the balance; recurring vs one-off amounts; actual repayment; repayment capped at the remaining balance, so a balance never goes below zero.
- **Plan:** "Left to allocate"; savings transfers not counted as spending; carry-forward of unallocated money (overspend not carried); carry-forward closing balance; formulas between Plan rows; a recurring formula re-evaluated each month.
- **ISA:** allowance used and remaining; contributions linked from Plan; manual override; a non-flexible withdrawal doesn't restore allowance, a flexible one does; forecast split at the 6 April tax-year boundary; £12,000 Cash ISA limit from 2027/28 for under-65s, none for 65+; editable allowances.
- **Months:** zero forecast months; hidden months still calculated; calculations run through a hidden month; month arithmetic across year ends; automatic rollover when a new month starts; device clock moved backwards.
- **Goals:** manual, formula, negative and blank lines added up; no target allowed; typed target; formula target; goals follow other tabs live; readable `[Goal: …]` references; one goal referencing another; goal loops caught; deleted goal reported; months until target date.
- **Formatting and input:** £ and ₹ (lakh grouping) formats; no "−£0"; amount parsing; a damaged backup repaired on load.

### Screens and workflows: all pass (scripted clicks and typing at iPhone size)
- **Inline amounts:** entering, changing, clearing (back to automatic) and rejecting bad input for savings, liabilities, plan planned/actual and repayments. Inherited recurring amounts show as calculated. Inline edits keep a one-off flag. Typing a repayment switches it on. Focus moves to the next field after saving. Enter saves, Escape cancels, and undo works.
- **Plan:** one editable amount per row. "Actual" is optional, sits in ⋯ Advanced, and when used it's shown under the row and counted in totals.
- **Goals tab:** create without a target; type lines inline; add a formula line by tapping a Savings value; negative lines; set and remove the target inline; formula target and date with the monthly amount needed; one goal from another; loop blocked; rename keeps formulas; reorder; delete with undo; Overview summary; included in Excel, CSV and backup.
- **Advanced (⋯):** formula editor; tap-to-insert values with month choice; operator keys; delete key; live preview; circular formula blocked from saving; total formula editing; one-off vs recurring; carry forward.
- **Categories:** add, rename (formulas follow), duplicate names numbered, reorder, hide, delete with confirmation (cancel keeps it), names containing code-like text shown safely.
- **Liabilities:** add with balance and default repayment; appear automatically in Plan; per-month on/off; "Paid off" state.
- **Overview:** savings and liabilities side by side, each with its own forecast; added months appear; collapses after 4 months with "Show N more" / "Show fewer".
- **Months:** add, remove, hide and show.
- **Settings:** ₹→£ rate (zero rejected; returns to the value you were editing); Automatic/Light/Dark mode; six layout colours; decimal places.
- **"Last change" date** updates on every edit; the current month and date come from the device.
- **Excel export:** valid file with 11 sheets, all XML well-formed, 160 formulas, every sheet reference valid, balanced brackets, no leftover internal references. The cached values match the app.
- **CSV export:** builds correctly.
- **Offline:** with the server stopped, the app reloaded from its cache and worked.

### Data recovery: 20/20 checks pass
Saved immediately after each change; survives reload. Corrupted storage: a copy is kept, a warning is shown, and the app stays usable. Restoring from backup gives exactly the same totals and formulas. Undoing a restore works. An invalid or garbage backup file is rejected without changing data. Cancelling a restore changes nothing. "Erase all" needs two confirmations, cancel keeps data, and erase can be undone (undo is saved). Cancelling a delete keeps the item.

## Known minor issues (none affect balances or stored data)
1. **Goal formulas use the current month's figures** unless you choose a month in the formula (e.g. `@ Mar 2027`).
2. **Undo history lasts only while the app is open.** Closing it clears undo, but your data stays.
3. **One ₹→£ rate for every month.** Past and future months use today's rate.
4. **Tax years are by month.** April contributions count in the new tax year (it assumes they're on or after 6 April).
5. **Excel export limits:** repayment "planned" cells and the ISA sheet are exported as numbers, not formulas, because the balance cap and allowance rules don't translate cleanly. Everything else is a live formula.
6. **Import is .json backups only.** You can't import edited .xlsx files back.
7. **Hidden categories and liabilities still count in totals** unless you switch off "Include in total". The Hide option says so.
8. **The over-65 Cash ISA rule** is widely reported but wasn't confirmed on GOV.UK when checked. Each tax year's limits can be edited.
9. **Offline cache** stores an extra copy of the page for each distinct address visited. This is harmless and small.

## Not tested
- **A real iPhone with Safari.** That covers Add to Home Screen, full-screen mode, safe-area spacing, the on-screen keyboard with inline fields, the iOS share sheet for exports, and long-term storage persistence. Everything was tested in Chromium at iPhone size.
- **Opening the .xlsx in Apple Numbers or Microsoft Excel.** The file structure and formulas were checked programmatically. Driving Numbers by script failed on this Mac, so Numbers never actually opened the file.
- **VoiceOver screen reader.** Labels and roles are in place but weren't tried with VoiceOver.
- **Very large data** (years of history, dozens of categories). The design handles it, but performance wasn't measured.
- **Behaviour across a real month change.** It was simulated by moving the start month and clock, not observed live.

## First use on iPhone (10-minute check)
1. Install from Safari (Share › Add to Home Screen) and open from the icon. It should be full-screen.
2. Type a balance in Savings, close the app fully, reopen. The balance should still be there.
3. Settings › Full backup. Check the share sheet appears and save to Files.
4. Settings › Excel / Numbers. Open the file in Numbers and check the totals match the app.
5. Turn on Airplane Mode and reopen the app. It should open and work.
6. Settings › Appearance › Dark. Check it's readable.
