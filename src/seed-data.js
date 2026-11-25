// Deterministic demo data: the same rows every time, for in-memory mode and for `npm run seed`.

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REGIONS = ['North', 'South', 'East', 'West', 'Central'];

const PARTS = [
  ['PRT-1001', 'Compressor start relay'],
  ['PRT-1002', 'Condenser fan motor 240V'],
  ['PRT-1003', 'Run capacitor 45/5 uF'],
  ['PRT-1004', 'Thermostat control board'],
  ['PRT-1005', 'Pressure switch (high side)'],
  ['PRT-1006', 'Expansion valve 3-ton'],
  ['PRT-1007', 'Contactor 30A 2-pole'],
  ['PRT-1008', 'Blower wheel 10x8'],
  ['PRT-1009', 'Inducer motor assembly'],
  ['PRT-1010', 'Flame sensor rod'],
  ['PRT-1011', 'Hot surface igniter'],
  ['PRT-1012', 'Gas valve 24V'],
  ['PRT-1013', 'Air filter MERV 13 (20x25)'],
  ['PRT-1014', 'Condensate pump 115V'],
  ['PRT-1015', 'Refrigerant R-410A (25 lb)'],
  ['PRT-1016', 'Filter drier 3/8"'],
  ['PRT-1017', 'Fan limit switch'],
  ['PRT-1018', 'Transformer 40VA'],
  ['PRT-1019', 'Door switch (blower)'],
  ['PRT-1020', 'Defrost control board'],
  ['PRT-1021', 'Reversing valve solenoid'],
  ['PRT-1022', 'Damper actuator 24V'],
  ['PRT-1023', 'Smart thermostat (Wi-Fi)'],
  ['PRT-1024', 'Drain line kit'],
];

const FAULTS = [
  ['Unit not cooling', 'Customer reports warm air from vents; outdoor unit hums but the fan does not spin.'],
  ['Short cycling', 'System turns on and off every 2-3 minutes; possible capacitor or thermostat fault.'],
  ['No heat', 'Furnace fails to ignite after three attempts and locks out; error code 33 on the board.'],
  ['Water leak at air handler', 'Water pooling under the indoor unit; condensate line may be blocked or the pump failed.'],
  ['Loud rattling noise', 'Rattling from the blower compartment at start-up; wheel may be loose or damaged.'],
  ['Thermostat unresponsive', 'Display blank after a power cut; transformer or control board suspected.'],
  ['Ice on refrigerant lines', 'Suction line iced over; low charge or restricted airflow suspected.'],
  ['Preventive maintenance', 'Scheduled quarterly maintenance visit: filters, coil clean, electrical checks.'],
  ['Burning smell', 'Burning smell when the heat starts; inspect the inducer motor and wiring.'],
  ['Zone not heating', 'Upstairs zone stays cold while downstairs overheats; damper actuator suspected.'],
];

const CUSTOMERS = ['Northwind Clinics', 'Harbor View Apartments', 'Lakeside School District', 'Summit Retail Group', 'Greenfield Offices', 'Riverside Hotel', 'Maple Street Bakery', 'Metro Data Center', 'Oakridge Library', 'Pinecrest Senior Living', 'Bluebird Cafe', 'Granite Logistics'];
const STREETS = ['Main St', 'Oak Ave', 'Harbor Rd', 'Pine St', 'Elm Way', 'Station Rd', 'Mill Ln', 'Park Blvd', 'Hill Rd', 'Bridge St'];
const TECHS = ['A. Patel', 'J. Kim', 'M. Garcia', 'S. Okafor', 'L. Novak', 'R. Silva', 'T. Nguyen', 'K. Muller', 'D. Rossi', 'P. Haddad'];
const MODELS = ['Carrier 24ACC6', 'Trane XR16', 'Lennox ML180', 'Daikin DX17', 'Rheem RA14', 'Goodman GSX14'];
const NOTES = [
  'Gate code 4471. Call site contact 30 minutes before arrival.',
  'Roof access via ladder in the east stairwell. Safety harness required.',
  'Customer requests morning visit only. Dog on premises.',
  'Previous visit replaced filter; recurring fault, check warranty status.',
  'Parking at loading dock B. Sign in at front desk.',
  'Equipment is under service contract SC-2291; no charge for labour.',
];

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export function generateSeedData(today = new Date()) {
  const rand = mulberry32(20261202);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const int = (min, max) => min + Math.floor(rand() * (max - min + 1));

  const depots = REGIONS.map((r) => ({
    id: `D-${r.toUpperCase()}`,
    name: `${r} Service Depot`,
    region: r,
    address: `${int(10, 999)} ${pick(STREETS)}, ${r} District`,
  }));

  const inventory = [];
  for (const depot of depots) {
    for (const [sku, name] of PARTS) {
      inventory.push({
        depot_id: depot.id,
        sku,
        part_name: name,
        qty_on_hand: rand() < 0.35 ? 0 : int(1, 8),
        reorder_level: int(1, 3),
        bin_location: `${String.fromCharCode(65 + int(0, 5))}-${int(1, 20)}`,
        last_counted: isoDate(new Date(today.getTime() - int(1, 20) * 86400000)),
      });
    }
  }

  const workOrders = [];
  for (let i = 0; i < 300; i++) {
    const region = REGIONS[i % REGIONS.length];
    const [title, desc] = pick(FAULTS);
    const r = rand();
    const status = r < 0.55 ? 'open' : r < 0.75 ? 'in_progress' : 'closed';
    const pr = rand();
    const priority = pr < 0.15 ? 'critical' : pr < 0.45 ? 'high' : pr < 0.8 ? 'medium' : 'low';
    const partsNeeded = [];
    const nParts = int(1, 3);
    while (partsNeeded.length < nParts) {
      const [sku, name] = pick(PARTS);
      if (!partsNeeded.find((p) => p.sku === sku)) partsNeeded.push({ sku, part_name: name, qty: int(1, 2) });
    }
    const due = new Date(today.getTime() + int(-30, 20) * 86400000);
    const created = new Date(due.getTime() - int(3, 25) * 86400000);
    workOrders.push({
      id: `WO-${1001 + i}`,
      title,
      description: desc,
      region,
      depot_id: `D-${region.toUpperCase()}`,
      customer: pick(CUSTOMERS),
      site_address: `${int(1, 2000)} ${pick(STREETS)}, ${region} District`,
      site_contact: `${pick(['Alex', 'Sam', 'Jordan', 'Chris', 'Taylor', 'Morgan'])} (+1-555-${int(100, 999)}-${int(1000, 9999)})`,
      asset_id: `AST-${int(10000, 99999)}`,
      asset_model: pick(MODELS),
      priority,
      status,
      assigned_tech: status === 'open' && rand() < 0.4 ? null : pick(TECHS),
      due_date: isoDate(due),
      created_at: created.toISOString(),
      required_parts: partsNeeded,
      notes: pick(NOTES),
    });
  }

  return { depots, inventory, workOrders };
}
