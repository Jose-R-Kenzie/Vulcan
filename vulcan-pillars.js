// Column labels and dropdowns transcribed from the original 21-sheet RCMT workbook.
// Schema only: no workplace records are bundled with the website.
const field = (code, label, kind = "text", choices = []) => ({ code, label, kind, choices });
const L = field;

export const PILLARS = {
  lives: {
    label: "Lives",
    identifier: "A",
    fields: [
      L("A", "ISA"), L("B", "Location"),
      L("C", "Status", "select", ["ARRIVAL_SCHEDULED", "ARRIVED", "CHECKED_IN", "CLOSED", "REFUSED", "RESCHEDULED", "DELETED"]),
      L("D", "SCAC"), L("E", "Constraint", "select", ["FLOOR_LOADED", "PALLETIZED", "BOXTRUCK", "CLAMPABLE"]),
      L("F", "Expected Arrival", "datetime"), L("G", "Pallets", "number"),
      L("H", "Cartons", "number"), L("I", "Units", "number"),
      L("J", "CUTs", "datetime"), L("K", "Arrived", "datetime"), L("L", "Sent", "datetime"),
      L("M", "Type", "select", ["FL", "Parcel", "LP", "LP/Mix", "NPC", "PREP", "PR"]),
      L("N", "Tag", "select", ["YT", "RT"]), L("O", "Notes", "note")
    ]
  },
  drops: {
    label: "Drops",
    identifier: "A",
    fields: [
      L("A", "ISA"), L("B", "Trailer Num"), L("C", "Trailer Location"),
      L("D", "Status", "select", ["ARRIVAL_SCHEDULED", "ARRIVED", "CHECKED_IN", "CLOSED", "DELETED", "DEFECT"]),
      L("E", "Sched. Processing", "datetime"), L("F", "Critical Unload Time", "datetime"),
      L("G", "SCAC"), L("H", "Appt. Type", "select", ["CARP", "SMALL_PARCEL"]),
      L("I", "Live vs Drop", "select", ["LIVE", "DROP"]),
      L("J", "Load Config", "select", ["FLOOR-LOAD", "CLAMPABLE", "PALLETIZED", "UNKNOWN"]),
      L("K", "Actual/Expected Arrival Time", "datetime"),
      L("L", "Attributes", "select", ["FL", "Parcel", "LP", "LP/Mix", "NPC", "PREP", "PR", "MISSHIP"]),
      L("M", "Tagged", "select", ["Red Tagged", "Yellow Tagged"]),
      L("N", "Num of Pallets", "number"), L("O", "Num of Cartons", "number"),
      L("P", "Total Units", "number"), L("Q", "LP Density", "number"),
      L("R", "Prep", "number"), L("S", "Each", "number"), L("T", "Pallet Ordering"),
      L("U", "Pallet", "number"), L("V", "Pallet LP", "number"), L("W", "LP", "number"),
      L("X", "Sort Units", "number"), L("Y", "Pre-Sort Cartons", "number"),
      L("Z", "PPR Small", "number"), L("AA", "PPR Medium", "number"),
      L("AB", "PPR Large", "number"), L("AC", "PPR Bulky", "number"),
      L("AD", "PPR No Size Data", "number"), L("AE", "Num of Unique FnSku", "number"),
      L("AF", "LP percentage", "number"), L("AG", "Sort percentage", "number"),
      L("AH", "Blue flag status"), L("AI", "SP predicted status"), L("AJ", "Ghost trailer status")
    ]
  },
  transships: {
    label: "Transships",
    identifier: "A",
    fields: [
      L("A", "VRID"), L("B", "ISA"), L("C", "Trailer Number"), L("D", "Trailer Location"),
      L("E", "Appt. Status", "select", ["ARRIVAL_SCHEDULED", "ARRIVED", "CHECKED_IN", "CLOSED", "DEFECT", "DELETED"]),
      L("F", "Transship Status"), L("G", "Load Config", "select", ["FLOOR-LOAD", "PALLETIZED", "UNKNOWN"]),
      L("H", "FL Type", "select", ["PURE CASE", "PURE TOTES", "HYBRID", "PALLETIZED", "UNKNOWN"]),
      L("I", "Critical Unload Time", "datetime"), L("J", "SCAC"), L("K", "Source"),
      L("L", "Actual / Expected Arrival Time", "datetime"),
      L("M", "Attributes", "select", ["FL", "Parcel", "LP", "LP/Mix", "NPC", "PREP", "PR"]),
      L("N", "Tagged", "select", ["Red Tagged", "Yellow Tagged"]),
      ...[
        ["O", "Pallets with Totes"], ["P", "Single ASIN Pallets"], ["Q", "Mixed ASIN Pallets"],
        ["R", "Total Pallets"], ["S", "FL Totes"], ["T", "FL Cases"], ["U", "Palletized Totes"],
        ["V", "Palletized Single ASIN Cases"], ["W", "Palletized Mixed ASIN Cases"],
        ["X", "Total (Totes + Cases)"], ["Y", "Units in FL Totes"], ["Z", "Units in FL Cases"],
        ["AA", "Units in Palletized Totes"], ["AB", "Units in Palletized Single ASIN Cases"],
        ["AC", "Units in Palletized Mixed ASIN Cases"], ["AD", "SAP Quantity Stow Units"],
        ["AE", "Quantity Stow Units"], ["AF", "Total Units"], ["AG", "Case Stow"],
        ["AH", "Single ASIN Pallet Stow"], ["AI", "Apparel"], ["AJ", "Shoes"], ["AK", "Library"],
        ["AL", "Library Deep"], ["AM", "HRV"], ["AN", "Non-Con"], ["AO", "Other"],
        ["AP", "Team Lift"], ["AQ", "Mech Lift"], ["AR", "No Size Data"], ["AS", "PPR Small"],
        ["AT", "PPR Medium"], ["AU", "PPR Large"], ["AV", "PPR Bulky"],
        ["AW", "PPR No Size Data"], ["AX", "Full Pallet TCP Opp"],
        ["AY", "Vertical Pallet TCP Opp"], ["AZ", "Merge Pallet TCP Opp"]
      ].map(([code, label]) => L(code, label, "number")),
      L("BA", "Amnz Shipment Ref ID"), L("BB", "Blue Flag"), L("BC", "Reactive Flag"),
      L("BD", "Ghost Trailer Flag"), L("BE", "Unsellable Flag"), L("BF", "Column1")
    ]
  }
};

export function editableRole(role) {
  return ["admin", "manager", "pa-clerk", "tier1-clerk"].includes(role);
}

export function normalizePillarFields(pillar, raw) {
  if (!PILLARS[pillar]) throw Error("Unknown pillar");
  const cleaned = {};
  for (const { code, label, kind, choices } of PILLARS[pillar].fields) {
    const input = String(raw[code] ?? "").trim();
    if (!input) continue;
    if (kind === "number") {
      const n = Number(input);
      if (!Number.isFinite(n) || n < 0) throw Error(label + " must be a non-negative number.");
      cleaned[code] = n;
    } else if (kind === "datetime") {
      const time = new Date(input);
      if (Number.isNaN(time.getTime())) throw Error(label + " is not a valid date and time.");
      cleaned[code] = time.toISOString();
    } else {
      if (input.length > (kind === "note" ? 2000 : 250)) throw Error(label + " is too long.");
      if (kind === "select" && !choices.includes(input)) throw Error(label + " has an invalid selection.");
      cleaned[code] = input;
    }
  }
  if (!Object.keys(cleaned).length) throw Error("Enter at least one field before saving.");
  return cleaned;
}
