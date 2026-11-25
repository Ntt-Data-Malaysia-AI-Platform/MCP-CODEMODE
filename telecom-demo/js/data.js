// Telecom back end (sample data): plan catalog, devices, promotions, customers and 12 months of daily usage.
// Deterministic, so every demo run shows the same numbers.
(function (g) {
  const TLD = (g.TLD = g.TLD || {});

  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const TERMS =
    'Prices include 18% GST. Allowances reset on the bill date. Unused data does not carry over. ' +
    'Fair-usage policy applies to unlimited plans: speeds may be reduced after the fair-usage limit in congested cells. ' +
    'Data beyond the allowance is charged at the overage rate per GB, rounded up. Plan changes take effect on the next bill cycle.';

  const TERMS_MY =
    'Prices include 8% SST. Allowances reset on the bill date. Unused data does not carry over. ' +
    'Fair-usage policy applies to unlimited plans: speeds may be reduced after the fair-usage limit in congested cells. ' +
    'Data beyond the allowance is charged at RM5 per GB, rounded up. ASEAN roaming passes RM38 for 7 days. Plan changes take effect on the next bill cycle.';

  // ---------------------------------------------------------------- plans (per month, in the region's currency)
  const P = (o) => ({
    region: 'IN', segment: 'consumer', type: 'mobile', lines_included: 1, max_lines: 1, extra_line_price: 0,
    data_gb_per_line: 0, shared_gb: 0, data_shared: false, unlimited: false, fup_gb: 0,
    hotspot_gb: 10, hotspot_pack_price: 199, five_g: false, roaming_days_per_year: 0, roaming_pack_price: 1499, roaming_pack_days: 7,
    overage_per_gb: 25, fibre_mbps: 0, ott: [], contract_months: 0, available: true,
    voice: 'Unlimited local and national calls', sms: '100 SMS/day', terms: TERMS, ...o,
  });
  // Malaysia (RM)
  const PM = (o) => P({
    region: 'MY', roaming_pack_price: 38, roaming_pack_days: 7, overage_per_gb: 5, hotspot_pack_price: 10,
    voice: 'Unlimited calls to all networks in Malaysia', sms: 'Unlimited SMS', terms: TERMS_MY, ...o,
  });

  const plans = [
    // Consumer postpaid
    P({ id: 'P399', name: 'Postpaid 399', monthly_price: 399, data_gb_per_line: 30 }),
    P({ id: 'P449', name: 'Postpaid 449', monthly_price: 449, data_gb_per_line: 40 }),
    P({ id: 'P549', name: 'Postpaid 549', monthly_price: 549, data_gb_per_line: 60, five_g: true }),
    P({ id: 'P699', name: 'Postpaid 699', monthly_price: 699, data_gb_per_line: 75, five_g: true, hotspot_gb: 20 }),
    P({ id: 'P799', name: '5G Unlimited 799', monthly_price: 799, unlimited: true, fup_gb: 300, five_g: true, hotspot_gb: 50 }),
    P({ id: 'P999', name: '5G Unlimited Plus 999', monthly_price: 999, unlimited: true, fup_gb: 400, five_g: true, hotspot_gb: 100, roaming_days_per_year: 10, ott: ['StreamMax Mobile'] }),
    P({ id: 'P1299', name: '5G Premium 1299', monthly_price: 1299, unlimited: true, fup_gb: 500, five_g: true, hotspot_gb: 150, roaming_days_per_year: 20, ott: ['StreamMax', 'SportsLive'] }),
    // Legacy (not sold any more)
    P({ id: 'P349L', name: 'Classic 349 (legacy)', monthly_price: 349, data_gb_per_line: 20, available: false }),
    P({ id: 'P599L', name: 'Smart 599 (legacy)', monthly_price: 599, data_gb_per_line: 50, available: false }),
    P({ id: 'P899L', name: 'Max 899 (legacy)', monthly_price: 899, data_gb_per_line: 120, available: false }),
    // Prepaid (monthly equivalent)
    P({ id: 'PP239', name: 'Prepaid 28-day 1.5GB/day', type: 'prepaid', monthly_price: 259, data_gb_per_line: 45, overage_per_gb: 30, hotspot_gb: 5 }),
    P({ id: 'PP299', name: 'Prepaid 28-day 2GB/day', type: 'prepaid', monthly_price: 324, data_gb_per_line: 60, overage_per_gb: 30, hotspot_gb: 5 }),
    P({ id: 'PP719', name: 'Prepaid 84-day 2GB/day', type: 'prepaid', monthly_price: 260, data_gb_per_line: 60, overage_per_gb: 30, hotspot_gb: 5 }),
    P({ id: 'PP2999', name: 'Prepaid annual 2.5GB/day', type: 'prepaid', monthly_price: 250, data_gb_per_line: 75, overage_per_gb: 30, hotspot_gb: 5, contract_months: 12 }),
    // Family / shared
    P({ id: 'F999', name: 'Family Share 999', segment: 'family', type: 'family', monthly_price: 999, lines_included: 3, max_lines: 5, extra_line_price: 249, data_shared: true, shared_gb: 150, five_g: true, hotspot_gb: 30 }),
    P({ id: 'F1299', name: 'Family Share 1299', segment: 'family', type: 'family', monthly_price: 1299, lines_included: 4, max_lines: 6, extra_line_price: 249, data_shared: true, shared_gb: 200, five_g: true, hotspot_gb: 40 }),
    P({ id: 'F1499', name: 'Family 5G Share 1499', segment: 'family', type: 'family', monthly_price: 1499, lines_included: 4, max_lines: 6, extra_line_price: 299, data_shared: true, shared_gb: 250, five_g: true, hotspot_gb: 60, ott: ['StreamMax'] }),
    P({ id: 'F1799', name: 'Family Unlimited 1799', segment: 'family', type: 'family', monthly_price: 1799, lines_included: 4, max_lines: 6, extra_line_price: 349, unlimited: true, fup_gb: 300, five_g: true, hotspot_gb: 60, ott: ['StreamMax'] }),
    P({ id: 'F2199', name: 'Family Unlimited Plus 2199', segment: 'family', type: 'family', monthly_price: 2199, lines_included: 5, max_lines: 6, extra_line_price: 349, unlimited: true, fup_gb: 400, five_g: true, hotspot_gb: 100, roaming_days_per_year: 10, ott: ['StreamMax', 'SportsLive'] }),
    // Fibre + mobile combos
    P({ id: 'C1099', name: 'Fibre 100 + Mobile 1099', segment: 'combo', type: 'combo', monthly_price: 1099, data_gb_per_line: 75, fibre_mbps: 100, five_g: true, hotspot_gb: 20, max_lines: 1 }),
    P({ id: 'C1199', name: 'Fibre 300 + 5G Unlimited 1199', segment: 'combo', type: 'combo', monthly_price: 1199, unlimited: true, fup_gb: 300, fibre_mbps: 300, five_g: true, hotspot_gb: 100, max_lines: 1, ott: ['StreamMax'], contract_months: 12 }),
    P({ id: 'C1499', name: 'Fibre 300 + 2 Lines 1499', segment: 'combo', type: 'combo', monthly_price: 1499, lines_included: 2, max_lines: 3, extra_line_price: 299, data_shared: true, shared_gb: 150, fibre_mbps: 300, five_g: true, hotspot_gb: 40, contract_months: 12 }),
    P({ id: 'C1999', name: 'Fibre 1G + Family 4 Lines 1999', segment: 'combo', type: 'combo', monthly_price: 1999, lines_included: 4, max_lines: 6, extra_line_price: 299, data_shared: true, shared_gb: 250, fibre_mbps: 1000, five_g: true, hotspot_gb: 60, ott: ['StreamMax'], contract_months: 12 }),
    P({ id: 'C2499', name: 'Fibre 1G + Family Unlimited 2499', segment: 'combo', type: 'combo', monthly_price: 2499, lines_included: 4, max_lines: 6, extra_line_price: 349, unlimited: true, fup_gb: 300, fibre_mbps: 1000, five_g: true, hotspot_gb: 100, ott: ['StreamMax', 'SportsLive'], contract_months: 12 }),
    // Business
    P({ id: 'B499', name: 'Biz Basic 499 (per line)', segment: 'business', type: 'business', monthly_price: 499, max_lines: 50, extra_line_price: 499, data_gb_per_line: 50, five_g: true, hotspot_gb: 20 }),
    P({ id: 'B699', name: 'Biz Plus 699 (per line)', segment: 'business', type: 'business', monthly_price: 699, max_lines: 50, extra_line_price: 699, data_gb_per_line: 100, five_g: true, hotspot_gb: 40, roaming_days_per_year: 5 }),
    P({ id: 'B2999', name: 'Biz Pool 6 Lines 2999', segment: 'business', type: 'business', monthly_price: 2999, lines_included: 6, max_lines: 12, extra_line_price: 449, data_shared: true, shared_gb: 400, five_g: true, hotspot_gb: 100, roaming_days_per_year: 30, contract_months: 12 }),
    P({ id: 'B3999', name: 'Biz Pro Pool 6 Lines 3999', segment: 'business', type: 'business', monthly_price: 3999, lines_included: 6, max_lines: 15, extra_line_price: 499, data_shared: true, shared_gb: 600, five_g: true, hotspot_gb: 150, roaming_days_per_year: 60, contract_months: 12 }),
    P({ id: 'B5499', name: 'Biz Unlimited 8 Lines 5499', segment: 'business', type: 'business', monthly_price: 5499, lines_included: 8, max_lines: 20, extra_line_price: 549, unlimited: true, fup_gb: 300, five_g: true, hotspot_gb: 200, roaming_days_per_year: 80, contract_months: 12 }),
    P({ id: 'B1999', name: 'Biz Starter 3 Lines 1999', segment: 'business', type: 'business', monthly_price: 1999, lines_included: 3, max_lines: 5, extra_line_price: 449, data_shared: true, shared_gb: 180, five_g: true, hotspot_gb: 50, roaming_days_per_year: 10, contract_months: 12 }),
    // Add-on style plans
    P({ id: 'D_ROAM30', name: 'Global Roamer 30 (add-on)', type: 'addon', monthly_price: 999, roaming_days_per_year: 30, available: true, max_lines: 1 }),
    P({ id: 'D_DATA50', name: 'Data Booster 50GB (add-on)', type: 'addon', monthly_price: 349, data_gb_per_line: 50, max_lines: 1 }),
    P({ id: 'D_OTT', name: 'Entertainment Pack (add-on)', type: 'addon', monthly_price: 199, ott: ['StreamMax', 'SportsLive', 'MusicOne'], max_lines: 1 }),
    // Broadband only
    P({ id: 'BB799', name: 'Fibre 100 Mbps only', segment: 'combo', type: 'broadband', monthly_price: 799, fibre_mbps: 100, max_lines: 0 }),
    P({ id: 'BB999', name: 'Fibre 300 Mbps only', segment: 'combo', type: 'broadband', monthly_price: 999, fibre_mbps: 300, max_lines: 0 }),
    P({ id: 'BB1499', name: 'Fibre 1 Gbps only', segment: 'combo', type: 'broadband', monthly_price: 1499, fibre_mbps: 1000, max_lines: 0 }),

    // ===================== Malaysia (RM per month) =====================
    PM({ id: 'MY-P38', name: 'Postpaid 38', monthly_price: 38, data_gb_per_line: 25 }),
    PM({ id: 'MY-P48', name: 'Postpaid 48', monthly_price: 48, data_gb_per_line: 40 }),
    PM({ id: 'MY-P68', name: 'Postpaid 68 5G', monthly_price: 68, data_gb_per_line: 80, five_g: true, hotspot_gb: 20 }),
    PM({ id: 'MY-P88', name: '5G Unlimited 88', monthly_price: 88, unlimited: true, fup_gb: 300, five_g: true, hotspot_gb: 50 }),
    PM({ id: 'MY-P128', name: '5G Unlimited Plus 128', monthly_price: 128, unlimited: true, fup_gb: 400, five_g: true, hotspot_gb: 100, roaming_days_per_year: 10, ott: ['StreamMax Mobile'] }),
    PM({ id: 'MY-P168', name: '5G Premium 168', monthly_price: 168, unlimited: true, fup_gb: 500, five_g: true, hotspot_gb: 150, roaming_days_per_year: 20, ott: ['StreamMax', 'SportsLive'] }),
    PM({ id: 'MY-P58L', name: 'Value 58 (legacy)', monthly_price: 58, data_gb_per_line: 50, available: false }),
    PM({ id: 'MY-PP35', name: 'Prepaid 30-day 60GB', type: 'prepaid', monthly_price: 35, data_gb_per_line: 60, overage_per_gb: 6, hotspot_gb: 5 }),
    PM({ id: 'MY-F128', name: 'Family Share 128', segment: 'family', type: 'family', monthly_price: 128, lines_included: 3, max_lines: 5, extra_line_price: 30, data_shared: true, shared_gb: 150, five_g: true, hotspot_gb: 30 }),
    PM({ id: 'MY-F158', name: 'Family Share 158', segment: 'family', type: 'family', monthly_price: 158, lines_included: 4, max_lines: 6, extra_line_price: 30, data_shared: true, shared_gb: 220, five_g: true, hotspot_gb: 40 }),
    PM({ id: 'MY-F188', name: 'Family 5G Share 188', segment: 'family', type: 'family', monthly_price: 188, lines_included: 4, max_lines: 6, extra_line_price: 35, data_shared: true, shared_gb: 300, five_g: true, hotspot_gb: 60, roaming_days_per_year: 10, ott: ['StreamMax'] }),
    PM({ id: 'MY-F228', name: 'Family Unlimited 228', segment: 'family', type: 'family', monthly_price: 228, lines_included: 4, max_lines: 6, extra_line_price: 40, unlimited: true, fup_gb: 300, five_g: true, hotspot_gb: 80, roaming_days_per_year: 15, ott: ['StreamMax'] }),
    PM({ id: 'MY-C149', name: 'Fibre 300 + 5G Unlimited 149', segment: 'combo', type: 'combo', monthly_price: 149, unlimited: true, fup_gb: 300, fibre_mbps: 300, five_g: true, hotspot_gb: 100, max_lines: 1, contract_months: 24 }),
    PM({ id: 'MY-C199', name: 'Fibre 500 + 2 Lines 199', segment: 'combo', type: 'combo', monthly_price: 199, lines_included: 2, max_lines: 3, extra_line_price: 35, data_shared: true, shared_gb: 160, fibre_mbps: 500, five_g: true, hotspot_gb: 40, contract_months: 24 }),
    PM({ id: 'MY-C249', name: 'Fibre 1G + Family 249', segment: 'combo', type: 'combo', monthly_price: 249, lines_included: 4, max_lines: 6, extra_line_price: 35, data_shared: true, shared_gb: 300, fibre_mbps: 1000, five_g: true, hotspot_gb: 80, roaming_days_per_year: 15, ott: ['StreamMax'], contract_months: 24 }),
    PM({ id: 'MY-C299', name: 'Fibre 1G + Family Unlimited 299', segment: 'combo', type: 'combo', monthly_price: 299, lines_included: 4, max_lines: 6, extra_line_price: 40, unlimited: true, fup_gb: 300, fibre_mbps: 1000, five_g: true, hotspot_gb: 120, roaming_days_per_year: 30, ott: ['StreamMax', 'SportsLive'], contract_months: 24 }),
    PM({ id: 'MY-BB99', name: 'Fibre 300 Mbps only', segment: 'combo', type: 'broadband', monthly_price: 99, fibre_mbps: 300, max_lines: 0 }),
    PM({ id: 'MY-BB139', name: 'Fibre 500 Mbps only', segment: 'combo', type: 'broadband', monthly_price: 139, fibre_mbps: 500, max_lines: 0 }),
    PM({ id: 'MY-BB189', name: 'Fibre 1 Gbps only', segment: 'combo', type: 'broadband', monthly_price: 189, fibre_mbps: 1000, max_lines: 0 }),
    PM({ id: 'MY-ROAM', name: 'ASEAN Roam Pass (add-on)', type: 'addon', monthly_price: 25, roaming_days_per_year: 12, max_lines: 1 }),
  ];
  for (const p of plans) {
    const pack = p.region === 'MY' ? `RM${p.roaming_pack_price}` : `₹${p.roaming_pack_price.toLocaleString('en-IN')}`;
    p.features = [
      p.unlimited ? `Unlimited 5G data (fair use ${p.fup_gb} GB)` : p.data_shared ? `${p.shared_gb} GB shared data` : p.data_gb_per_line ? `${p.data_gb_per_line} GB data per line` : 'No mobile data',
      `${p.hotspot_gb} GB hotspot`,
      p.roaming_days_per_year ? `${p.roaming_days_per_year} international roaming days per year` : `Roaming packs from ${pack} / 7 days`,
      p.fibre_mbps ? `Home fibre ${p.fibre_mbps >= 1000 ? '1 Gbps' : p.fibre_mbps + ' Mbps'}` : null,
      p.ott.length ? `Includes ${p.ott.join(', ')}` : null,
    ].filter(Boolean);
  }

  // ---------------------------------------------------------------- promotions
  const promotions = [
    { id: 'PR-FAM20', plan_ids: ['F1499'], type: 'percent', value: 20, months: 6, description: '20% off Family 5G Share for the first 6 months' },
    { id: 'PR-FAMU10', plan_ids: ['F1799'], type: 'percent', value: 10, months: 6, description: '10% off Family Unlimited for 6 months' },
    { id: 'PR-COMBO200', plan_ids: ['C1199'], type: 'flat', value: 200, months: 12, description: '₹200 off every month for 12 months on Fibre 300 + 5G Unlimited' },
    { id: 'PR-C1999', plan_ids: ['C1999'], type: 'flat', value: 300, months: 6, description: '₹300 off for 6 months on Fibre 1G + Family' },
    { id: 'PR-BIZ10', plan_ids: ['B2999', 'B3999'], type: 'percent', value: 10, months: 12, description: '10% off business pools for 12 months' },
    { id: 'PR-5G100', plan_ids: ['P799', 'P999'], type: 'flat', value: 100, months: 3, description: '₹100 off for 3 months when upgrading to 5G Unlimited' },
    { id: 'PR-WELCOME', plan_ids: ['P549', 'P699'], type: 'percent', value: 15, months: 3, description: '15% off for 3 months for new postpaid customers', new_customers_only: true },
    { id: 'PR-SWITCH', plan_ids: ['F1299'], type: 'flat', value: 150, months: 6, description: '₹150 off for 6 months when moving 4 lines to Family Share' },
    // Malaysia
    { id: 'MY-PR-FAM', region: 'MY', plan_ids: ['MY-F188'], type: 'percent', value: 20, months: 6, description: '20% off Family 5G Share 188 for the first 6 months' },
    { id: 'MY-PR-FIBRE', region: 'MY', plan_ids: ['MY-C249', 'MY-C299'], type: 'flat', value: 30, months: 12, description: 'RM30 off every month for 12 months on Fibre 1G + Family bundles' },
    { id: 'MY-PR-5G', region: 'MY', plan_ids: ['MY-P88', 'MY-P128'], type: 'flat', value: 10, months: 3, description: 'RM10 off for 3 months when upgrading to 5G Unlimited' },
    { id: 'MY-PR-NEW', region: 'MY', plan_ids: ['MY-P68'], type: 'percent', value: 25, months: 6, description: '25% off for 6 months for new postpaid customers', new_customers_only: true },
  ];
  for (const pr of promotions) pr.region = pr.region || 'IN';

  // ---------------------------------------------------------------- devices & products (₹)
  const D = (o) => ({ emi_months: 12, bundle_discount: 0, bundle_plan_types: [], in_stock: true, warranty: '1 year', ...o });
  const devices = [
    D({ id: 'DV-PH-F1', category: 'phone', name: '5G Flagship Phone 256 GB', network: '5G', price: 79999, specs: '6.7" OLED 120 Hz, triple 50 MP camera, 5,000 mAh, Wi-Fi 7', bundle_discount: 6000, bundle_plan_types: ['mobile', 'family', 'combo'] }),
    D({ id: 'DV-PH-F2', category: 'phone', name: '5G Flagship Compact 128 GB', network: '5G', price: 64999, specs: '6.1" OLED, dual 48 MP camera, 4,000 mAh', bundle_discount: 5000, bundle_plan_types: ['mobile', 'family'] }),
    D({ id: 'DV-PH-M1', category: 'phone', name: '5G Mid-range Phone 128 GB', network: '5G', price: 24999, specs: '6.6" AMOLED 120 Hz, 64 MP camera, 5,000 mAh, all-day 5G', bundle_discount: 3000, bundle_plan_types: ['mobile', 'family', 'combo'] }),
    D({ id: 'DV-PH-M2', category: 'phone', name: '5G Mid-range Phone Pro 256 GB', network: '5G', price: 31999, specs: '6.7" AMOLED, 108 MP camera, 67 W charging', bundle_discount: 3500, bundle_plan_types: ['mobile', 'family'] }),
    D({ id: 'DV-PH-B1', category: 'phone', name: '5G Budget Phone 64 GB', network: '5G', price: 13999, specs: '6.5" LCD 90 Hz, 50 MP camera, 5,000 mAh', bundle_discount: 1500, bundle_plan_types: ['mobile', 'family', 'business'] }),
    D({ id: 'DV-PH-R1', category: 'phone', name: 'Rugged 5G Field Phone', network: '5G', price: 34999, specs: 'IP68 and MIL-STD-810H, glove touch, push-to-talk, 6,600 mAh', bundle_discount: 4000, bundle_plan_types: ['business'] }),
    D({ id: 'DV-PH-4G', category: 'phone', name: '4G Feature Phone', network: '4G', price: 2499, specs: '2.4" display, dual SIM, 1,800 mAh', bundle_plan_types: [] }),
    D({ id: 'DV-RT-5G', category: 'router', name: '5G Home Router AX3000', network: '5G', price: 8999, specs: 'Wi-Fi 6, 4x4 MIMO, covers 2,000 sq ft, 64 devices', bundle_discount: 8999, bundle_plan_types: ['combo'] }),
    D({ id: 'DV-RT-MESH', category: 'router', name: 'Wi-Fi 6 Mesh Kit (3 nodes)', network: 'Fibre', price: 12999, specs: 'Whole-home Wi-Fi 6 mesh, covers 5,500 sq ft, 150 devices', bundle_discount: 6000, bundle_plan_types: ['combo'] }),
    D({ id: 'DV-RT-ONT', category: 'router', name: 'Fibre ONT + Wi-Fi 6 Router', network: 'Fibre', price: 3999, specs: 'GPON ONT with dual-band Wi-Fi 6', bundle_discount: 3999, bundle_plan_types: ['combo', 'broadband'] }),
    D({ id: 'DV-HS-5G', category: 'hotspot', name: 'Portable 5G Hotspot', network: '5G', price: 6999, specs: 'Pocket 5G hotspot, 32 devices, 4,400 mAh battery', bundle_discount: 2000, bundle_plan_types: ['business', 'mobile'] }),
    D({ id: 'DV-HS-FLEET', category: 'hotspot', name: 'Fleet 5G Vehicle Router', network: '5G', price: 18999, specs: 'In-vehicle 5G router with GPS tracking and fleet dashboard', bundle_discount: 5000, bundle_plan_types: ['business'] }),
    D({ id: 'DV-OTT-1', category: 'ott', name: 'StreamMax Annual', network: 'OTT', price: 1499, emi_months: 1, specs: 'HD streaming on 2 screens', bundle_plan_types: [] }),
    D({ id: 'DV-OTT-2', category: 'ott', name: 'Entertainment Pack (3 apps)', network: 'OTT', price: 2388, emi_months: 12, specs: 'StreamMax, SportsLive, MusicOne', bundle_plan_types: [] }),
    D({ id: 'DV-WR-1', category: 'wearable', name: '5G Smartwatch (eSIM)', network: '5G', price: 19999, specs: 'eSIM calling, ECG, 2-day battery', bundle_discount: 2000, bundle_plan_types: ['mobile', 'family'] }),
    D({ id: 'DV-TAB-1', category: 'tablet', name: '5G Tablet 11"', network: '5G', price: 29999, specs: '11" 2K display, 8 GB RAM, 5G SIM slot', bundle_discount: 3000, bundle_plan_types: ['family', 'combo'] }),
  ];
  for (const d of devices) d.region = 'IN';
  // Malaysia: same products, priced in RM (rounded to a ...9 price point)
  const rm = (inr) => (inr <= 0 ? 0 : Math.max(9, Math.round(inr / 18 / 50) * 50 - 1));
  for (const d of devices.slice()) {
    devices.push({ ...d, region: 'MY', price: rm(d.price), bundle_discount: d.bundle_discount === d.price ? rm(d.price) : rm(d.bundle_discount) });
  }
  for (const d of devices) d.emi_per_month = Math.round(d.price / d.emi_months);

  // ---------------------------------------------------------------- customers
  // usage targets (GB per month) drive the generated daily records
  const customers = [
    {
      customer_id: 'CUST-4001', name: 'Deepan', persona: 'Family of three in KL, home fibre, ASEAN travel', segment: 'family', city: 'Kuala Lumpur',
      region: 'MY', country: 'Malaysia', currency: 'MYR',
      customer_since: '2020-06-15', account_status: 'Active', payment_method: 'Auto-debit (FPX)', credit_class: 'A', contract_end: null,
      broadband: { provider: 'Other provider', plan: 'Home fibre 300 Mbps', speed_mbps: 300, monthly_price: 139 },
      lines: [
        { line_id: 'L-4001-1', user: 'Deepan (primary)', msisdn: '+60 12-3xx x4521', current_plan_id: 'MY-P48', device: { model: '5G Flagship (2024)', network: '5G', age_months: 20 }, target: { data: 44, hotspot: 9, roamTrips: [{ month: 2, days: 4 }, { month: 6, days: 5 }, { month: 9, days: 3 }, { month: 11, days: 4 }] } },
        { line_id: 'L-4001-2', user: 'Kavitha', msisdn: '+60 12-3xx x4522', current_plan_id: 'MY-P48', device: { model: '5G Mid-range (2023)', network: '5G', age_months: 30 }, target: { data: 30, hotspot: 1, roamTrips: [{ month: 6, days: 5 }] } },
        { line_id: 'L-4001-3', user: 'Arun (student)', msisdn: '+60 12-3xx x4523', current_plan_id: 'MY-P48', device: { model: '4G Phone (2020)', network: '4G', age_months: 60 }, target: { data: 47, hotspot: 3, roamTrips: [] } },
      ],
    },
  ];

  // ---------------------------------------------------------------- daily usage
  const iso = (d) => d.toISOString().slice(0, 10);
  const today = new Date();
  const histEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)); // last day of previous month
  const histStart = new Date(Date.UTC(histEnd.getUTCFullYear(), histEnd.getUTCMonth() - 11, 1));
  const REGION = {
    IN: { countries: ['Sri Lanka', 'Nepal', 'Bangladesh', 'UAE'], sites: ['BLR-N-0412', 'BLR-E-1180', 'PNQ-W-0921', 'MAA-C-0333', 'MAA-S-0907', 'HWY-NH44-12', 'HWY-NH48-07'] },
    MY: { countries: ['Singapore', 'Thailand', 'Indonesia'], sites: ['KUL-KLCC-0211', 'KUL-BSR-0874', 'SEL-PJ-1402', 'SEL-SJ-0633'] },
  };
  for (const c of customers) {
    c.region = c.region || 'IN';
    c.country = c.country || 'India';
    c.currency = c.currency || 'INR';
  }

  const usage = {}; // line_id -> records[]
  customers.forEach((c) => {
    const ci = Number(c.customer_id.slice(5, 6)) - 1; // stable seed per customer (CUST-1001 -> 0)
    const { countries: COUNTRIES, sites: SITES } = REGION[c.region];
    c.lines.forEach((line, li) => {
      const rand = mulberry32(1000 + ci * 37 + li * 11);
      const recs = [];
      const roamDays = new Set();
      for (const trip of line.target.roamTrips) {
        const start = new Date(Date.UTC(histStart.getUTCFullYear(), histStart.getUTCMonth() + trip.month, 8 + Math.floor(rand() * 10)));
        for (let k = 0; k < trip.days; k++) roamDays.add(iso(new Date(start.getTime() + k * 86400000)));
      }
      let country = COUNTRIES[(ci + li) % COUNTRIES.length];
      for (let d = new Date(histStart); d <= histEnd; d = new Date(d.getTime() + 86400000)) {
        const m = d.getUTCMonth();
        const season = 1 + 0.08 * Math.sin(((m + 2) / 12) * Math.PI * 2); // a little seasonality
        const weekend = [0, 6].includes(d.getUTCDay()) ? 1.15 : 0.95;
        const day = (line.target.data * 1024 / 30.4) * season * weekend * (0.7 + rand() * 0.6);
        const hs = (line.target.hotspot * 1024 / 30.4) * (0.4 + rand() * 1.2);
        const roaming = roamDays.has(iso(d));
        recs.push({
          date: iso(d),
          line_id: line.line_id,
          data_mb: Math.round(roaming ? day * 0.4 : day),
          hotspot_mb: Math.round(hs),
          voice_min: Math.round(12 + rand() * (line.user.startsWith('Driver') ? 70 : 40)),
          sms: Math.floor(rand() * 6),
          roaming,
          roaming_country: roaming ? country : null,
          roaming_mb: roaming ? Math.round(300 + rand() * 900) : 0,
          network_5g_share: line.device.network === '5G' ? +(0.55 + rand() * 0.4).toFixed(2) : 0,
          top_cell_site: SITES[(ci * 2 + Math.floor(rand() * 3)) % SITES.length],
        });
      }
      // The BSS serves lean daily rows: only the fields the agents use (the generator above keeps its
      // full random sequence so the usage numbers stay stable).
      usage[line.line_id] = recs.map((r) => ({
        date: r.date, data_mb: r.data_mb, hotspot_mb: r.hotspot_mb, voice_min: r.voice_min,
        roaming: r.roaming, roaming_country: r.roaming_country,
      }));
    });
  });

  TLD.db = { plans, promotions, devices, customers, usage, histStart: iso(histStart), histEnd: iso(histEnd) };
})(typeof window !== 'undefined' ? window : globalThis);
