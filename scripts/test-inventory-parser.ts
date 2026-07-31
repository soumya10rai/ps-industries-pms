/**
 * Manual check of the RM workbook parser against test-data/RM_01-06-26.xlsx.
 * Run: npx tsx scripts/test-inventory-parser.ts [sheet name…]
 */

import { readFileSync } from "node:fs";
import { parseInventoryExcel } from "../lib/inventory-parser";

const file = process.argv[2] ?? "test-data/RM_01-06-26.xlsx";
const sheetNames = process.argv.slice(3);

const result = parseInventoryExcel(
  readFileSync(file),
  sheetNames.length > 0 ? { sheetNames } : {}
);

console.log("DETECTED SHEETS");
for (const sheet of result.sheets) {
  console.log(
    `  ${sheet.selected ? "[x]" : "[ ]"} ${sheet.sheetName} — ${sheet.materialType} — ${sheet.period ?? "no period"} — ${sheet.count} items`
  );
}

console.log(`\nITEMS: ${result.items.length}`);
for (const item of result.items) {
  console.log(
    [
      item.materialCode.padEnd(32),
      item.materialGroup.padEnd(10),
      item.materialType.padEnd(13),
      item.unit.padEnd(4),
      `op=${item.openingStockKg}`.padEnd(12),
      `cur=${item.currentStockKg}`.padEnd(13),
      `reorder=${item.reorderLevelKg}`.padEnd(15),
      item.partyName ?? "",
    ].join(" ")
  );
}

const byType = result.items.reduce<Record<string, number>>((acc, item) => {
  acc[item.materialType] = (acc[item.materialType] ?? 0) + 1;
  return acc;
}, {});

console.log("\nCOUNT BY TYPE:", byType);
console.log("TOTAL ROWS:", result.totalRows, "SKIPPED:", result.skippedRows);
console.log(`\nWARNINGS (${result.warnings.length}):`);
for (const w of result.warnings) console.log("  -", w);
