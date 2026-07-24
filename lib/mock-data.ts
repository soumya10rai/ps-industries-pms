import type {
  InventoryItem,
  ProductionRun,
  PurchaseOrder,
} from "@/lib/types";

/** Canonical mock POs used across dashboards and API routes. */
export const MOCK_POS: PurchaseOrder[] = [
  {
    id: "po-bmr-001",
    po_number: "4400042956-0",
    po_date: "2026-06-19",
    customer_code: "BMR",
    customer_name: "BMR HVAC LIMITED -VI",
    delivery_date: "2026-06-20",
    payment_terms: "45 Days",
    items: [
      {
        item_code: "11009231",
        description: "FREEZER FRAME",
        part_code: null,
        quantity: 17000,
        uom: "NOS",
        rate: 76.53,
        total: 1301010,
        material_grade: null,
        colour: null,
      },
      {
        item_code: "11031643",
        description: "NDC 215 EVA BACK COVER",
        part_code: "60272891A",
        quantity: 1100,
        uom: "NOS",
        rate: 22.27,
        total: 24497,
        material_grade: null,
        colour: null,
      },
    ],
    total_amount: 1325507,
    gst: "AS APPLICABLE",
    status: "new",
    parse_source: "fixture",
    source_file: "BMR_HVAC_PO_4400042956-0.pdf",
    uploaded_by: "accountant@psindustries.in",
    uploaded_at: "2026-07-20T09:15:00Z",
  },
  {
    id: "po-kent-001",
    po_number: "426RM0461",
    po_date: "2026-07-03",
    customer_code: "KENT",
    customer_name: "Kent RO Systems Ltd",
    delivery_date: null,
    payment_terms: "Cheque-45Days",
    items: [
      {
        item_code: "602240",
        description: "POWP-TANK TRAY GRAND STAR",
        part_code: "602240",
        quantity: 12000,
        uom: "NOS",
        rate: 30.82,
        total: 369840,
        material_grade: "HIPS",
        colour: "NATURAL",
      },
      {
        item_code: "601351B",
        description: "POWP-TANK TRAY ZENITH RO",
        part_code: "601351B",
        quantity: 700,
        uom: "NOS",
        rate: 29.85,
        total: 20895,
        material_grade: null,
        colour: null,
      },
    ],
    total_amount: 390735,
    gst: "CGST 9% + SGST 9%",
    status: "approved",
    parse_source: "fixture",
    source_file: "Kent_RO_PO_426RM0461.pdf",
    uploaded_by: "accountant@psindustries.in",
    uploaded_at: "2026-07-18T11:30:00Z",
    approved_by: "plant@psindustries.in",
    approved_at: "2026-07-19T08:00:00Z",
  },
  {
    id: "po-prem-001",
    po_number: "000612",
    po_date: "2026-07-01",
    customer_code: "PREM",
    customer_name: "PREM INDUSTRIES INDIA LIMITED",
    delivery_date: "2026-07-08",
    payment_terms: "0 DAYS",
    items: [
      {
        item_code: "84189900",
        description: "ADJUSTABLE LEG BOTTOM HINGE - UN-APPROVED",
        part_code: "22055843",
        quantity: 20000,
        uom: "NOS",
        rate: 4.24,
        total: 84800,
        material_grade: null,
        colour: null,
      },
    ],
    total_amount: 84800,
    gst: "CGST 9% + SGST 9%",
    status: "material_check",
    parse_source: "fixture",
    source_file: "Prem_Industries_PO_000612.pdf",
    uploaded_by: "accountant@psindustries.in",
    uploaded_at: "2026-07-17T14:45:00Z",
    approved_by: "plant@psindustries.in",
    approved_at: "2026-07-18T10:20:00Z",
  },
];

export const MOCK_INVENTORY: InventoryItem[] = [
  {
    id: "inv-001",
    sku: "HIPS-NAT-25",
    name: "HIPS Natural Granules",
    category: "Raw Material",
    quantity: 4200,
    uom: "KG",
    reorder_level: 1000,
    location: "RM-A1",
    last_updated: "2026-07-22",
  },
  {
    id: "inv-002",
    sku: "EVA-BK-15",
    name: "EVA Back Cover Sheet",
    category: "Component",
    quantity: 850,
    uom: "NOS",
    reorder_level: 500,
    location: "FG-B2",
    last_updated: "2026-07-21",
  },
  {
    id: "inv-003",
    sku: "FRM-FZ-00",
    name: "Freezer Frame Blank",
    category: "Semi-Finished",
    quantity: 12600,
    uom: "NOS",
    reorder_level: 5000,
    location: "SF-C3",
    last_updated: "2026-07-23",
  },
  {
    id: "inv-004",
    sku: "HNG-ADJ-43",
    name: "Adjustable Leg Bottom Hinge",
    category: "Finished Good",
    quantity: 340,
    uom: "NOS",
    reorder_level: 2000,
    location: "FG-D1",
    last_updated: "2026-07-20",
  },
  {
    id: "inv-005",
    sku: "CLR-MB-BK",
    name: "Black Masterbatch",
    category: "Raw Material",
    quantity: 180,
    uom: "KG",
    reorder_level: 200,
    location: "RM-A4",
    last_updated: "2026-07-19",
  },
];

export const MOCK_PRODUCTION_RUNS: ProductionRun[] = [
  {
    id: "run-001",
    run_number: "PR-2026-084",
    po_number: "426RM0461",
    customer: "Kent RO Systems Ltd",
    product: "POWP-TANK TRAY GRAND STAR",
    quantity: 12000,
    completed: 7800,
    status: "running",
    machine: "IMM-03",
    started_at: "2026-07-20T06:00:00Z",
    due_date: "2026-07-28",
  },
  {
    id: "run-002",
    run_number: "PR-2026-085",
    po_number: "000612",
    customer: "PREM INDUSTRIES INDIA LIMITED",
    product: "ADJUSTABLE LEG BOTTOM HINGE",
    quantity: 20000,
    completed: 0,
    status: "scheduled",
    machine: "IMM-01",
    started_at: null,
    due_date: "2026-07-08",
  },
  {
    id: "run-003",
    run_number: "PR-2026-083",
    po_number: "426RM0461",
    customer: "Kent RO Systems Ltd",
    product: "POWP-TANK TRAY ZENITH RO",
    quantity: 700,
    completed: 700,
    status: "completed",
    machine: "IMM-02",
    started_at: "2026-07-15T08:00:00Z",
    due_date: "2026-07-18",
  },
];

/** In-memory store for API mutations during the session. */
let poStore: PurchaseOrder[] = structuredClone(MOCK_POS);
let runStore: ProductionRun[] = structuredClone(MOCK_PRODUCTION_RUNS);

export function getPOStore(): PurchaseOrder[] {
  return poStore;
}

export function setPOStore(next: PurchaseOrder[]): void {
  poStore = next;
}

export function findPO(idOrNumber: string): PurchaseOrder | undefined {
  return poStore.find(
    (po) => po.id === idOrNumber || po.po_number === idOrNumber
  );
}

export function upsertPO(po: PurchaseOrder): PurchaseOrder {
  const idx = poStore.findIndex((p) => p.id === po.id);
  if (idx >= 0) {
    poStore[idx] = po;
  } else {
    poStore = [po, ...poStore];
  }
  return po;
}

export function getRunStore(): ProductionRun[] {
  return runStore;
}

export function findRun(idOrNumber: string): ProductionRun | undefined {
  return runStore.find(
    (run) => run.id === idOrNumber || run.run_number === idOrNumber
  );
}

export function upsertRun(run: ProductionRun): ProductionRun {
  const idx = runStore.findIndex((r) => r.id === run.id);
  if (idx >= 0) {
    runStore[idx] = run;
  } else {
    runStore = [run, ...runStore];
  }
  return run;
}
