/* Calculation engine tests for My Finances.
   How to run: open the app in a desktop browser, open the developer console and run
     await (await fetch('tests/engine-tests.js')).text().then(eval)
   It works on throwaway in-memory data and never saves. Reload the page afterwards. */
(() => {
  const keep = S;
  const results = [];
  const ok = (name, cond, extra = '') => results.push((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + extra));
  const eq = (a, b) => typeof a === 'number' && Math.abs(a - b) < 1e-6;
  const fresh = () => { S = blankState(); resetCalc(); };
  const cm = curM(), m1 = addM(cm, 1), m2 = addM(cm, 2), m3 = addM(cm, 3), m4 = addM(cm, 4);
  const errOf = (f) => { try { evaluate(f, cm, getRef); return null; } catch (e) { return e.message; } };
  const mi = (t) => { try { toInternal(t); return null; } catch (e) { return e.message; } };
  try {
    /* Savings forecast and the worked example */
    fresh();
    const [ss, cash, ind, fut] = S.cats;
    S.catCells[ss.id] = { [cm]: { v: 18400 } }; S.catCells[cash.id] = { [cm]: { v: 9250 } };
    S.catCells[ind.id] = { [cm]: { v: 450000 } }; S.catCells[fut.id] = { [cm]: { v: 2500 } };
    const lCash = S.lines.find((l) => l.name === 'Cash ISA'), lSS = S.lines.find((l) => l.name === 'Stocks & Shares ISA');
    lCash.entries[cm] = { amt: 700 }; lCash.entries[m1] = { amt: 1200, once: true }; lSS.entries[cm] = { amt: 500 };
    resetCalc();
    ok('typed balance', eq(catNative(cash.id, cm), 9250));
    ok('one-off £1,200 flows into forecast', eq(catNative(cash.id, m1), 10450));
    ok('next month returns to recurring £700', eq(catNative(cash.id, m2), 11150));
    ok('recurring S&S', eq(catNative(ss.id, m1), 18900));
    ok('INR converted to GBP', eq(catGBP(ind.id, cm), 450000 / 111));
    ok('expected income excluded from total', eq(savTotal(cm), 18400 + 9250 + 450000 / 111));
    lCash.entries[m1].amt = 1500; resetCalc();
    ok('editing plan updates forecast', eq(catNative(cash.id, m1), 10750) && eq(catNative(cash.id, m2), 11450));
    lCash.entries[m1].actual = 1000; resetCalc();
    ok('actual replaces planned', eq(catNative(cash.id, m1), 10250));
    S.settings.rates.INR.perGBP = 100; resetCalc();
    ok('rate change', eq(catGBP(ind.id, cm), 4500));
    S.lines.push({ id: 'li1', sec: 'saving', name: 'To India', link: ind.id, behaviour: 'normal', opening: 0, entries: { [m1]: { amt: 100, once: true } } }); resetCalc();
    ok('£ allocation into ₹ account converted', eq(catNative(ind.id, m1), 450000 + 100 * 100));

    /* Formula language */
    ok('precedence', eq(evaluate('2+3*4', cm, getRef), 14));
    ok('percent', eq(evaluate('50% * 200', cm, getRef), 100));
    ok('nested SUM', eq(evaluate('SUM(1,2,SUM(3,4))', cm, getRef), 10));
    ok('MIN/MAX/AVERAGE/ABS', eq(evaluate('MIN(3,1)+MAX(3,1)+AVERAGE(2,4)+ABS(-2)', cm, getRef), 9));
    ok('SUM() is 0', eq(evaluate('SUM()', cm, getRef), 0));
    ok('£ sign ignored', eq(evaluate('£100+1', cm, getRef), 101));
    ok('× ÷ − accepted', eq(evaluate('10 × 2 ÷ 4 − 1', cm, getRef), 4));
    ok('division by zero', /Division/.test(errOf('1/0')));
    ok('thousands comma explained', /comma/.test(errOf('1,200')));
    ok('unknown function', /Unknown function/.test(errOf('FOO(1)')));
    ok('missing bracket', /missing/i.test(errOf('(1+2')));
    ok('extra bracket', /extra/.test(errOf('1+2)')));
    ok('empty', /empty/.test(errOf('')));
    ok('missing operator', /missing between/.test(errOf('2 3')));
    ok('₹ in formula rejected', /INR/.test(errOf('₹100')));
    ok('ends early', /early/.test(errOf('1+')));
    ok('bad number', /not a number/.test(errOf('1.2.3')));

    /* Readable references */
    const internal = toInternal('[Savings: Cash ISA / Fixed Deposit @ previous month] + [Total savings]');
    ok('readable → stored', internal === `{s:${cash.id}@prev} + {T:_}`);
    cash.name = 'Cash pot';
    ok('rename keeps formulas', toDisplay(internal) === '[Savings: Cash pot @ previous month] + [Total savings]');
    cash.name = 'Cash ISA / Fixed Deposit';
    ok('unknown name', /Missing reference/.test(mi('[Savings: Nope]')));
    ok('unknown month', /Unknown month/.test(mi('[Total savings @ Smarch 2026]')));
    ok('month label', toInternal('[Total savings @ Nov 2026]') === '{T:_@2026-11}');
    ok('case-insensitive', toInternal('[savings: cash isa / fixed deposit]') === `{s:${cash.id}}`);
    ok('curly brackets rejected', /Curly/.test(mi('{s:x}')));
    ok('unclosed [ rejected', /square/.test(mi('[Total savings + 1')));

    /* Circular and missing references */
    fresh();
    const c0 = S.cats[0], c1 = S.cats[1];
    S.catCells[c0.id] = { [cm]: { f: `{s:${c1.id}}` } }; S.catCells[c1.id] = { [cm]: { f: `{s:${c0.id}}` } }; resetCalc();
    let r = safe(() => catNative(c0.id, cm));
    ok('circular detected with path', r instanceof FErr && /Circular.*→/.test(r.message));
    ok('error reaches total safely', safe(() => savTotal(cm)) instanceof FErr);
    fresh(); S.savTotal.f = '{T:_} + 1'; resetCalc();
    ok('total referencing itself', safe(() => savTotal(cm)) instanceof FErr);
    fresh(); S.catCells[S.cats[0].id] = { [cm]: { v: 100 }, [m1]: { f: `{s:${S.cats[0].id}@prev} * 2` } }; resetCalc();
    ok('previous-month reference is not circular', eq(catNative(S.cats[0].id, m1), 200) && eq(catNative(S.cats[0].id, m2), 200));
    ok('before first month = 0', eq(evaluate(`{s:${S.cats[0].id}@${addM(cm, -5)}}`, cm, getRef), 0));
    fresh(); const cDel = S.cats[0];
    S.catCells[S.cats[1].id] = { [cm]: { f: `{s:${cDel.id}} + 5` } };
    S.cats = S.cats.filter((c) => c.id !== cDel.id); S.savTotal.f = removeRefFromSum(S.savTotal.f, 's', cDel.id); resetCalc();
    r = safe(() => catNative(S.cats[0].id, cm));
    ok('deleted reference reported', r instanceof FErr && /Missing/.test(r.message));
    ok('deleted item removed from total cleanly', !/,\s*,|\(\s*,|,\s*\)/.test(S.savTotal.f));
    ok('sum helpers', addRefToSum('SUM()', '{s:a}') === 'SUM({s:a})' && addRefToSum('SUM({s:a})', '{s:b}') === 'SUM({s:a}, {s:b})' &&
      removeRefFromSum('SUM({s:a}, {s:b}, {s:c})', 's', 'b') === 'SUM({s:a}, {s:c})' && removeRefFromSum('SUM({s:a})', 's', 'a') === 'SUM()' &&
      removeRefFromSum('{s:a} + {s:b}', 's', 'b') === '{s:a}');

    /* Liabilities and repayments */
    fresh();
    S.liabs.push({ id: 'cc', name: 'Card', repay: 300, autoPay: false }, { id: 'car', name: 'Car', repay: 310, autoPay: true });
    S.liabTotal.f = 'SUM({l:cc}, {l:car})';
    S.liabCells.cc = { [cm]: { v: 300 } }; S.liabCells.car = { [cm]: { v: 6800 } };
    S.repay.cc = { [m1]: { on: true } }; resetCalc();
    ok('repayment off by default', eq(repayUsed('cc', cm), 0));
    ok('switched on for one month', eq(repayUsed('cc', m1), 300) && eq(liabVal('cc', m1), 0));
    S.repay.cc[m2] = { on: true }; resetCalc();
    ok('capped at zero balance', eq(repayUsed('cc', m2), 0) && eq(liabVal('cc', m2), 0));
    ok('automatic monthly repayment', eq(liabVal('car', m4), 6800 - 4 * 310));
    S.repay.car = { [m2]: { on: false } }; resetCalc();
    ok('skip a month', eq(liabVal('car', m2), 6490) && eq(liabVal('car', m3), 6180));
    S.repay.car[m3] = { amt: 500 }; resetCalc();
    ok('recurring amount change', eq(repayUsed('car', m3), 500) && eq(repayUsed('car', m4), 500));
    S.repay.car[m3].once = true; resetCalc();
    ok('one-off amount', eq(repayUsed('car', m3), 500) && eq(repayUsed('car', m4), 310));
    S.repay.car[m1] = { actual: 1000 }; resetCalc();
    ok('actual repayment', eq(liabVal('car', m1), 5800));
    S.liabCells.car = { [cm]: { v: 200 } }; S.repay.car = {}; resetCalc();
    ok('repayment capped at remaining balance', eq(repayUsed('car', m1), 200) && eq(liabVal('car', m1), 0));
    ok('liabilities total kept separate', eq(liabTotal(m1), 0) && eq(savTotal(m1), 0));

    /* Plan */
    fresh();
    const L = (n) => S.lines.find((l) => l.name === n);
    L('Salary (net)').entries[cm] = { amt: 4000 }; L('Rent / mortgage').entries[cm] = { amt: 1500 };
    L('Cash ISA').entries[cm] = { amt: 700 }; L('Cash ISA').entries[m1] = { amt: 1200, once: true };
    S.liabs.push({ id: 'car', name: 'Car', repay: 300, autoPay: true }); S.liabCells.car = { [cm]: { v: 5000 } };
    resetCalc();
    ok('left to allocate', eq(planSummary(cm).left, 4000 - 1500 - 700 - 300));
    ok('transfers are not expenses', eq(planSummary(m1).expense, 1500) && eq(planSummary(m1).saving, 1200));
    S.settings.carryLeft = true; resetCalc();
    ok('carry unallocated forward', eq(planSummary(m1).bf, 1500));
    L('Rent / mortgage').entries[cm].amt = 5000; resetCalc();
    ok('overspend not carried', eq(planSummary(m1).bf, 0));
    S.settings.carryLeft = false;
    const pot = { id: 'pot', sec: 'expense', name: 'Pot', link: null, behaviour: 'carry', opening: 100, entries: { [cm]: { amt: 50 } } };
    S.lines.push(pot); resetCalc();
    ok('closing balance carried forward', eq(lineClosing(pot, m2), 250));
    const t = { id: 'fx', sec: 'expense', name: 'Ten', link: null, behaviour: 'normal', opening: 0, entries: { [cm]: { f: `{p:${L('Salary (net)').id}} * 10%` } } };
    S.lines.push(t); resetCalc();
    ok('formula between sheets', eq(linePlanned(t, cm), 400));
    L('Salary (net)').entries[m2] = { amt: 5000 }; resetCalc();
    ok('recurring formula re-evaluated each month', eq(linePlanned(t, m2), 500));
    const c1b = S.cats[1];
    L('Cash ISA').entries[m1] = { f: `{s:${c1b.id}}`, once: true }; resetCalc();
    ok('loop through plan and forecast caught', safe(() => catNative(c1b.id, m1)) instanceof FErr);

    /* ISA */
    fresh();
    const ty = taxYear(cm);
    S.cats[0].isaPrior[ty] = 3000; S.cats[1].isaPrior[ty] = 4200;
    S.lines.find((l) => l.name === 'Stocks & Shares ISA').entries[cm] = { amt: 500 };
    S.lines.find((l) => l.name === 'Cash ISA').entries[cm] = { amt: 700 };
    S.lines.find((l) => l.name === 'Cash ISA').entries[m1] = { amt: 1200, once: true };
    resetCalc();
    let y = isaYear(ty);
    ok('allowance used now', eq(y.rows.find((x) => x.m === cm).used, 8400));
    ok('allowance used next month', eq(y.rows.find((x) => x.m === m1).used, 10100));
    S.isaOv[S.cats[1].id] = { [m1]: { amt: 0, wd: 1000 } }; y = isaYear(ty);
    ok('withdrawal from non-flexible ISA does not restore', eq(y.rows.find((x) => x.m === m1).used, 8900));
    S.cats[1].flexible = true; y = isaYear(ty);
    ok('flexible withdrawal restores', eq(y.rows.find((x) => x.m === m1).used, 7900));
    S.settings.forecastMonths = 8;
    const tys = [...new Set(allMonths().map(taxYear))];
    ok('forecast splits by tax year', tys.length >= 2 || taxYear(cm) === taxYear(lastM()));
    ok('tax year boundary', taxYear('2027-03') === 2026 && taxYear('2027-04') === 2027);
    ok('2027/28 cash limit for under-65', allowance(2027).cash === 12000 && allowance(2026).cash === null);
    S.settings.under65 = false; ok('no cash limit for 65+', allowance(2027).cash === null);

    /* Months */
    fresh(); S.settings.forecastMonths = 0;
    ok('zero forecast months', visibleMonths().length === 1);
    S.settings.forecastMonths = 6; S.settings.hiddenMonths = [m2];
    ok('hidden months still calculated', !visibleMonths().includes(m2) && allMonths().includes(m2));
    S.catCells[S.cats[0].id] = { [cm]: { v: 100 } }; S.lines.find((l) => l.name === 'Stocks & Shares ISA').entries[cm] = { amt: 10 }; resetCalc();
    ok('chain runs through hidden month', eq(catNative(S.cats[0].id, m3), 130));
    ok('month arithmetic', addM('2026-12', 1) === '2027-01' && addM('2027-01', -1) === '2026-12' && addM('2026-10', 15) === '2028-01');
    fresh(); S.settings.firstMonth = addM(cm, -2);
    S.catCells[S.cats[0].id] = { [addM(cm, -2)]: { v: 1000 } }; S.lines.find((l) => l.name === 'Stocks & Shares ISA').entries[addM(cm, -2)] = { amt: 100 }; resetCalc();
    ok('new month rolls forward automatically', eq(catNative(S.cats[0].id, cm), 1200));
    fresh(); S.settings.firstMonth = addM(cm, 3); ok('clock moved back is safe', firstM() === cm);

    /* Goals */
    fresh();
    S.catCells[S.cats[1].id] = { [cm]: { v: 10000 } }; resetCalc();
    const trip = { id: 'g1', name: 'India trip', color: '#000', target: null, date: null, rows: [
      { id: 'r1', label: 'Cash', v: 500, f: null },
      { id: 'r2', label: 'From Cash ISA', v: null, f: `{s:${S.cats[1].id}} * 30%` },
      { id: 'r3', label: 'Flights booked', v: -200, f: null },
      { id: 'r4', label: 'Empty', v: null, f: null }] };
    S.goals.push(trip); resetCalc();
    ok('goal adds manual, formula, negative and blank lines', eq(goalAvail('g1', cm), 500 + 3000 - 200));
    ok('no target is allowed', goalTarget(trip, cm) === null);
    trip.target = { v: 5000, f: null }; resetCalc();
    ok('typed target', eq(goalTarget(trip, cm), 5000));
    trip.target = { v: null, f: `{T:_} * 50%` }; resetCalc();
    ok('formula target', eq(goalTarget(trip, cm), 5000));
    S.catCells[S.cats[1].id][cm].v = 20000; resetCalc();
    ok('goal follows other tabs', eq(goalAvail('g1', cm), 500 + 6000 - 200) && eq(goalTarget(trip, cm), 10000));
    ok('goal readable reference', toInternal('[Goal: India trip] * 2') === '{g:g1} * 2' && toDisplay('{g:g1}') === '[Goal: India trip]');
    S.goals.push({ id: 'g2', name: 'Car', target: null, rows: [{ id: 'r5', label: 'Half of trip', v: null, f: '{g:g1} / 2' }] }); resetCalc();
    ok('goal referencing another goal', eq(goalAvail('g2', cm), (500 + 6000 - 200) / 2));
    trip.rows.push({ id: 'r6', label: 'Loop', v: null, f: '{g:g2}' }); resetCalc();
    ok('goal loop caught', safe(() => goalAvail('g1', cm)) instanceof FErr);
    trip.rows.pop();
    S.goals = S.goals.filter((g) => g.id !== 'g1'); resetCalc();
    ok('deleted goal reference reported', safe(() => goalAvail('g2', cm)) instanceof FErr);
    ok('months until target date', monthsUntil(addM(cm, 6)) === 6 && monthsUntil(cm) === 0 && monthsUntil(null) === null);

    /* Formatting and input */
    ok('£ format', fmt(1234.5, 'GBP', 0) === '£1,235' && fmt(-5, 'GBP', 0) === '−£5');
    ok('₹ lakh format', fmt(450000, 'INR', 0) === '₹4,50,000');
    ok('no negative zero', fmt(-0.001, 'GBP', 0) === '£0');
    ok('amount parsing', parseAmount('£1,200.50') === 1200.5 && parseAmount('') === null && isNaN(parseAmount('abc')) && isNaN(parseAmount('1.2.3')));
    const mg = migrate({ cats: [{ id: 'a', name: 'X' }], settings: { forecastMonths: '99' } });
    ok('damaged backup repaired on load', mg.settings.forecastMonths === 36 && Array.isArray(mg.lines) && mg.cats[0].ccy === 'GBP');
  } catch (e) {
    results.push('ERROR ' + e.message);
  } finally {
    S = keep; resetCalc();
  }
  const fails = results.filter((x) => !x.startsWith('PASS'));
  console.log(results.join('\n'));
  return fails.length ? fails : ['ALL ' + results.length + ' PASS'];
})();
