/* RetailRate Filing — 100% Client-Side 4-State Statutory Pre-Screen Engine & UI
 * Verified 2026 statutes ONLY: TX, CA, OH, FL.
 * Exact integer-cent BigInt arithmetic (ROUND_HALF_UP) matching engine/prescreen.py to $0.00.
 */

(function () {
  "use strict";

  // =========================================================================
  // 1. CONFIGURATION (Update CONTACT_EMAIL when @outreach-ops confirms domain)
  // =========================================================================
  const CONFIG = {
    FLAT_FEE_CENTS: 129500n, // $1,295.00
    THRESHOLD_UPLIFT_CENTS: 5000000n, // $50,000.00
    CONTACT_EMAIL: "alex@rates.far31prescan.com",
    CONTACT_EMAIL_STATUS: "Isolated Filing Intake",
    COMPANY_NAME: "RetailRate Filing",
  };

  // =========================================================================
  // 2. EXACT BIGINT DECIMAL ARITHMETIC (ROUND_HALF_UP, ZERO FLOAT DRIFT)
  // =========================================================================
  function absBig(n) {
    return n < 0n ? -n : n;
  }

  /**
   * Parse decimal string/number into exact scaled BigInt (default scale=2 for cents/0.01 hrs)
   * using ROUND_HALF_UP identically to Python Decimal.quantize(Decimal("0.01"), ROUND_HALF_UP).
   */
  function parseScaled(value, scale = 2) {
    if (value === null || value === undefined) return 0n;
    let s = String(value).trim();
    if (!s) return 0n;
    let neg = false;
    if (s.startsWith("(") && s.endsWith(")")) {
      neg = true;
      s = s.slice(1, -1).trim();
    }
    s = s.replace(/[$,%\s]/g, "");
    if (!s) return 0n;
    if (s.startsWith("-")) {
      neg = !neg;
      s = s.slice(1);
    } else if (s.startsWith("+")) {
      s = s.slice(1);
    }
    if (!/^\d*(\.\d*)?$/.test(s) || s === ".") {
      throw new Error(`Invalid numeric value: "${value}"`);
    }
    const parts = s.split(".");
    const intPart = parts[0] || "0";
    const fracPart = parts[1] || "";

    let scaledDigits;
    let roundUp = false;
    if (fracPart.length <= scale) {
      scaledDigits = intPart + fracPart.padEnd(scale, "0");
    } else {
      scaledDigits = intPart + fracPart.slice(0, scale);
      const nextDigit = parseInt(fracPart[scale], 10);
      if (nextDigit >= 5) roundUp = true;
    }

    let result = BigInt(scaledDigits || "0");
    if (roundUp) result += 1n;
    return neg ? -result : result;
  }

  /**
   * Divide num / den and round to integer using ROUND_HALF_UP.
   * Caller scales num appropriately before passing (e.g., num * 100n for cents).
   */
  function divRoundHalfUp(num, den) {
    if (den === 0n) return 0n;
    const neg = (num < 0n) !== (den < 0n);
    const a = absBig(num);
    const b = absBig(den);
    let q = a / b;
    const r = a % b;
    if (r * 2n >= b) {
      q += 1n;
    }
    return neg ? -q : q;
  }

  function formatMoney(cents, includeSign = false) {
    const neg = cents < 0n;
    const a = absBig(cents);
    const whole = a / 100n;
    const frac = String(a % 100n).padStart(2, "0");
    const wholeFormatted = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const prefix = neg ? "-" : includeSign && cents > 0n ? "+" : "";
    return `${prefix}$${wholeFormatted}.${frac}`;
  }

  function formatPct(bp, includeSign = false) {
    // bp = hundredths of a percent (e.g., 7850n = 78.50%)
    const neg = bp < 0n;
    const a = absBig(bp);
    const whole = a / 100n;
    const frac = String(a % 100n).padStart(2, "0");
    const prefix = neg ? "-" : includeSign && bp > 0n ? "+" : "";
    return `${prefix}${whole}.${frac}%`;
  }

  function centsToFloat(cents) {
    return Number(cents) / 100;
  }

  // =========================================================================
  // 3. 2026 STATUTE RULEBOOK (MIRRORS engine/statutes.py EXACTLY)
  // =========================================================================
  const STATUTES = {
    TX: {
      state: "TX",
      stateName: "Texas",
      citation: "Tex. Occ. Code § 2301.402",
      lookbackDays: 180,
      slidingWindowAllowed: true,
      modeBadge: "Statutory 100-RO / 90-Day Comparison",
      samplingSummary:
        "Greater of 100 sequential qualified non-warranty ROs or 90 consecutive days within the prior 6 months (180 days), excluding routine maintenance.",
      laborRule:
        "Effective retail labor rate = Sum Qualified Labor Sale ÷ Sum Qualified Labor Hours (greater of 100 sequential non-warranty ROs or 90 consecutive days within prior 6 months).",
      partsRule:
        "Aggregate retail parts markup % = (Sum Qualified Parts Sale − Sum Qualified Parts Cost) ÷ Sum Qualified Parts Cost across qualified non-warranty ROs.",
      frequencyCap: "1x per 12 months",
      oemDeadline: "30 days to approve or issue written rebuttal (Tex. Occ. Code § 2301.402)",
      advanceNotice: "No advance OEM RO-selection notice required.",
      exclusionRules: [
        {
          category: "warranty_recall",
          subsection: "Tex. Occ. Code § 2301.402(a)",
          reason: "OEM warranty, recall, or campaign repair (non-retail)",
          payTypes: ["W", "WARRANTY", "WARR", "RECALL", "CAMPAIGN", "OEM", "EW", "EXTENDED_WARRANTY"],
          opPrefixes: ["REC", "CAM", "WAR"],
          keywords: ["warranty", "recall", "safety campaign", "oem campaign"],
          customerTypes: [],
        },
        {
          category: "internal_recon_dealer",
          subsection: "Tex. Occ. Code § 2301.402(b)",
          reason: "Internal, PDI, reconditioning, or dealer/employee vehicle",
          payTypes: ["I", "INT", "INTERNAL", "PDI", "RECON", "EMP", "EMPLOYEE", "DEMO", "LOANER"],
          opPrefixes: ["PDI", "RECON", "RCN", "INT", "UC"],
          keywords: ["pre-delivery", "pdi", "reconditioning", "used car recon", "dealer internal", "employee vehicle", "loaner"],
          customerTypes: ["INTERNAL", "DEALER", "EMPLOYEE", "DEMO", "LOANER"],
        },
        {
          category: "routine_maintenance",
          subsection: "Tex. Occ. Code § 2301.402(c)",
          reason: "Routine maintenance (oil/filter, fluids, wipers, rotation, state inspection)",
          payTypes: [],
          opPrefixes: ["LOF", "OIL", "MAINT", "ROT", "WIP", "INS", "SMOG", "FLU", "BAT", "BLB"],
          keywords: [
            "oil change", "lube oil filter", "lof", "tire rotation", "rotate tires", "wiper blade",
            "state inspection", "emissions inspection", "fluid top-off", "cabin filter",
            "air filter service", "routine maintenance", "multi-point inspection", "battery replacement", "bulb replacement",
          ],
          customerTypes: [],
        },
        {
          category: "tires_wheels_alignment",
          subsection: "Tex. Occ. Code § 2301.402(c)",
          reason: "Tires, wheels, mount/balance, or routine alignment",
          payTypes: [],
          opPrefixes: ["TIR", "WHL", "BAL", "MNT", "ALN"],
          keywords: ["mount and balance", "tire replacement", "new tires", "wheel balance", "four wheel alignment", "tire repair", "flat repair"],
          customerTypes: [],
        },
        {
          category: "wholesale_fleet_promo",
          subsection: "Tex. Occ. Code § 2301.402(b)",
          reason: "Wholesale, fleet/government contract, promotional coupon, or goodwill",
          payTypes: ["F", "FLEET", "WHOLESALE", "WHS", "GOV", "PROMO", "COUPON", "GW", "GOODWILL", "POLICY"],
          opPrefixes: ["PRM", "CPN", "FLT", "GWL"],
          keywords: ["coupon", "promo", "promotional", "special discount", "wholesale", "fleet contract", "goodwill", "policy adjustment"],
          customerTypes: ["FLEET", "WHOLESALE", "GOVERNMENT", "COMMERCIAL"],
        },
        {
          category: "collision_insurance_accessories",
          subsection: "Tex. Occ. Code § 2301.402(c)",
          reason: "Collision/body, insurance/road-hazard, glass, or accessories",
          payTypes: ["INS", "INSURANCE", "BODY", "COLLISION"],
          opPrefixes: ["COL", "BDY", "GLS", "ACC", "SUB"],
          keywords: ["collision", "body shop", "insurance claim", "windshield", "road hazard", "accessory install", "running boards", "tint"],
          customerTypes: [],
        },
      ],
    },

    CA: {
      state: "CA",
      stateName: "California",
      citation: "Cal. Veh. Code § 3065.2",
      lookbackDays: 180,
      slidingWindowAllowed: true,
      modeBadge: "Fewer Total ROs (100 Qualified vs 90 Days)",
      samplingSummary:
        "Fewer total ROs between 100 sequential qualified ROs (retaining nonqualified ROs in sequence, excluded from math) vs all ROs in any 90 consecutive days within prior 180 days.",
      laborRule:
        "Effective retail labor rate = Sum Qualified Labor Sale ÷ Sum Qualified Labor Hours in statutory sample after § 3065.2(c) exclusions.",
      partsRule:
        "Aggregate retail parts markup % across qualified ROs in statutory sample after § 3065.2(c) exclusions (routine maintenance allowed only when paired with a qualified repair).",
      frequencyCap: "1x per calendar year (§ 3065.2(d))",
      oemDeadline: "30 days to contest in writing else auto-effective (§ 3065.2(e)); anti-retaliation applies (§ 3065.2(f))",
      advanceNotice: "No advance OEM RO-selection notice required.",
      exclusionRules: [
        {
          category: "warranty_recall",
          subsection: "Cal. Veh. Code § 3065.2(a)",
          reason: "OEM warranty, recall, or campaign repair (non-customer-pay)",
          payTypes: ["W", "WARRANTY", "WARR", "RECALL", "CAMPAIGN", "OEM", "EW", "EXTENDED_WARRANTY"],
          opPrefixes: ["REC", "CAM", "WAR"],
          keywords: ["warranty", "recall", "safety campaign", "oem campaign"],
          customerTypes: [],
        },
        {
          category: "promo_coupon",
          subsection: "Cal. Veh. Code § 3065.2(c)(1)",
          reason: "Manufacturer special event, promotional discount, or coupon",
          payTypes: ["PROMO", "COUPON", "SPECIAL"],
          opPrefixes: ["PRM", "CPN", "SPC"],
          keywords: ["coupon", "promo", "promotional", "special event", "menu special", "discount special"],
          customerTypes: [],
        },
        {
          category: "wholesale_fleet",
          subsection: "Cal. Veh. Code § 3065.2(c)(2)",
          reason: "Wholesale parts or commercial/fleet/government contract",
          payTypes: ["F", "FLEET", "WHOLESALE", "WHS", "GOV"],
          opPrefixes: ["FLT", "WHS"],
          keywords: ["wholesale", "fleet contract", "government fleet"],
          customerTypes: ["FLEET", "WHOLESALE", "GOVERNMENT", "COMMERCIAL"],
        },
        {
          category: "routine_maintenance",
          subsection: "Cal. Veh. Code § 3065.2(c)(3)",
          reason: "Routine maintenance not performed as part of a qualified repair",
          payTypes: [],
          opPrefixes: ["LOF", "OIL", "MAINT", "ROT", "WIP", "INS", "SMOG", "FLU", "BLB"],
          keywords: [
            "oil change", "lube oil filter", "lof", "tire rotation", "rotate tires", "wiper blade",
            "smog check", "state inspection", "fluid top-off", "cabin filter",
            "air filter service", "routine maintenance", "multi-point inspection", "bulb replacement",
          ],
          customerTypes: [],
          allowIfPairedWithQualified: true,
        },
        {
          category: "fasteners_shop_supplies",
          subsection: "Cal. Veh. Code § 3065.2(c)(4)",
          reason: "Nuts, bolts, fasteners, or shop supplies",
          payTypes: [],
          opPrefixes: ["FST", "SHP"],
          keywords: ["shop supplies", "nuts and bolts", "fasteners only", "misc hardware"],
          customerTypes: [],
        },
        {
          category: "reconditioning_internal",
          subsection: "Cal. Veh. Code § 3065.2(c)(5)",
          reason: "Vehicle reconditioning, PDI, or internal dealer work",
          payTypes: ["I", "INT", "INTERNAL", "PDI", "RECON"],
          opPrefixes: ["PDI", "RECON", "RCN", "INT", "UC"],
          keywords: ["pre-delivery", "pdi", "reconditioning", "used car recon", "dealer internal"],
          customerTypes: ["INTERNAL"],
        },
        {
          category: "accessories",
          subsection: "Cal. Veh. Code § 3065.2(c)(6)",
          reason: "Aftermarket or OEM accessory installation",
          payTypes: [],
          opPrefixes: ["ACC"],
          keywords: ["accessory", "running boards", "roof rack", "window tint", "floor mats", "tow hitch accessory"],
          customerTypes: [],
        },
        {
          category: "collision_insurance_hazard",
          subsection: "Cal. Veh. Code § 3065.2(c)(7)",
          reason: "Collision, road-hazard, weather, vandalism, theft, or insurance repair",
          payTypes: ["INS", "INSURANCE", "BODY", "COLLISION"],
          opPrefixes: ["COL", "BDY", "GLS", "HAZ"],
          keywords: ["collision", "body shop", "insurance", "road hazard", "hail damage", "weather damage", "vandalism", "theft recovery", "windshield"],
          customerTypes: [],
        },
        {
          category: "tires_wheels",
          subsection: "Cal. Veh. Code § 3065.2(c)(8)",
          reason: "Tires, wheels, mount/balance, or wheel alignment",
          payTypes: [],
          opPrefixes: ["TIR", "WHL", "BAL", "MNT", "ALN"],
          keywords: ["mount and balance", "tire replacement", "new tires", "wheel balance", "four wheel alignment", "tire repair", "flat repair", "wheel repair"],
          customerTypes: [],
        },
        {
          category: "goodwill_policy",
          subsection: "Cal. Veh. Code § 3065.2(c)(9)",
          reason: "Goodwill or policy adjustment",
          payTypes: ["GW", "GOODWILL", "POLICY"],
          opPrefixes: ["GWL", "POL"],
          keywords: ["goodwill", "policy adjustment"],
          customerTypes: [],
        },
        {
          category: "dealer_employee_vehicle",
          subsection: "Cal. Veh. Code § 3065.2(c)(10)",
          reason: "Dealer-owned, demo, loaner, or employee vehicle",
          payTypes: ["EMP", "EMPLOYEE", "DEMO", "LOANER"],
          opPrefixes: ["EMP"],
          keywords: ["employee vehicle", "dealer owned", "demo vehicle", "loaner vehicle"],
          customerTypes: ["DEALER", "EMPLOYEE", "DEMO", "LOANER"],
        },
        {
          category: "aftermarket_parts",
          subsection: "Cal. Veh. Code § 3065.2(c)(11)",
          reason: "Aftermarket / non-OEM parts excluded under § 3065.2(c)",
          payTypes: [],
          opPrefixes: ["AFT"],
          keywords: ["aftermarket part", "non-oem part"],
          customerTypes: [],
          excludeIfAftermarket: true,
        },
      ],
    },

    OH: {
      state: "OH",
      stateName: "Ohio",
      citation: "Ohio Rev. Code § 4517.52",
      lookbackDays: 180,
      slidingWindowAllowed: true,
      modeBadge: "100-RO / 90-Day + Zero-Cost Recall Parts Markup",
      samplingSummary:
        "100 sequential customer-pay closed warranty-like ROs or 90 consecutive days within prior 180 days (same or separate sets permitted for labor and parts).",
      laborRule:
        "Effective retail labor rate = Sum Qualified Labor Sale ÷ Sum Qualified Labor Hours over 100 sequential qualified ROs or 90 consecutive days.",
      partsRule:
        "Retail parts markup % on qualified warranty-like ROs PLUS zero-cost / reduced-cost recall & warranty parts earn full retail markup % on OEM price-schedule cost.",
      frequencyCap: "1x per calendar year",
      oemDeadline: "30 days for evidence-based written contest else auto-effective (Ohio Rev. Code § 4517.52)",
      advanceNotice: "No advance OEM RO-selection notice required.",
      exclusionRules: [
        {
          category: "warranty_recall",
          subsection: "Ohio Rev. Code § 4517.52(B)",
          reason: "OEM warranty, recall, or campaign repair (excluded from retail numerator; zero-cost recall parts tracked separately under § 4517.52)",
          payTypes: ["W", "WARRANTY", "WARR", "RECALL", "CAMPAIGN", "OEM", "EW", "EXTENDED_WARRANTY"],
          opPrefixes: ["REC", "CAM", "WAR"],
          keywords: ["warranty", "recall", "safety campaign", "oem campaign"],
          customerTypes: [],
        },
        {
          category: "internal_recon_dealer",
          subsection: "Ohio Rev. Code § 4517.52(B)",
          reason: "Internal, PDI, reconditioning, or dealer/employee vehicle",
          payTypes: ["I", "INT", "INTERNAL", "PDI", "RECON", "EMP", "EMPLOYEE", "DEMO", "LOANER"],
          opPrefixes: ["PDI", "RECON", "RCN", "INT", "UC"],
          keywords: ["pre-delivery", "pdi", "reconditioning", "used car recon", "dealer internal", "employee vehicle", "loaner"],
          customerTypes: ["INTERNAL", "DEALER", "EMPLOYEE", "DEMO", "LOANER"],
        },
        {
          category: "routine_maintenance",
          subsection: "Ohio Rev. Code § 4517.52(B)",
          reason: "Routine maintenance (non-warranty-like maintenance service)",
          payTypes: [],
          opPrefixes: ["LOF", "OIL", "MAINT", "ROT", "WIP", "INS", "FLU", "BLB"],
          keywords: [
            "oil change", "lube oil filter", "lof", "tire rotation", "rotate tires", "wiper blade",
            "state inspection", "fluid top-off", "cabin filter", "air filter service",
            "routine maintenance", "multi-point inspection", "bulb replacement",
          ],
          customerTypes: [],
        },
        {
          category: "tires_wheels_alignment",
          subsection: "Ohio Rev. Code § 4517.52(B)",
          reason: "Tires, wheels, mount/balance, or routine alignment",
          payTypes: [],
          opPrefixes: ["TIR", "WHL", "BAL", "MNT", "ALN"],
          keywords: ["mount and balance", "tire replacement", "new tires", "wheel balance", "four wheel alignment", "tire repair", "flat repair"],
          customerTypes: [],
        },
        {
          category: "wholesale_fleet_promo",
          subsection: "Ohio Rev. Code § 4517.52(B)",
          reason: "Wholesale, fleet/government, promotional discount, or goodwill",
          payTypes: ["F", "FLEET", "WHOLESALE", "WHS", "GOV", "PROMO", "COUPON", "GW", "GOODWILL", "POLICY"],
          opPrefixes: ["PRM", "CPN", "FLT", "GWL"],
          keywords: ["coupon", "promo", "promotional", "wholesale", "fleet contract", "goodwill", "policy adjustment"],
          customerTypes: ["FLEET", "WHOLESALE", "GOVERNMENT", "COMMERCIAL"],
        },
        {
          category: "collision_insurance_accessories",
          subsection: "Ohio Rev. Code § 4517.52(B)",
          reason: "Collision/body, insurance, glass, or accessories",
          payTypes: ["INS", "INSURANCE", "BODY", "COLLISION"],
          opPrefixes: ["COL", "BDY", "GLS", "ACC"],
          keywords: ["collision", "body shop", "insurance", "road hazard", "windshield", "accessory", "window tint"],
          customerTypes: [],
        },
      ],
    },

    FL: {
      state: "FL",
      stateName: "Florida",
      citation: "Fla. Stat. § 320.696",
      lookbackDays: 92,
      slidingWindowAllowed: false,
      modeBadge: "Statutory Compliance Scrub + Dual Fixed Monthly Labor (No Sliding Window)",
      samplingSummary:
        "Statutory Compliance Scrub + Dual Fixed Monthly Labor Comparison + 10-Day OEM Notice & 50-RO Sensitivity Scrub. Florida does NOT permit dealer sliding-window selection.",
      laborRule:
        "Higher of 2 fixed monthly algorithms (§ 320.696(4)(b)): Option 1 ((4)(b)1) = prior 1 calendar month qualifying retail labor sales ÷ hours; Option 2 ((4)(b)2) = prior 1-mo mean tech wage ÷ (1 − prior 2-mo avg retail labor GP%).",
      partsRule:
        "Arithmetical mean markup over 50 consecutive retail repairs within prior 3 calendar months (§ 320.696(3)), with mandatory 10-day written notice allowing OEM to select the starting RO.",
      frequencyCap: "Max 2x per year (semiannually)",
      oemDeadline: "10-day mandatory written advance notice for OEM starting-RO selection (§ 320.696(3)); 30-day review",
      advanceNotice:
        "MANDATORY: Dealer must give 10-day written notice to OEM allowing OEM to select the starting RO for the 50-repair parts sample.",
      exclusionRules: [
        {
          category: "warranty_recall",
          subsection: "Fla. Stat. § 320.696(3) & (4)",
          reason: "OEM warranty, recall, or campaign repair (non-retail customer-pay)",
          payTypes: ["W", "WARRANTY", "WARR", "RECALL", "CAMPAIGN", "OEM", "EW", "EXTENDED_WARRANTY"],
          opPrefixes: ["REC", "CAM", "WAR"],
          keywords: ["warranty", "recall", "safety campaign", "oem campaign"],
          customerTypes: [],
        },
        {
          category: "internal_recon_dealer",
          subsection: "Fla. Stat. § 320.696(3)(c) & (4)(b)",
          reason: "Internal, PDI, reconditioning, or dealer/employee vehicle",
          payTypes: ["I", "INT", "INTERNAL", "PDI", "RECON", "EMP", "EMPLOYEE", "DEMO", "LOANER"],
          opPrefixes: ["PDI", "RECON", "RCN", "INT", "UC"],
          keywords: ["pre-delivery", "pdi", "reconditioning", "used car recon", "dealer internal", "employee vehicle", "loaner"],
          customerTypes: ["INTERNAL", "DEALER", "EMPLOYEE", "DEMO", "LOANER"],
        },
        {
          category: "routine_maintenance",
          subsection: "Fla. Stat. § 320.696(3)(c) & (4)(b)",
          reason: "Routine maintenance (oil/filter, fluids, wipers, bulbs, belts/hoses maintenance)",
          payTypes: [],
          opPrefixes: ["LOF", "OIL", "MAINT", "ROT", "WIP", "INS", "FLU", "BLB"],
          keywords: [
            "oil change", "lube oil filter", "lof", "tire rotation", "rotate tires", "wiper blade",
            "fluid top-off", "cabin filter", "air filter service", "routine maintenance",
            "multi-point inspection", "bulb replacement",
          ],
          customerTypes: [],
        },
        {
          category: "tires_wheels_batteries",
          subsection: "Fla. Stat. § 320.696(3)(c)",
          reason: "Tires, wheels, alignment, or excluded maintenance wear items",
          payTypes: [],
          opPrefixes: ["TIR", "WHL", "BAL", "MNT", "ALN"],
          keywords: ["mount and balance", "tire replacement", "new tires", "wheel balance", "four wheel alignment", "tire repair", "flat repair"],
          customerTypes: [],
        },
        {
          category: "wholesale_fleet_promo",
          subsection: "Fla. Stat. § 320.696(3)(c)",
          reason: "Wholesale, fleet/government, promotional specials/coupons, or goodwill",
          payTypes: ["F", "FLEET", "WHOLESALE", "WHS", "GOV", "PROMO", "COUPON", "GW", "GOODWILL", "POLICY"],
          opPrefixes: ["PRM", "CPN", "FLT", "GWL"],
          keywords: ["coupon", "promo", "promotional", "special discount", "wholesale", "fleet contract", "goodwill", "policy adjustment"],
          customerTypes: ["FLEET", "WHOLESALE", "GOVERNMENT", "COMMERCIAL"],
        },
        {
          category: "collision_insurance_accessories",
          subsection: "Fla. Stat. § 320.696(3)(c)",
          reason: "Collision/body, insurance/road-hazard, glass, or accessories",
          payTypes: ["INS", "INSURANCE", "BODY", "COLLISION"],
          opPrefixes: ["COL", "BDY", "GLS", "ACC"],
          keywords: ["collision", "body shop", "insurance", "road hazard", "windshield", "accessory", "window tint"],
          customerTypes: [],
        },
      ],
    },
  };

  // =========================================================================
  // 4. DMS CSV NORMALIZER (MIRRORS engine/dms_normalizer.py EXACTLY)
  // =========================================================================
  const HEADER_ALIASES = {
    ro_number: [
      "ronumber", "ronum", "ro", "repairorder", "repairordernumber", "repairorderno",
      "repairorderid", "cdkroid", "rokeycdk", "fortellisroid", "elronum", "rokey",
    ],
    close_date: ["closedate", "closeddt", "closeddate", "closdt", "invoicedate", "roclosedate", "dateclosed"],
    pay_type: ["paytype", "paycd", "paycode", "accountingpaytype", "cdkpaytype", "billingtype", "pay"],
    op_code: ["opcode", "laboropcode", "operationcode", "opcd", "lopcode", "jobcode"],
    description: [
      "description", "opdesc", "labordesc", "operationdescription", "jobdescription",
      "linedescription", "repairdescription", "opdescription",
    ],
    labor_sale: ["laborsale", "lbrsale", "laboramount", "laborrevenue", "laboramt", "totallabor", "laborcharges"],
    labor_hours: ["laborhours", "lbrhrs", "soldhours", "soldhrs", "billedhours", "billedhrs", "flatratehours", "hours"],
    parts_sale: ["partssale", "prtsale", "partsamount", "partsrevenue", "partsamt", "totalparts", "partscharges"],
    parts_cost: ["partscost", "prtcost", "costofparts", "partcost", "totalpartscost"],
    ro_total: ["rototal", "totalsale", "totalamount", "grandtotal", "invoicetotal", "totalcharges", "roamount"],
    vin: ["vin", "vehiclevin", "vehvin"],
    oem_brand: ["oembrand", "vehiclemake", "make", "oem", "brand"],
    customer_type: ["customertype", "customercategory", "linetype", "custtype", "accounttype"],
    oem_schedule_cost: [
      "oemschedulecost", "oempartcost", "oemlistcost", "oempriceschedulecost",
      "zerocostpartcost", "recallpartcost", "schedulecost",
    ],
    is_aftermarket: ["isaftermarket", "aftermarketflag", "aftermarket", "nonoem", "nonoemparts"],
    dms_vendor_col: ["dmsvendor", "dms", "dmssystem", "sourcevendor"],
  };

  const REQUIRED_FIELDS = ["ro_number", "close_date", "pay_type", "labor_sale", "labor_hours", "parts_sale", "parts_cost"];

  function normKey(h) {
    return String(h || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function parseCSVRows(text) {
    const cleaned = String(text || "").replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (inQuotes) {
        if (ch === '"') {
          if (cleaned[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          row.push(field);
          field = "";
        } else if (ch === "\r") {
          if (cleaned[i + 1] === "\n") i++;
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
        } else if (ch === "\n") {
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
        } else {
          field += ch;
        }
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter((r) => r.some((cell) => String(cell || "").trim() !== ""));
  }

  function parseDateISO(val) {
    let s = String(val || "").trim();
    if (!s) throw new Error("Missing close_date in CSV row.");
    if (s.includes("T")) s = s.split("T")[0];
    else if (s.includes(" ")) s = s.split(" ")[0];

    let m;
    // YYYY-MM-DD or YYYY/MM/DD
    if ((m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s))) {
      return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    }
    // MM/DD/YYYY or MM/DD/YY
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s))) {
      const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
      return `${yr}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    }
    // DD-Mon-YYYY
    const months = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
    if ((m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s))) {
      const mo = months[m[2].toLowerCase()];
      if (mo) return `${m[3]}-${mo}-${m[1].padStart(2, "0")}`;
    }
    throw new Error(`Unsupported date format: "${val}"`);
  }

  function isoToDayNum(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  }

  function extractRoNumeric(roNum) {
    const matches = String(roNum || "").match(/\d+/g);
    if (!matches || !matches.length) return null;
    return parseInt(matches[matches.length - 1], 10);
  }

  function parseBool(v) {
    const s = String(v || "").trim().toLowerCase();
    return ["1", "true", "yes", "y", "t", "aftermarket", "non-oem"].includes(s);
  }

  function detectDmsVendor(rawHeaders, rowObjs) {
    const normSet = new Set(rawHeaders.map(normKey));
    const rawJoined = rawHeaders.join(" ").toLowerCase();

    const cdkHeaderSigs = ["cdkroid", "rokeycdk", "fortellisroid", "cdkpaytype", "servicelinecdk", "elronum"];
    const cdkHeaderHit = cdkHeaderSigs.some((k) => normSet.has(k));
    let cdkValueHit = false;
    for (const row of rowObjs.slice(0, 25)) {
      for (const [k, v] of Object.entries(row)) {
        const kn = normKey(k);
        const val = String(v || "").trim().toLowerCase();
        const cleanedVal = val.replace(/(?:^|[^a-z0-9])(?:non|no)[\s_\-]*cdk(?=$|[^a-z0-9])/g, " ");
        if (
          ["dmsvendor", "dms", "dmssystem", "sourcevendor"].includes(kn) &&
          ["cdk", "fortellis", "cdkglobal", "cdk drive", "elead"].some((tok) => cleanedVal.includes(tok))
        ) {
          cdkValueHit = true;
          break;
        }
      }
      if (cdkValueHit) break;
    }

    if (cdkHeaderHit || rawJoined.includes("cdk_") || rawJoined.includes("fortellis") || cdkValueHit) {
      return {
        dmsVendor: "CDK",
        cdkDetected: true,
        cdkWarning:
          "CDK DMS export detected. Per policy, CDK dealerships are flagged cleanly (CDK restricts third-party integrations and offers native modules). Verify eligibility before onboarding.",
      };
    }

    const countHits = (sigs) => sigs.filter((k) => normSet.has(k)).length;
    if (countHits(["ronum", "lbrsale", "lbrhrs", "prtsale", "prtcost", "opdesc", "paycd"]) >= 3) {
      return { dmsVendor: "Reynolds & Reynolds (ERA-IGNITE)", cdkDetected: false, cdkWarning: null };
    }
    if (
      countHits(["repairorder", "closeddate", "operationdescription", "laboramount", "billedhours", "partsamount", "customercategory"]) >= 3 ||
      (rawHeaders.includes("Repair Order #") && rawHeaders.includes("Billed Hours"))
    ) {
      return { dmsVendor: "Tekion", cdkDetected: false, cdkWarning: null };
    }
    if (countHits(["accountingpaytype", "laboropcode", "jobdescription", "laborrevenue", "soldhours", "partsrevenue", "grandtotal"]) >= 3) {
      return { dmsVendor: "Dealertrack", cdkDetected: false, cdkWarning: null };
    }
    return { dmsVendor: "Generic DMS CSV", cdkDetected: false, cdkWarning: null };
  }

  function normalizeCsvText(csvText) {
    const matrix = parseCSVRows(csvText);
    if (matrix.length < 2) throw new Error("CSV must include a header row and at least one data row.");
    const rawHeaders = matrix[0].map((h) => String(h || "").trim());
    const rowObjs = [];
    for (let i = 1; i < matrix.length; i++) {
      const obj = {};
      for (let c = 0; c < rawHeaders.length; c++) {
        obj[rawHeaders[c]] = String(matrix[i][c] ?? "").trim();
      }
      rowObjs.push(obj);
    }

    const vendorInfo = detectDmsVendor(rawHeaders, rowObjs);

    const normToRaw = {};
    for (const h of rawHeaders) {
      const nk = normKey(h);
      if (nk && !normToRaw[nk]) normToRaw[nk] = h;
    }

    const mapping = {};
    for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
      for (const alias of aliases) {
        if (normToRaw[alias]) {
          mapping[canonical] = normToRaw[alias];
          break;
        }
      }
    }

    const missing = REQUIRED_FIELDS.filter((f) => !mapping[f]);
    if (missing.length) {
      throw new Error(`CSV is missing required DMS columns: ${missing.join(", ")}. Found headers: ${rawHeaders.join(", ")}`);
    }

    const lines = rowObjs.map((row, idx) => {
      const roNumber = (row[mapping.ro_number] || "").trim();
      if (!roNumber) throw new Error(`Row ${idx + 1} is missing an RO number.`);
      const laborSaleCents = parseScaled(row[mapping.labor_sale], 2);
      const laborHoursHundredths = parseScaled(row[mapping.labor_hours], 2);
      const partsSaleCents = parseScaled(row[mapping.parts_sale], 2);
      const partsCostCents = parseScaled(row[mapping.parts_cost], 2);
      const roTotalCents =
        mapping.ro_total && row[mapping.ro_total]
          ? parseScaled(row[mapping.ro_total], 2)
          : laborSaleCents + partsSaleCents;
      const oemScheduleCostCents =
        mapping.oem_schedule_cost && row[mapping.oem_schedule_cost]
          ? parseScaled(row[mapping.oem_schedule_cost], 2)
          : 0n;

      return {
        lineIndex: idx + 1,
        roNumber,
        roNumeric: extractRoNumeric(roNumber),
        closeDate: parseDateISO(row[mapping.close_date]),
        payType: (row[mapping.pay_type] || "").trim().toUpperCase(),
        opCode: mapping.op_code ? (row[mapping.op_code] || "").trim().toUpperCase() : "",
        description: mapping.description ? (row[mapping.description] || "").trim() : "",
        laborSaleCents,
        laborHoursHundredths,
        partsSaleCents,
        partsCostCents,
        roTotalCents,
        vin: mapping.vin ? (row[mapping.vin] || "").trim() : "",
        oemBrand: mapping.oem_brand ? (row[mapping.oem_brand] || "").trim() : "",
        customerType: mapping.customer_type ? (row[mapping.customer_type] || "").trim().toUpperCase() : "",
        oemScheduleCostCents,
        isAftermarket: mapping.is_aftermarket ? parseBool(row[mapping.is_aftermarket]) : false,
      };
    });

    return {
      ...vendorInfo,
      rawHeaders,
      mappedHeaders: mapping,
      lines,
    };
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function evaluateLineExclusion(state, line) {
    const statute = STATUTES[state];
    const pt = (line.payType || "").trim().toUpperCase();
    const oc = (line.opCode || "").trim().toUpperCase();
    const desc = (line.description || "").trim().toLowerCase();
    const ct = (line.customerType || "").trim().toUpperCase();

    for (const rule of statute.exclusionRules) {
      if (rule.excludeIfAftermarket && line.isAftermarket) return rule;
      if (pt && rule.payTypes.includes(pt)) return rule;
      if (ct && rule.customerTypes.includes(ct)) return rule;
      if (oc && rule.opPrefixes.some((p) => {
        if (!oc.startsWith(p)) return false;
        if (rule.category === "warranty_recall" && p === "REC" && oc.startsWith("RECON")) return false;
        return true;
      })) return rule;
      if (desc) {
        for (const kw of rule.keywords) {
          const re = new RegExp(`\\b${escapeRegex(kw)}\\b`, "i");
          if (re.test(desc)) return rule;
        }
      }
    }

    const validCustomerPay = ["C", "CP", "CUST", "CUSTOMER", "CUSTOMER PAY", "CUSTOMER_PAY", "RETAIL", "R"];
    if (pt && !validCustomerPay.includes(pt)) {
      return {
        category: "non_customer_pay",
        subsection: statute.citation,
        reason: `Non-customer-pay billing code '${pt}'`,
      };
    }
    return null;
  }

  // =========================================================================
  // 5. STATUTORY PRE-SCREEN ENGINE (EXACT $0.00 PARITY WITH engine/prescreen.py)
  // =========================================================================
  const FL_HIGH_SCALE = 10n ** 24n; // High-precision BigInt scale matching Python 28-digit Decimal

  function prevYearMonth(year, month, steps = 1) {
    const total = year * 12 + (month - 1) - steps;
    return [Math.floor(total / 12), (total % 12) + 1];
  }

  function ymKey(year, month) {
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  function compareTuples(a, b) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] < b[i]) return -1;
      if (a[i] > b[i]) return 1;
    }
    return 0;
  }

  // Matches Python max(items, key=keyFn): returns first item achieving maximum tuple
  function maxByTuple(items, keyFn) {
    if (!items.length) return null;
    let best = items[0];
    let bestKey = keyFn(best);
    for (let i = 1; i < items.length; i++) {
      const k = keyFn(items[i]);
      if (compareTuples(k, bestKey) > 0) {
        best = items[i];
        bestKey = k;
      }
    }
    return best;
  }

  function calcWindowMetrics(windowRos) {
    let laborSale = 0n;
    let laborHours = 0n;
    let partsSale = 0n;
    let partsCost = 0n;
    let qRoCount = 0;
    let qLaborCount = 0;
    let qPartsCount = 0;

    for (const r of windowRos) {
      laborSale += r.qualLaborSaleCents;
      laborHours += r.qualLaborHoursHundredths;
      partsSale += r.qualPartsSaleCents;
      partsCost += r.qualPartsCostCents;
      if (r.isQualifiedRo) qRoCount++;
      if (r.isQualifiedLabor) qLaborCount++;
      if (r.isQualifiedParts) qPartsCount++;
    }

    // laborSale (cents) / laborHours (0.01 hrs) -> * 100 gives cents/hr
    const laborRateCents = laborHours > 0n ? divRoundHalfUp(laborSale * 100n, laborHours) : 0n;
    // ((partsSale - partsCost) / partsCost) * 100 rounded to 0.01% -> bp (* 10000)
    const partsMarkupBp = partsCost > 0n ? divRoundHalfUp((partsSale - partsCost) * 10000n, partsCost) : 0n;

    return {
      totalRos: windowRos.length,
      qualifiedRos: qRoCount,
      qualifiedLaborRos: qLaborCount,
      qualifiedPartsRos: qPartsCount,
      retainedNonqualifiedRos: windowRos.length - qRoCount,
      startRo: windowRos.length ? windowRos[0].roNumber : null,
      endRo: windowRos.length ? windowRos[windowRos.length - 1].roNumber : null,
      startDate: windowRos.length ? windowRos[0].closeDate : null,
      endDate: windowRos.length ? windowRos[windowRos.length - 1].closeDate : null,
      laborSaleCents: laborSale,
      laborHoursHundredths: laborHours,
      laborRateCents,
      partsSaleCents: partsSale,
      partsCostCents: partsCost,
      partsMarkupBp,
    };
  }

  function find100qCandidates(ros, qualProp = "isQualifiedRo", targetCount = 100) {
    const n = ros.length;
    const candidates = [];
    let j = 0;
    let qCount = 0;
    for (let i = 0; i < n; i++) {
      if (!ros[i][qualProp]) continue;
      if (j < i) {
        j = i;
        qCount = 0;
      }
      while (j < n && qCount < targetCount) {
        if (ros[j][qualProp]) qCount++;
        j++;
      }
      if (qCount === targetCount) {
        const m = calcWindowMetrics(ros.slice(i, j));
        m.method = `${targetCount}_sequential_qualified_ros`;
        m.kind = "100_RO";
        m.startIdx = i;
        m.endIdx = j - 1;
        candidates.push(m);
      }
      if (ros[i][qualProp]) qCount--;
    }
    return candidates;
  }

  function find90dCandidates(ros, days = 90) {
    if (!ros.length) return [];
    const n = ros.length;
    const maxDay = ros[n - 1].dayNum;
    const minDay = ros[0].dayNum;

    // Fallback only if the entire CSV spans less than a full 90-day period
    if (maxDay - minDay < days - 1) {
      if (ros.some((r) => r.isQualifiedRo)) {
        const m = calcWindowMetrics(ros);
        m.method = `${days}_consecutive_days`;
        m.kind = "90_DAY";
        m.startIdx = 0;
        m.endIdx = n - 1;
        return [m];
      }
      return [];
    }

    const candidates = [];
    const seenDates = new Set();
    let j = 0;
    for (let i = 0; i < n; i++) {
      const startDay = ros[i].dayNum;
      if (seenDates.has(startDay)) continue;
      seenDates.add(startDay);
      const endDay = startDay + days - 1;
      if (endDay > maxDay) {
        // Complete 90-day window does not fit inside available data; stop scanning tail
        break;
      }
      if (j < i) j = i;
      while (j < n && ros[j].dayNum <= endDay) j++;
      const slice = ros.slice(i, j);
      if (slice.some((r) => r.isQualifiedRo)) {
        const m = calcWindowMetrics(slice);
        m.method = `${days}_consecutive_days`;
        m.kind = "90_DAY";
        m.startIdx = i;
        m.endIdx = j - 1;
        candidates.push(m);
      }
    }
    return candidates;
  }

  // Exact match to prescreen.py _fl_arithmetic_mean_markup (full precision per-RO before mean q2)
  function flArithmeticMeanMarkupBp(partsRos) {
    if (!partsRos.length) return 0n;
    let totalScaledPct = 0n;
    for (const r of partsRos) {
      // ro_pct = ((sale - cost) / cost) * 100 at FL_HIGH_SCALE
      const roPctScaled = divRoundHalfUp((r.qualPartsSaleCents - r.qualPartsCostCents) * 100n * FL_HIGH_SCALE, r.qualPartsCostCents);
      totalScaledPct += roPctScaled;
    }
    // Convert mean to hundredths of a percent (bp = * 100)
    return divRoundHalfUp(totalScaledPct * 100n, BigInt(partsRos.length) * FL_HIGH_SCALE);
  }

  function decimalMedianBp(valuesBp) {
    if (!valuesBp.length) return 0n;
    const ordered = [...valuesBp].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const n = ordered.length;
    const mid = Math.floor(n / 2);
    if (n % 2 === 1) return ordered[mid];
    return divRoundHalfUp(ordered[mid - 1] + ordered[mid], 2n);
  }

  function runPrescreen({
    state,
    csvText,
    currentLaborRateCents,
    currentPartsMarkupBp, // e.g., 4000n = 40.00%
    annualWarrantyHoursHundredths, // e.g., 1200000n = 12000.00 hrs
    annualWarrantyPartsCostCents,
    ohAnnualZeroCostPartsCostCents = 0n,
    flGpPct2MoRaw = null, // exact string/number e.g. "76.50" or "0.765"
    flAvgTechWage1MoCents = null,
    slidingWindow = null,
  }) {
    const t0 = performance.now();
    const statute = STATUTES[state];
    if (!statute) throw new Error(`Unsupported state: ${state}. Verified states: TX, CA, OH, FL.`);

    if (state === "FL" && slidingWindow === true) {
      throw new Error(
        "HARD BLOCK — Fla. Stat. § 320.696 strictly prohibits sliding-window optimization in Florida. Use fixed monthly labor options (§ 320.696(4)(b)1 vs (4)(b)2) and 10-day OEM-selected 50-RO parts notice (§ 320.696(3))."
      );
    }

    const normalized = normalizeCsvText(csvText);

    // Group lines by RO preserving insertion order
    const roMap = new Map();
    const roOrder = [];
    for (const line of normalized.lines) {
      if (!roMap.has(line.roNumber)) {
        roMap.set(line.roNumber, []);
        roOrder.push(line.roNumber);
      }
      roMap.get(line.roNumber).push(line);
    }

    const allRos = [];
    const excludedLines = [];

    for (const roNum of roOrder) {
      const roLines = roMap.get(roNum);
      const rawEvals = roLines.map((ln) => evaluateLineExclusion(state, ln));
      const hasQualifiedRepairOnRo = rawEvals.some((r) => r === null);

      const agg = {
        roNumber: roNum,
        roNumeric: roLines[0].roNumeric,
        closeDate: roLines[0].closeDate,
        dayNum: isoToDayNum(roLines[0].closeDate),
        qualLaborSaleCents: 0n,
        qualLaborHoursHundredths: 0n,
        qualPartsSaleCents: 0n,
        qualPartsCostCents: 0n,
        ohZeroCostScheduleTotalCents: 0n,
        isQualifiedLabor: false,
        isQualifiedParts: false,
        isQualifiedRo: false,
      };

      for (let i = 0; i < roLines.length; i++) {
        const ln = roLines[i];
        const rule = rawEvals[i];

        const isOhZeroCost =
          state === "OH" && rule !== null && rule.category === "warranty_recall" && ln.oemScheduleCostCents > 0n;
        if (isOhZeroCost) {
          agg.ohZeroCostScheduleTotalCents += ln.oemScheduleCostCents;
        }

        const caPaired =
          state === "CA" && rule !== null && Boolean(rule.allowIfPairedWithQualified) && hasQualifiedRepairOnRo;

        if (rule === null || caPaired) {
          agg.qualLaborSaleCents += ln.laborSaleCents;
          agg.qualLaborHoursHundredths += ln.laborHoursHundredths;
          agg.qualPartsSaleCents += ln.partsSaleCents;
          agg.qualPartsCostCents += ln.partsCostCents;
        } else {
          excludedLines.push({
            roNumber: ln.roNumber,
            closeDate: ln.closeDate,
            payType: ln.payType,
            opCode: ln.opCode || "—",
            description: ln.description || "—",
            laborSaleCents: ln.laborSaleCents,
            laborHoursHundredths: ln.laborHoursHundredths,
            partsSaleCents: ln.partsSaleCents,
            partsCostCents: ln.partsCostCents,
            oemScheduleCostCents: ln.oemScheduleCostCents,
            subsection: rule.subsection,
            reason: rule.reason,
            category: rule.category,
            ohZeroCostRecallFlagged: isOhZeroCost,
          });
        }
      }

      agg.isQualifiedLabor = agg.qualLaborHoursHundredths > 0n && agg.qualLaborSaleCents > 0n;
      agg.isQualifiedParts = agg.qualPartsCostCents > 0n;
      agg.isQualifiedRo = agg.isQualifiedLabor || agg.isQualifiedParts;
      allRos.push(agg);
    }

    // Exact Python sort key: (close_date, ro_numeric if not None else 0, ro_number)
    allRos.sort((a, b) => {
      if (a.dayNum !== b.dayNum) return a.dayNum - b.dayNum;
      const na = a.roNumeric !== null ? a.roNumeric : 0;
      const nb = b.roNumeric !== null ? b.roNumeric : 0;
      if (na !== nb) return na - nb;
      return a.roNumber < b.roNumber ? -1 : a.roNumber > b.roNumber ? 1 : 0;
    });

    // RO sequence gap check (exact match to detect_ro_sequence_gaps)
    const numberedMap = new Map();
    for (const r of allRos) {
      if (r.roNumeric !== null && !numberedMap.has(r.roNumeric)) {
        numberedMap.set(r.roNumeric, r.roNumber);
      }
    }
    const numbered = Array.from(numberedMap.entries()).sort((a, b) => a[0] - b[0]);
    const sequenceGaps = [];
    let totalMissingRoNumbers = 0;
    for (let i = 1; i < numbered.length; i++) {
      const [prevNum, prevRo] = numbered[i - 1];
      const [currNum, currRo] = numbered[i];
      if (currNum - prevNum > 1) {
        const missingCount = currNum - prevNum - 1;
        totalMissingRoNumbers += missingCount;
        sequenceGaps.push({
          from: prevRo,
          to: currRo,
          missingStartNumeric: prevNum + 1,
          missingEndNumeric: currNum - 1,
          missingCount,
        });
      }
    }

    const latestDay = allRos.reduce((m, r) => (r.dayNum > m ? r.dayNum : m), allRos[0].dayNum);
    const latestRo = allRos.reduce((best, r) => (r.dayNum > best.dayNum ? r : best), allRos[0]);
    const lookbackCutoffDay = latestDay - statute.lookbackDays;
    const lookbackRos =
      state === "FL" ? allRos : allRos.filter((r) => r.dayNum >= lookbackCutoffDay && r.dayNum <= latestDay);

    let qualifiedLaborRateCents = 0n;
    let qualifiedPartsMarkupBp = 0n;
    let ohZeroCostUpliftCents = 0n;
    let selectedWindowLabel = "";
    let methodSummary = {};

    if (state === "TX") {
      const cands100 = find100qCandidates(lookbackRos, "isQualifiedRo", 100);
      const cands90 = find90dCandidates(lookbackRos, 90);
      const best100 = maxByTuple(cands100, (w) => [w.laborRateCents, w.partsMarkupBp]);
      const best90 = maxByTuple(cands90, (w) => [w.laborRateCents, w.partsMarkupBp]);

      let winner;
      if (best100 && best90) {
        winner = best100.laborRateCents >= best90.laborRateCents ? best100 : best90;
      } else {
        winner = best100 || best90;
      }
      if (!winner) throw new Error("No qualified non-warranty ROs found within TX 6-month lookback window.");

      qualifiedLaborRateCents = winner.laborRateCents;
      qualifiedPartsMarkupBp = winner.partsMarkupBp;
      selectedWindowLabel = `${winner.kind === "100_RO" ? "100 Sequential Qualified ROs" : "90 Consecutive Days"} (${winner.startRo} – ${winner.endRo}, ${winner.startDate} to ${winner.endDate})`;
      methodSummary = {
        mode: "SLIDING_COMBINED",
        best100,
        best90,
        chosenKind: winner.kind,
        ruleNote:
          "Tex. Occ. Code § 2301.402 selects the greater labor rate between 100 sequential non-warranty ROs and 90 consecutive days within the prior 6 months (excluding routine maintenance).",
      };
    } else if (state === "CA") {
      const n = lookbackRos.length;
      if (n === 0 || !lookbackRos.some((r) => r.isQualifiedRo)) {
        throw new Error("No qualified ROs found within CA 180-day lookback window.");
      }
      const cands100All = find100qCandidates(lookbackRos, "isQualifiedRo", 100);
      const cands90All = find90dCandidates(lookbackRos, 90);
      const c100ByStart = new Map(cands100All.map((c) => [c.startIdx, c]));
      const maxDay = lookbackRos[n - 1].dayNum;

      const mandated = [];
      for (let i = 0; i < n; i++) {
        const startDay = lookbackRos[i].dayNum;
        const endDay = startDay + 89;
        let j = i;
        while (j < n && lookbackRos[j].dayNum <= endDay) j++;
        const slice90 = lookbackRos.slice(i, j);
        if (!slice90.some((r) => r.isQualifiedRo)) continue;
        const m90 = calcWindowMetrics(slice90);
        m90.method = "90_consecutive_days";
        m90.kind = "90_DAY";
        m90.startIdx = i;
        m90.endIdx = j - 1;

        const m100 = c100ByStart.get(i) || null;
        const full90Available = endDay <= maxDay;
        const isDayStart = i === 0 || lookbackRos[i - 1].dayNum !== startDay;

        if (m100 && full90Available) {
          if (m100.totalRos <= m90.totalRos) {
            mandated.push({ win: m100, counterpart: m90 });
          } else if (m90.qualifiedRos < 100 && isDayStart) {
            mandated.push({ win: m90, counterpart: m100 });
          } else {
            mandated.push({ win: m100, counterpart: m90 });
          }
        } else if (m100 && !full90Available) {
          if (m100.totalRos <= m90.totalRos) mandated.push({ win: m100, counterpart: m90 });
        } else if (full90Available && m90.qualifiedRos < 100 && isDayStart) {
          mandated.push({ win: m90, counterpart: null });
        }
      }

      if (!mandated.length) {
        const fb = calcWindowMetrics(lookbackRos);
        fb.method = "90_consecutive_days";
        fb.kind = "90_DAY";
        mandated.push({ win: fb, counterpart: null });
      }

      const bestPair = maxByTuple(mandated, ({ win }) => {
        const lDelta = win.laborRateCents > currentLaborRateCents ? win.laborRateCents - currentLaborRateCents : 0n;
        const pDelta = win.partsMarkupBp > currentPartsMarkupBp ? win.partsMarkupBp - currentPartsMarkupBp : 0n;
        const proj =
          divRoundHalfUp(lDelta * annualWarrantyHoursHundredths, 100n) +
          divRoundHalfUp(annualWarrantyPartsCostCents * pDelta, 10000n);
        return [proj, win.laborRateCents, win.partsMarkupBp];
      });

      const winner = bestPair.win;
      const best100Overall = maxByTuple(cands100All, (w) => [w.laborRateCents, w.partsMarkupBp]);
      const best90Overall = maxByTuple(cands90All, (w) => [w.laborRateCents, w.partsMarkupBp]);

      qualifiedLaborRateCents = winner.laborRateCents;
      qualifiedPartsMarkupBp = winner.partsMarkupBp;
      selectedWindowLabel = `${winner.kind === "100_RO" ? "100 Sequential Qualified ROs" : "90 Consecutive Days"} (${winner.startRo} – ${winner.endRo}, ${winner.totalRos} total ROs: ${winner.qualifiedRos} qualified + ${winner.retainedNonqualifiedRos} retained nonqualified)`;
      methodSummary = {
        mode: "SLIDING_COMBINED",
        best100: winner.kind === "100_RO" ? winner : bestPair.counterpart || best100Overall,
        best90: winner.kind === "90_DAY" ? winner : bestPair.counterpart || best90Overall,
        chosenKind: winner.kind,
        ruleNote:
          "Cal. Veh. Code § 3065.2(a)(1) mandates whichever set has fewer total ROs from the same start: 100 sequential qualified ROs (retaining nonqualified ROs in sequence, excluded from math) vs 90 consecutive days.",
      };
    } else if (state === "OH") {
      const labor100 = find100qCandidates(lookbackRos, "isQualifiedLabor", 100);
      const parts100 = find100qCandidates(lookbackRos, "isQualifiedParts", 100);
      const cands90 = find90dCandidates(lookbackRos, 90);

      const laborPool = [...labor100, ...cands90.filter((c) => c.qualifiedLaborRos > 0)];
      const partsPool = [...parts100, ...cands90.filter((c) => c.qualifiedPartsRos > 0)];

      if (!laborPool.length) throw new Error("No qualified customer-pay labor ROs found within OH 180-day lookback window.");
      if (!partsPool.length) throw new Error("No qualified customer-pay parts ROs found within OH 180-day lookback window.");

      const bestLabor = maxByTuple(laborPool, (w) => [w.laborRateCents, BigInt(w.qualifiedLaborRos)]);
      const bestParts = maxByTuple(partsPool, (w) => [w.partsMarkupBp, BigInt(w.qualifiedPartsRos)]);

      qualifiedLaborRateCents = bestLabor.laborRateCents;
      qualifiedPartsMarkupBp = bestParts.partsMarkupBp;
      ohZeroCostUpliftCents = divRoundHalfUp(ohAnnualZeroCostPartsCostCents * qualifiedPartsMarkupBp, 10000n);

      const csvRecallScheduleCostCents = allRos.reduce((acc, r) => acc + r.ohZeroCostScheduleTotalCents, 0n);
      const separateUsed = bestLabor.startRo !== bestParts.startRo || bestLabor.endRo !== bestParts.endRo;

      selectedWindowLabel = `OH ${separateUsed ? "Separate" : "Same"} Sets — Labor (${bestLabor.kind === "100_RO" ? "100-RO" : "90-Day"}: ${bestLabor.startRo}–${bestLabor.endRo}) & Parts (${bestParts.kind === "100_RO" ? "100-RO" : "90-Day"}: ${bestParts.startRo}–${bestParts.endRo})`;
      methodSummary = {
        mode: "SLIDING_SEPARATE_OH",
        bestLaborWin: bestLabor,
        bestPartsWin: bestParts,
        separateUsed,
        csvRecallScheduleCostCents,
        ruleNote:
          "Ohio Rev. Code § 4517.52 allows 100 sequential qualified ROs or 90 consecutive days (same or separate sets for labor & parts), plus full retail markup % on zero-cost/reduced-cost OEM recall & warranty parts.",
      };
    } else {
      // FL: STRICTLY NO SLIDING WINDOW OPTIMIZATION!
      const [latestY, latestM] = latestRo.closeDate.split("-").map(Number);
      const prior1MoKey = ymKey(latestY, latestM);
      const [m1Y, m1M] = prevYearMonth(latestY, latestM, 1);
      const [m2Y, m2M] = prevYearMonth(latestY, latestM, 2);
      const prior3MoKeys = new Set([prior1MoKey, ymKey(m1Y, m1M), ymKey(m2Y, m2M)]);

      const prior1MoRos = allRos.filter((r) => r.closeDate.slice(0, 7) === prior1MoKey);
      const prior3MoRos = allRos.filter((r) => prior3MoKeys.has(r.closeDate.slice(0, 7)));

      if (!prior1MoRos.length) {
        throw new Error(`No ROs found for FL prior 1 calendar month (${prior1MoKey}).`);
      }

      // Option 1: § 320.696(4)(b)1
      const opt1Metrics = calcWindowMetrics(prior1MoRos);
      const opt1LaborCents = opt1Metrics.laborRateCents;

      // Option 2: § 320.696(4)(b)2 -> wage / (1 - gp_ratio)
      let opt2LaborCents = null;
      let gpPctBpDisplay = 0n;
      if (flGpPct2MoRaw !== null && String(flGpPct2MoRaw).trim() !== "" && flAvgTechWage1MoCents !== null && flAvgTechWage1MoCents > 0n) {
        // Parse at 6 decimals to support inputs like "76.5", "76.50", or "0.765" identically to Python Decimal
        const rawValScaled6 = parseScaled(flGpPct2MoRaw, 6);
        const gpRatioScaled8 = rawValScaled6 > 1000000n ? rawValScaled6 : rawValScaled6 * 100n; // ratio * 10^8
        const denomScaled8 = 100000000n - gpRatioScaled8;
        if (gpRatioScaled8 > 0n && denomScaled8 > 0n) {
          opt2LaborCents = divRoundHalfUp(flAvgTechWage1MoCents * 100000000n, denomScaled8);
          gpPctBpDisplay = divRoundHalfUp(gpRatioScaled8, 10000n);
        }
      }

      const opt2Wins = opt2LaborCents !== null && opt2LaborCents > opt1LaborCents;
      qualifiedLaborRateCents = opt2Wins ? opt2LaborCents : opt1LaborCents;
      const laborWinner = opt2Wins ? "Option 2 (§ 320.696(4)(b)2)" : "Option 1 (§ 320.696(4)(b)1)";

      // Parts (§ 320.696(3)): Arithmetical mean markup across 50 consecutive qualifying retail parts repairs in prior 3 calendar months
      // Strictly OEM starting-RO compliance exposure ONLY (NOT dealer selection!)
      const qualParts3Mo = prior3MoRos.filter((r) => r.isQualifiedParts);
      const full3MoMeanBp = flArithmeticMeanMarkupBp(qualParts3Mo);
      const sliceObjects = [];
      if (qualParts3Mo.length >= 50) {
        for (let i = 0; i <= qualParts3Mo.length - 50; i++) {
          sliceObjects.push({
            startRo: qualParts3Mo[i].roNumber,
            endRo: qualParts3Mo[i + 49].roNumber,
            meanBp: flArithmeticMeanMarkupBp(qualParts3Mo.slice(i, i + 50)),
          });
        }
      }

      let minSlice;
      let maxSlice;
      let medianBp;
      if (sliceObjects.length) {
        const sortedSlices = [...sliceObjects].sort((a, b) => (a.meanBp < b.meanBp ? -1 : a.meanBp > b.meanBp ? 1 : 0));
        minSlice = sortedSlices[0];
        maxSlice = sortedSlices[sortedSlices.length - 1];
        medianBp = decimalMedianBp(sliceObjects.map((s) => s.meanBp));
      } else {
        minSlice = { startRo: qualParts3Mo[0]?.roNumber || "—", endRo: qualParts3Mo[qualParts3Mo.length - 1]?.roNumber || "—", meanBp: full3MoMeanBp };
        maxSlice = minSlice;
        medianBp = full3MoMeanBp;
      }

      qualifiedPartsMarkupBp = medianBp;
      selectedWindowLabel = `NO SLIDING WINDOW — FL Fixed Monthly Labor (${laborWinner}) + 50-RO OEM Starting-RO Median Exposure`;

      methodSummary = {
        mode: "FL_COMPLIANCE",
        priorMonthLabel: prior1MoKey,
        prior3Months: Array.from(prior3MoKeys).sort(),
        opt1LaborCents,
        opt1Metrics,
        opt2LaborCents: opt2LaborCents ?? 0n,
        flGpPct2MoBp: gpPctBpDisplay,
        flAvgTechWage1MoCents: flAvgTechWage1MoCents ?? 0n,
        laborWinner,
        qualPartsRoCount: qualParts3Mo.length,
        sliceCount: sliceObjects.length,
        full3MoMeanBp,
        minSlice,
        medianBp,
        maxSlice,
      };
    }

    const laborDeltaCents = qualifiedLaborRateCents > currentLaborRateCents ? qualifiedLaborRateCents - currentLaborRateCents : 0n;
    const partsDeltaBp = qualifiedPartsMarkupBp > currentPartsMarkupBp ? qualifiedPartsMarkupBp - currentPartsMarkupBp : 0n;

    const laborUpliftCents = divRoundHalfUp(laborDeltaCents * annualWarrantyHoursHundredths, 100n);
    const partsUpliftCents = divRoundHalfUp(annualWarrantyPartsCostCents * partsDeltaBp, 10000n);
    const totalUpliftCents = laborUpliftCents + partsUpliftCents + ohZeroCostUpliftCents;
    const qualifies50k = totalUpliftCents >= CONFIG.THRESHOLD_UPLIFT_CENTS;

    // Competitor cost comparison
    const flatFee = CONFIG.FLAT_FEE_CENTS;
    const fpSingle = 450000n;
    const fpBoth = 900000n;
    const cont15 = divRoundHalfUp(totalUpliftCents * 15n, 100n);
    const cont30 = divRoundHalfUp(totalUpliftCents * 30n, 100n);
    const saasLow = 598800n;
    const saasHigh = 958800n;
    const roiMultipleTenths = totalUpliftCents > 0n ? divRoundHalfUp(totalUpliftCents * 10n, flatFee) : 0n;

    const runtimeMs = Math.max(1, Math.round(performance.now() - t0));

    return {
      state,
      statute,
      dmsVendor: normalized.dmsVendor,
      cdkDetected: normalized.cdkDetected,
      cdkWarning: normalized.cdkWarning,
      totalLines: normalized.lines.length,
      totalRos: allRos.length,
      qualifiedRos: allRos.filter((r) => r.isQualifiedRo).length,
      excludedLines,
      sequenceGaps,
      totalMissingRoNumbers,
      qualifiedLaborRateCents,
      qualifiedPartsMarkupBp,
      currentLaborRateCents,
      currentPartsMarkupBp,
      annualWarrantyHoursHundredths,
      annualWarrantyPartsCostCents,
      ohAnnualZeroCostPartsCostCents: state === "OH" ? ohAnnualZeroCostPartsCostCents : 0n,
      uplift: {
        laborDeltaCents,
        partsDeltaBp,
        laborUpliftCents,
        partsUpliftCents,
        ohRecallUpliftCents: ohZeroCostUpliftCents,
        totalUpliftCents,
      },
      qualifies50k,
      selectedWindowLabel,
      methodSummary,
      competitors: {
        flatFee,
        fpSingle,
        fpBoth,
        cont15,
        cont30,
        saasLow,
        saasHigh,
        roiMultiple: `${(Number(roiMultipleTenths) / 10).toFixed(1)}x`,
      },
      runtimeMs,
    };
  }

  // =========================================================================
  // 6. UI STATE & DOM CONTROLLER
  // =========================================================================
  const appState = {
    state: "TX",
    datasetLabel: "",
    csvText: "",
    lastResult: null,
    reconMode: "pass",
    exclusionFilter: "",
  };

  const els = {
    stateTabs: document.querySelectorAll(".state-tab"),
    statuteCard: document.getElementById("statute-card"),
    demoBtns: document.querySelectorAll(".demo-btn"),
    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("csv-file-input"),
    dmsPill: document.getElementById("dms-detected-pill"),
    cdkBanner: document.getElementById("cdk-warning-banner"),
    csvErrorBanner: document.getElementById("csv-error-banner"),
    heroDemoBtn: document.getElementById("hero-demo-btn"),
    resetDefaultsBtn: document.getElementById("reset-defaults-btn"),

    inputCurrentLabor: document.getElementById("input-current-labor"),
    inputCurrentMarkup: document.getElementById("input-current-markup"),
    inputAnnualHours: document.getElementById("input-annual-hours"),
    inputAnnualPartsCost: document.getElementById("input-annual-parts-cost"),
    inputOhZeroCost: document.getElementById("input-oh-zero-cost"),
    inputFlGpPct: document.getElementById("input-fl-gp-pct"),
    inputFlTechWage: document.getElementById("input-fl-tech-wage"),

    fieldOhZeroCost: document.getElementById("field-oh-zero-cost"),
    fieldFlGpPct: document.getElementById("field-fl-gp-pct"),
    fieldFlTechWage: document.getElementById("field-fl-tech-wage"),
    runtimePill: document.getElementById("runtime-pill"),

    verdictBanner: document.getElementById("verdict-banner"),
    verdictBadge: document.getElementById("verdict-badge"),
    verdictStateTag: document.getElementById("verdict-state-tag"),
    verdictDatasetTag: document.getElementById("verdict-dataset-tag"),
    verdictHeadline: document.getElementById("verdict-headline"),
    verdictSubtext: document.getElementById("verdict-subtext"),
    verdictTotalUplift: document.getElementById("verdict-total-uplift"),

    kpiLaborRate: document.getElementById("kpi-labor-rate"),
    kpiLaborDelta: document.getElementById("kpi-labor-delta"),
    kpiPartsMarkup: document.getElementById("kpi-parts-markup"),
    kpiPartsDelta: document.getElementById("kpi-parts-delta"),
    kpiUpliftSplit: document.getElementById("kpi-uplift-split"),
    kpiUpliftBreakdown: document.getElementById("kpi-uplift-breakdown"),
    kpiRoCounts: document.getElementById("kpi-ro-counts"),
    kpiRoMeta: document.getElementById("kpi-ro-meta"),

    methodDetailPanel: document.getElementById("method-detail-panel"),
    roiMultiplePill: document.getElementById("roi-multiple-pill"),
    competitorTbody: document.getElementById("competitor-tbody"),
    exclusionSearch: document.getElementById("exclusion-search"),
    exclusionCountPill: document.getElementById("exclusion-count-pill"),
    exclusionsTbody: document.getElementById("exclusions-tbody"),

    downloadJsonBtn: document.getElementById("download-json-btn"),
    downloadTxtBtn: document.getElementById("download-txt-btn"),

    reconToggleBtns: document.querySelectorAll("[data-recon-mode]"),
    reconStatusPill: document.getElementById("recon-status-pill"),
    reconSummaryText: document.getElementById("recon-summary-text"),
    reconTbody: document.getElementById("recon-tbody"),
    reconAlertBox: document.getElementById("recon-alert-box"),

    reqDealerName: document.getElementById("req-dealer-name"),
    reqBrand: document.getElementById("req-brand"),
    reqState: document.getElementById("req-state"),
    reqDms: document.getElementById("req-dms"),
    reqContactName: document.getElementById("req-contact-name"),
    reqEmail: document.getElementById("req-email"),
    reqNotes: document.getElementById("req-notes"),
    mailtoBtn: document.getElementById("mailto-btn"),
    downloadIntakeBtn: document.getElementById("download-intake-btn"),
    copyIntakeBtn: document.getElementById("copy-intake-btn"),
    bookingFeedback: document.getElementById("booking-feedback"),
    intakePreviewBox: document.getElementById("intake-preview-box"),
    contactEmailPill: document.getElementById("contact-email-pill"),
  };

  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderStatuteCard(state) {
    const s = STATUTES[state];
    const isFL = state === "FL";
    els.statuteCard.className = `statute-card${isFL ? " statute-card-fl" : ""}`;
    els.statuteCard.innerHTML = `
      <div class="statute-header">
        <h4>${escHtml(s.stateName)} — <span class="mono">${escHtml(s.citation)}</span></h4>
        <span class="pill ${isFL ? "pill-amber" : "pill-green"}">${escHtml(s.modeBadge)}</span>
      </div>
      <div class="statute-grid">
        <div class="statute-cell">
          <strong>Sampling &amp; Window Rule</strong>
          <span>${escHtml(s.samplingSummary)}</span>
        </div>
        <div class="statute-cell">
          <strong>Labor &amp; Parts Calculation</strong>
          <span>${escHtml(s.laborRule)} ${escHtml(s.partsRule)}</span>
        </div>
        <div class="statute-cell">
          <strong>Frequency &amp; OEM Deadline</strong>
          <span>${escHtml(s.frequencyCap)}. ${escHtml(s.oemDeadline)}</span>
        </div>
      </div>
      ${
        isFL
          ? `<div class="fl-compliance-callout">
              <strong>Florida Strict Compliance Notice (Fla. Stat. § 320.696):</strong>
              Florida NEVER uses dealer sliding-window selection. This workbench runs a <strong>Statutory Compliance Scrub + Dual Fixed Monthly Labor Comparison + 10-Day OEM Notice &amp; 50-RO Sensitivity Scrub</strong>. Because the OEM selects the starting RO after 10-day written notice, the 50-RO min/median/max spread is strictly compliance exposure—never dealer cherry-picking.
            </div>`
          : ""
      }
    `;
  }

  function toggleStateInputs(state) {
    els.fieldOhZeroCost.classList.toggle("hidden", state !== "OH");
    els.fieldFlGpPct.classList.toggle("hidden", state !== "FL");
    els.fieldFlTechWage.classList.toggle("hidden", state !== "FL");
  }

  function applyStateDefaults(state) {
    const sample = window.RETAILRATE_SAMPLES && window.RETAILRATE_SAMPLES[state];
    if (!sample || !sample.defaults) return;
    const d = sample.defaults;
    els.inputCurrentLabor.value = d.currentLaborRate;
    els.inputCurrentMarkup.value = d.currentPartsMarkup;
    els.inputAnnualHours.value = d.annualWarrantyHours;
    els.inputAnnualPartsCost.value = d.annualWarrantyPartsCost;
    if (d.ohAnnualZeroCostPartsCost !== undefined) {
      els.inputOhZeroCost.value = d.ohAnnualZeroCostPartsCost;
    }
    if (d.flGpPct2Mo !== undefined) {
      els.inputFlGpPct.value = d.flGpPct2Mo;
    }
    if (d.flAvgTechWage1Mo !== undefined) {
      els.inputFlTechWage.value = d.flAvgTechWage1Mo;
    }
  }

  function loadSample(state) {
    const sample = window.RETAILRATE_SAMPLES && window.RETAILRATE_SAMPLES[state];
    if (!sample) return;
    appState.state = state;
    appState.csvText = sample.csv;
    appState.datasetLabel = sample.label;

    els.stateTabs.forEach((btn) => {
      const active = btn.dataset.state === state;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    els.demoBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.demo === state);
    });

    renderStatuteCard(state);
    toggleStateInputs(state);
    applyStateDefaults(state);
    els.reqState.value = state;
    recompute();
  }

  function switchStateOnly(state) {
    appState.state = state;
    els.stateTabs.forEach((btn) => {
      const active = btn.dataset.state === state;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    renderStatuteCard(state);
    toggleStateInputs(state);
    els.reqState.value = state;

    // If current dataset was a demo from another state, load the matching state's demo so inputs stay coherent
    const isDemoLoaded = Object.values(window.RETAILRATE_SAMPLES || {}).some((s) => s.label === appState.datasetLabel);
    if (isDemoLoaded || !appState.csvText) {
      loadSample(state);
    } else {
      recompute();
    }
  }

  function recompute() {
    els.csvErrorBanner.classList.add("hidden");
    if (!appState.csvText) return;

    try {
      const result = runPrescreen({
        state: appState.state,
        csvText: appState.csvText,
        currentLaborRateCents: parseScaled(els.inputCurrentLabor.value || "0", 2),
        currentPartsMarkupBp: parseScaled(els.inputCurrentMarkup.value || "0", 2),
        annualWarrantyHoursHundredths: parseScaled(els.inputAnnualHours.value || "0", 2),
        annualWarrantyPartsCostCents: parseScaled(els.inputAnnualPartsCost.value || "0", 2),
        ohAnnualZeroCostPartsCostCents: parseScaled(els.inputOhZeroCost.value || "0", 2),
        flGpPct2MoRaw: els.inputFlGpPct.value || null,
        flAvgTechWage1MoCents: els.inputFlTechWage.value ? parseScaled(els.inputFlTechWage.value, 2) : null,
      });
      appState.lastResult = result;
      renderResult(result);
      updateBookingPreview();
    } catch (err) {
      els.csvErrorBanner.textContent = `CSV Parse / Calculation Error: ${err.message}`;
      els.csvErrorBanner.classList.remove("hidden");
    }
  }

  function renderResult(r) {
    els.dmsPill.textContent = `DMS: ${r.dmsVendor}`;
    els.dmsPill.className = `pill ${r.cdkDetected ? "pill-amber" : "pill-green"}`;
    els.cdkBanner.classList.toggle("hidden", !r.cdkDetected);
    els.runtimePill.textContent = `Runtime: ${r.runtimeMs} ms (< 15,000 ms)`;

    // Sync DMS dropdown in booking form if recognized
    if (r.dmsVendor.startsWith("Reynolds")) els.reqDms.value = "Reynolds & Reynolds (ERA-IGNITE)";
    else if (r.dmsVendor === "Tekion") els.reqDms.value = "Tekion";
    else if (r.dmsVendor === "Dealertrack") els.reqDms.value = "Dealertrack";
    else if (r.dmsVendor === "CDK") els.reqDms.value = "CDK (Verification Only)";

    // Verdict banner
    els.verdictBadge.textContent = r.qualifies50k ? "QUALIFIES · $50,000+ ANNUAL UPLIFT" : "BELOW $50,000 THRESHOLD";
    els.verdictBadge.className = `verdict-badge ${r.qualifies50k ? "pass" : "below"}`;
    els.verdictStateTag.textContent = `${r.state} · ${r.statute.citation}`;
    els.verdictDatasetTag.textContent = appState.datasetLabel || r.dmsVendor;
    els.verdictTotalUplift.textContent = formatMoney(r.uplift.totalUpliftCents);
    els.verdictHeadline.textContent = r.qualifies50k
      ? `Projected ${formatMoney(r.uplift.totalUpliftCents)}/yr Statutory Warranty GP Uplift (${r.competitors.roiMultiple} ROI on $1,295 Flat Packet)`
      : `Projected ${formatMoney(r.uplift.totalUpliftCents)}/yr Warranty GP Uplift (Below $50,000 Qualification Benchmark)`;
    els.verdictSubtext.textContent = r.selectedWindowLabel;

    // KPI Cards
    els.kpiLaborRate.textContent = `${formatMoney(r.qualifiedLaborRateCents)}/hr`;
    els.kpiLaborDelta.textContent = `${formatMoney(r.uplift.laborDeltaCents, true)}/hr vs current ${formatMoney(r.currentLaborRateCents)}/hr`;

    els.kpiPartsMarkup.textContent = formatPct(r.qualifiedPartsMarkupBp);
    els.kpiPartsDelta.textContent =
      r.state === "FL"
        ? `${formatPct(r.uplift.partsDeltaBp, true)} pts vs ${formatPct(r.currentPartsMarkupBp)} (OEM-selected 50-RO median)`
        : `${formatPct(r.uplift.partsDeltaBp, true)} pts vs current ${formatPct(r.currentPartsMarkupBp)}`;

    els.kpiUpliftSplit.textContent = formatMoney(r.uplift.totalUpliftCents);
    const partsBreakdown =
      r.state === "OH"
        ? `Labor ${formatMoney(r.uplift.laborUpliftCents)} · Parts ${formatMoney(r.uplift.partsUpliftCents)} · OH Zero-Cost Recall ${formatMoney(r.uplift.ohRecallUpliftCents)}`
        : `Labor ${formatMoney(r.uplift.laborUpliftCents)} · Parts ${formatMoney(r.uplift.partsUpliftCents)}`;
    els.kpiUpliftBreakdown.textContent = partsBreakdown;

    els.kpiRoCounts.textContent = `${r.qualifiedRos} / ${r.totalRos} ROs`;
    const gapText = r.sequenceGaps.length
      ? `${r.sequenceGaps.length} sequence gap(s) flagged (retained intact)`
      : "Zero RO sequence gaps";
    els.kpiRoMeta.textContent = `${r.excludedLines.length} lines excluded · ${gapText}`;

    // Method Detail Panel
    renderMethodDetail(r);

    // Competitor Savings Table
    renderCompetitorTable(r);

    // Excluded Lines Table
    renderExclusionsTable(r);
  }

  function renderMethodDetail(r) {
    const m = r.methodSummary;
    if (m.mode === "FL_COMPLIANCE") {
      const opt1Wins = m.opt1LaborCents >= m.opt2LaborCents;
      els.methodDetailPanel.innerHTML = `
        <div class="panel-top">
          <div>
            <h3>Florida Dual Fixed Monthly Labor Comparison &amp; 50-RO OEM Sensitivity Scrub</h3>
            <p class="panel-desc">Fla. Stat. § 320.696 — Strictly NO sliding-window optimization. Dealer must issue 10-day written notice allowing the OEM to select the starting RO for parts.</p>
          </div>
          <span class="pill pill-amber">10-Day OEM Notice Required</span>
        </div>
        <div class="method-grid">
          <div class="method-box ${opt1Wins ? "winner" : ""}">
            <h4>
              <span>Labor Option 1 — § 320.696(4)(b)1 (Prior 1 Calendar Month)</span>
              ${opt1Wins ? '<span class="pill pill-green">Higher Rate</span>' : '<span class="pill pill-neutral">Lower</span>'}
            </h4>
            <div class="micro-note">Fixed month ${escHtml(m.priorMonthLabel)}: Qualifying retail labor sales ÷ qualifying labor hours</div>
            <div class="method-metrics">
              <div><small>Calculated Rate</small><strong class="mono">${formatMoney(m.opt1LaborCents)}/hr</strong></div>
              <div><small>Prior Month Qualified ROs</small><strong class="mono">${m.opt1Metrics.qualifiedRos} ROs</strong></div>
            </div>
          </div>
          <div class="method-box ${!opt1Wins ? "winner" : ""}">
            <h4>
              <span>Labor Option 2 — § 320.696(4)(b)2 (Tech Wage / 2-Mo GP%)</span>
              ${!opt1Wins ? '<span class="pill pill-green">Higher Rate</span>' : '<span class="pill pill-neutral">Lower</span>'}
            </h4>
            <div class="micro-note">Formula: ${formatMoney(m.flAvgTechWage1MoCents)}/hr ÷ (1 − ${formatPct(m.flGpPct2MoBp)})</div>
            <div class="method-metrics">
              <div><small>Calculated Rate</small><strong class="mono">${formatMoney(m.opt2LaborCents)}/hr</strong></div>
              <div><small>2-Mo Retail Labor GP%</small><strong class="mono">${formatPct(m.flGpPct2MoBp)}</strong></div>
            </div>
          </div>
        </div>
        <div class="method-box fl-warn" style="margin-top: 14px;">
          <h4>
            <span>Parts — 50-RO OEM Starting-RO Compliance Exposure (§ 320.696(3))</span>
            <span class="pill pill-amber">NOT Dealer Selection · OEM Picks Starting RO</span>
          </h4>
          <div class="micro-note">
            Evaluated across ${m.sliceCount} consecutive 50-RO slices within the prior 3 months (${m.qualPartsRoCount} qualifying retail parts ROs). Shown solely so your Fixed Ops Director understands min/median/max compliance exposure before sending the mandatory 10-day written notice to the OEM.
          </div>
          <div class="method-metrics" style="grid-template-columns: repeat(3, 1fr);">
            <div><small>Worst-Case OEM Start (Min)</small><strong class="mono">${formatPct(m.minSlice.meanBp)}</strong><small>${escHtml(m.minSlice.startRo)}–${escHtml(m.minSlice.endRo)}</small></div>
            <div><small>Median Compliance Exposure</small><strong class="mono">${formatPct(m.medianBp)}</strong><small>Used for conservative projection</small></div>
            <div><small>Best-Case OEM Start (Max)</small><strong class="mono">${formatPct(m.maxSlice.meanBp)}</strong><small>${escHtml(m.maxSlice.startRo)}–${escHtml(m.maxSlice.endRo)}</small></div>
          </div>
        </div>
      `;
      return;
    }

    if (m.mode === "SLIDING_SEPARATE_OH") {
      els.methodDetailPanel.innerHTML = `
        <div class="panel-top">
          <div>
            <h3>Ohio Statutory Window Comparison + Zero-Cost Recall Parts Uplift</h3>
            <p class="panel-desc">${escHtml(m.ruleNote)}</p>
          </div>
          <span class="pill pill-green">Separate Labor &amp; Parts Sets Permitted</span>
        </div>
        <div class="method-grid">
          <div class="method-box winner">
            <h4><span>Qualified Labor Set</span><span class="pill pill-green">${m.bestLaborWin?.kind === "100_RO" ? "100-RO Set" : "90-Day Set"}</span></h4>
            <div class="micro-note">ROs ${escHtml(m.bestLaborWin?.startRo)} – ${escHtml(m.bestLaborWin?.endRo)} (${escHtml(m.bestLaborWin?.startDate)} to ${escHtml(m.bestLaborWin?.endDate)})</div>
            <div class="method-metrics">
              <div><small>Qualified Labor Rate</small><strong class="mono">${formatMoney(r.qualifiedLaborRateCents)}/hr</strong></div>
              <div><small>Annual Labor GP Uplift</small><strong class="mono">${formatMoney(r.uplift.laborUpliftCents)}</strong></div>
            </div>
          </div>
          <div class="method-box winner">
            <h4><span>Qualified Parts Set + Zero-Cost Recall Markup</span><span class="pill pill-green">${m.bestPartsWin?.kind === "100_RO" ? "100-RO Set" : "90-Day Set"}</span></h4>
            <div class="micro-note">ROs ${escHtml(m.bestPartsWin?.startRo)} – ${escHtml(m.bestPartsWin?.endRo)} · Zero-cost recall cost base: ${formatMoney(r.ohAnnualZeroCostPartsCostCents)}</div>
            <div class="method-metrics">
              <div><small>Qualified Parts Markup</small><strong class="mono">${formatPct(r.qualifiedPartsMarkupBp)}</strong></div>
              <div><small>Zero-Cost Recall Uplift</small><strong class="mono">${formatMoney(r.uplift.ohRecallUpliftCents)}</strong></div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // TX or CA combined comparison
    const b100 = m.best100;
    const b90 = m.best90;
    els.methodDetailPanel.innerHTML = `
      <div class="panel-top">
        <div>
          <h3>${escHtml(r.statute.stateName)} Statutory Window Comparison (${escHtml(r.statute.citation)})</h3>
          <p class="panel-desc">${escHtml(m.ruleNote)}</p>
        </div>
        <span class="pill pill-green">Selected: ${m.chosenKind === "100_RO" ? "100 Sequential Qualified ROs" : "90 Consecutive Days"}</span>
      </div>
      <div class="method-grid">
        <div class="method-box ${m.chosenKind === "100_RO" ? "winner" : ""}">
          <h4>
            <span>100 Sequential Qualified ROs</span>
            ${m.chosenKind === "100_RO" ? '<span class="pill pill-green">Selected</span>' : '<span class="pill pill-neutral">Compared</span>'}
          </h4>
          <div class="micro-note">${b100 ? `ROs ${escHtml(b100.startRo)} – ${escHtml(b100.endRo)} (${b100.totalRos} total ROs in span, ${b100.qualifiedRos} qualified)` : "Insufficient ROs"}</div>
          <div class="method-metrics">
            <div><small>Labor Rate</small><strong class="mono">${b100 ? formatMoney(b100.laborRateCents) + "/hr" : "—"}</strong></div>
            <div><small>Parts Markup</small><strong class="mono">${b100 ? formatPct(b100.partsMarkupBp) : "—"}</strong></div>
          </div>
        </div>
        <div class="method-box ${m.chosenKind === "90_DAY" ? "winner" : ""}">
          <h4>
            <span>90 Consecutive Calendar Days</span>
            ${m.chosenKind === "90_DAY" ? '<span class="pill pill-green">Selected</span>' : '<span class="pill pill-neutral">Compared</span>'}
          </h4>
          <div class="micro-note">${b90 ? `${escHtml(b90.startDate)} to ${escHtml(b90.endDate)} (${b90.totalRos} total ROs in span, ${b90.qualifiedRos} qualified)` : "Insufficient ROs"}</div>
          <div class="method-metrics">
            <div><small>Labor Rate</small><strong class="mono">${b90 ? formatMoney(b90.laborRateCents) + "/hr" : "—"}</strong></div>
            <div><small>Parts Markup</small><strong class="mono">${b90 ? formatPct(b90.partsMarkupBp) : "—"}</strong></div>
          </div>
        </div>
      </div>
    `;
  }

  function renderCompetitorTable(r) {
    const c = r.competitors;
    const total = r.uplift.totalUpliftCents;
    els.roiMultiplePill.textContent = `First-Year ROI on $1,295: ${c.roiMultiple}`;

    const rows = [
      {
        name: "RetailRate Statutory Filing Packet",
        model: "$1,295 flat one-time (0% commission, both depts)",
        fee: c.flatFee,
        highlight: true,
      },
      {
        name: 'Fixed Performance ("Margin Plus" — 1 Dept)',
        model: "$4,500 per department per submission",
        fee: c.fpSingle,
      },
      {
        name: 'Fixed Performance ("Margin Plus" — Labor + Parts)',
        model: "$9,000 combined both departments",
        fee: c.fpBoth,
      },
      {
        name: "Contingency Consultant (15% Split)",
        model: "15% of projected first-year warranty uplift",
        fee: c.cont15,
      },
      {
        name: "Contingency Consultant (30% Split)",
        model: "30% of projected first-year warranty uplift",
        fee: c.cont30,
      },
      {
        name: "Monthly Fixed Ops SaaS ($499–$799/mo)",
        model: "12-month recurring software subscription",
        fee: c.saasHigh,
        feeLabel: `${formatMoney(c.saasLow)}–${formatMoney(c.saasHigh)}`,
        savingsLabel: `${formatMoney(c.saasLow - c.flatFee)}–${formatMoney(c.saasHigh - c.flatFee)}`,
      },
    ];

    els.competitorTbody.innerHTML = rows
      .map((row) => {
        const net = total - row.fee;
        const savings = row.fee - c.flatFee;
        const pctSaved = row.fee > 0n ? Number(divRoundHalfUp(savings * 1000n, row.fee)) / 10 : 0;
        return `
          <tr class="${row.highlight ? "row-highlight" : ""}">
            <td>${escHtml(row.name)}</td>
            <td>${escHtml(row.model)}</td>
            <td class="num mono">${row.feeLabel || formatMoney(row.fee)}</td>
            <td class="num mono">${formatMoney(net)}</td>
            <td class="num mono">${
              row.highlight
                ? "Baseline ($1,295 Flat)"
                : row.savingsLabel || `${formatMoney(savings)} (${pctSaved.toFixed(1)}%)`
            }</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderExclusionsTable(r) {
    const q = (appState.exclusionFilter || "").trim().toLowerCase();
    const filtered = r.excludedLines.filter((item) => {
      if (!q) return true;
      return (
        item.roNumber.toLowerCase().includes(q) ||
        item.opCode.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.subsection.toLowerCase().includes(q) ||
        item.reason.toLowerCase().includes(q) ||
        item.payType.toLowerCase().includes(q)
      );
    });

    els.exclusionCountPill.textContent = `${filtered.length} of ${r.excludedLines.length} excluded`;

    if (!filtered.length) {
      els.exclusionsTbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--ink-muted);">No matching excluded RO lines.</td></tr>`;
      return;
    }

    els.exclusionsTbody.innerHTML = filtered
      .slice(0, 150)
      .map(
        (ex) => `
          <tr>
            <td class="mono nowrap"><strong>${escHtml(ex.roNumber)}</strong></td>
            <td class="mono nowrap">${escHtml(ex.closeDate)}</td>
            <td class="mono nowrap">${escHtml(ex.payType)}</td>
            <td class="mono nowrap">${escHtml(ex.opCode)}</td>
            <td>${escHtml(ex.description)}</td>
            <td class="num mono">${formatMoney(ex.laborSaleCents)}</td>
            <td class="num mono">${formatMoney(ex.partsSaleCents)}</td>
            <td>
              <span class="reason-tag">${escHtml(ex.subsection)}</span>
              <div style="font-size:12px;color:var(--ink-secondary);margin-top:3px;">${escHtml(ex.reason)}</div>
            </td>
          </tr>
        `
      )
      .join("");
  }

  // =========================================================================
  // 7. $0.00 PDF RECONCILIATION PREVIEW (Matches engine/samples/tx_ro_packet_*)
  // =========================================================================
  const RECON_SAMPLE_PASS = [
    { ro: "600001", csvLabor: 52973n, pdfLabor: 52973n, csvParts: 60219n, pdfParts: 60219n },
    { ro: "600002", csvLabor: 82894n, pdfLabor: 82894n, csvParts: 73293n, pdfParts: 73293n },
    { ro: "600003", csvLabor: 8643n, pdfLabor: 8643n, csvParts: 8427n, pdfParts: 8427n },
    { ro: "600004", csvLabor: 96082n, pdfLabor: 96082n, csvParts: 164753n, pdfParts: 164753n },
    { ro: "600005", csvLabor: 88256n, pdfLabor: 88256n, csvParts: 130439n, pdfParts: 130439n },
  ];

  function renderReconciliationPreview(mode) {
    appState.reconMode = mode;
    els.reconToggleBtns.forEach((b) => b.classList.toggle("active", b.dataset.reconMode === mode));

    const rows = RECON_SAMPLE_PASS.map((row, idx) => {
      if (mode === "fail" && idx === 2) {
        return { ...row, pdfParts: row.pdfParts + 1n }; // +$0.01 tampered mismatch
      }
      return row;
    });

    let discrepancyCount = 0;
    els.reconTbody.innerHTML = rows
      .map((row) => {
        const delta = (row.pdfLabor - row.csvLabor) + (row.pdfParts - row.csvParts);
        const fail = delta !== 0n;
        if (fail) discrepancyCount++;
        return `
          <tr class="${fail ? "row-fail" : ""}">
            <td class="mono"><strong>${escHtml(row.ro)}</strong></td>
            <td class="num mono">${formatMoney(row.csvLabor)}</td>
            <td class="num mono">${formatMoney(row.pdfLabor)}</td>
            <td class="num mono">${formatMoney(row.csvParts)}</td>
            <td class="num mono">${formatMoney(row.pdfParts)}</td>
            <td class="num mono">${formatMoney(delta, true)}</td>
            <td><span class="pill ${fail ? "pill-red" : "pill-green"}">${fail ? "FAIL ($0.01)" : "PASS ($0.00)"}</span></td>
          </tr>
        `;
      })
      .join("");

    if (discrepancyCount === 0) {
      els.reconStatusPill.textContent = "PASS · $0.00 Tolerance";
      els.reconStatusPill.className = "pill pill-green";
      els.reconSummaryText.textContent = `${rows.length} sample ROs · 0 discrepancies`;
      els.reconAlertBox.classList.add("hidden");
    } else {
      els.reconStatusPill.textContent = `FAIL · ${discrepancyCount} Discrepancy Caught`;
      els.reconStatusPill.className = "pill pill-red";
      els.reconSummaryText.textContent = `${rows.length} sample ROs · ${discrepancyCount} quarantined`;
      els.reconAlertBox.textContent =
        "PACKET HALTED: RO 600003 shows a +$0.01 delta between PDF Parts ($84.28) and DMS CSV Parts ($84.27). Packet is never released until reconciled to exact $0.00.";
      els.reconAlertBox.classList.remove("hidden");
    }
  }

  // =========================================================================
  // 8. EXPORT SUMMARY (JSON / TXT) & BOOKING MAILTO GENERATOR
  // =========================================================================
  function buildSummaryObject() {
    const r = appState.lastResult;
    if (!r) return null;
    return {
      generated_at: new Date().toISOString(),
      tool: "RetailRate Filing — 4-State Client-Side Statutory Pre-Screen",
      state: r.state,
      statute: r.statute.citation,
      dms_detected: r.dmsVendor,
      cdk_detected: r.cdkDetected,
      dataset_label: appState.datasetLabel,
      runtime_ms: r.runtimeMs,
      qualified_labor_rate: centsToFloat(r.qualifiedLaborRateCents),
      qualified_parts_markup_pct: centsToFloat(r.qualifiedPartsMarkupBp),
      current_labor_rate: centsToFloat(r.currentLaborRateCents),
      current_parts_markup_pct: centsToFloat(r.currentPartsMarkupBp),
      projected_12mo_labor_uplift: centsToFloat(r.uplift.laborUpliftCents),
      projected_12mo_parts_uplift: centsToFloat(r.uplift.partsUpliftCents),
      projected_12mo_oh_recall_uplift: centsToFloat(r.uplift.ohRecallUpliftCents),
      projected_12mo_total_uplift: centsToFloat(r.uplift.totalUpliftCents),
      qualifies_50k_benchmark: r.qualifies50k,
      selected_method: r.selectedWindowLabel,
      total_ros: r.totalRos,
      qualified_ros: r.qualifiedRos,
      excluded_lines_count: r.excludedLines.length,
      sequence_gaps_count: r.sequenceGaps.length,
      pricing: {
        retailrate_flat_fee: 1295,
        fixed_performance_single_dept: 4500,
        fixed_performance_both_depts: 9000,
        contingency_15_pct: centsToFloat(r.competitors.cont15),
        contingency_30_pct: centsToFloat(r.competitors.cont30),
        roi_multiple: r.competitors.roiMultiple,
      },
      compliance_guardrails: {
        verified_states_only: ["TX", "CA", "OH", "FL"],
        fl_sliding_window_allowed: false,
        zero_ro_alteration: true,
        zero_mid_window_price_hikes: true,
        zero_dms_oem_passwords: true,
        zero_upl_cpa_hearing_representation: true,
        dealer_self_upload_packet: true,
      },
    };
  }

  function buildTxtReport() {
    const r = appState.lastResult;
    if (!r) return "";
    const lines = [
      "======================================================================",
      "RETAILRATE FILING — 4-STATE STATUTORY WARRANTY PRE-SCREEN SUMMARY",
      "======================================================================",
      `State / Statute:       ${r.state} (${r.statute.citation})`,
      `DMS Format Detected:   ${r.dmsVendor}${r.cdkDetected ? " [CDK FLAGGED]" : ""}`,
      `Dataset:               ${appState.datasetLabel || "Local DMS CSV"}`,
      `Client Runtime:        ${r.runtimeMs} ms (100% local browser execution)`,
      "",
      "--- STATUTORY RATE & 12-MONTH UPLIFT PROJECTION ---",
      `Verdict:               ${r.qualifies50k ? "QUALIFIES ($50,000+ ANNUAL UPLIFT)" : "BELOW $50,000 BENCHMARK"}`,
      `Method / Window:       ${r.selectedWindowLabel}`,
      `Qualified Labor Rate:  ${formatMoney(r.qualifiedLaborRateCents)}/hr (Current: ${formatMoney(r.currentLaborRateCents)}/hr | Delta: ${formatMoney(r.uplift.laborDeltaCents, true)}/hr)`,
      `Qualified Parts Markup:${formatPct(r.qualifiedPartsMarkupBp)} (Current: ${formatPct(r.currentPartsMarkupBp)} | Delta: ${formatPct(r.uplift.partsDeltaBp, true)} pts)`,
      `12-Mo Labor Uplift:    ${formatMoney(r.uplift.laborUpliftCents)}`,
      `12-Mo Parts Uplift:    ${formatMoney(r.uplift.partsUpliftCents)}`,
    ];
    if (r.state === "OH") {
      lines.push(`12-Mo OH Recall Uplift:${formatMoney(r.uplift.ohRecallUpliftCents)} (Zero-cost recall parts @ full retail markup %)`);
    }
    lines.push(
      `12-MO TOTAL UPLIFT:    ${formatMoney(r.uplift.totalUpliftCents)}`,
      "",
      "--- FEE COMPARISON ---",
      `RetailRate Flat Packet:$1,295.00 one-time (0% commission | ROI: ${r.competitors.roiMultiple})`,
      `Fixed Performance:     $4,500.00 (1 dept) / $9,000.00 (both depts)`,
      `15%-30% Contingency:   ${formatMoney(r.competitors.cont15)} - ${formatMoney(r.competitors.cont30)}`,
      `Monthly SaaS:          $5,988.00 - $9,588.00/yr ($499-$799/mo)`,
      "",
      "--- RO INTEGRITY & STATUTORY EXCLUSIONS ---",
      `Total ROs Parsed:      ${r.totalRos} (${r.qualifiedRos} qualified)`,
      `Excluded Lines Tagged: ${r.excludedLines.length} (retained intact in sequence; never deleted)`,
      `RO Sequence Gaps:      ${r.sequenceGaps.length}`,
      "",
      "--- MANDATORY COMPLIANCE BOUNDARIES ---",
      "- Verified 2026 statutes ONLY: TX, CA, OH, FL.",
      "- Florida (Fla. Stat. § 320.696): Strictly NO sliding-window optimization; dual fixed monthly labor + 10-day OEM notice.",
      "- Zero RO deletion/alteration; zero mid-window retail price manipulation; zero DMS/OEM passwords requested.",
      "- Informational calculation & $0.00 PDF reconciliation only — not legal advice, CPA attestation, or hearing representation.",
      "- Dealership Fixed Operations / Service Director self-uploads the verified PDF packet to the OEM portal."
    );
    return lines.join("\n");
  }

  function triggerDownload(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function buildIntakeEmailPayload() {
    const r = appState.lastResult;
    const dealer = (els.reqDealerName.value || "[Dealership Name]").trim();
    const brand = (els.reqBrand.value || "[Franchise Brand]").trim();
    const state = els.reqState.value || appState.state;
    const dms = els.reqDms.value || "Reynolds & Reynolds (ERA-IGNITE)";
    const contact = (els.reqContactName.value || "[Name & Title]").trim();
    const email = (els.reqEmail.value || "[Work Email]").trim();
    const notes = (els.reqNotes.value || "None").trim();

    const subject = `$1,295 Statutory Filing Packet Request — ${dealer} (${state} · ${brand})`;
    const bodyLines = [
      `Hello RetailRate Filing Team,`,
      ``,
      `Please send the 15-minute DMS export checklist and next steps for our $1,295 flat statutory warranty filing packet (0% commission, dealer self-upload).`,
      ``,
      `DEALERSHIP DETAILS`,
      `- Dealership: ${dealer}`,
      `- Franchise Brand: ${brand}`,
      `- State / Statute: ${state} (${STATUTES[state]?.citation || ""})`,
      `- DMS Platform: ${dms}`,
      `- Contact: ${contact}`,
      `- Reply Email: ${email}`,
      `- Notes: ${notes}`,
      ``,
      `LOCAL 15-SECOND PRE-SCREEN SNAPSHOT (NO RAW RO CSV ATTACHED)`,
      `- Qualified Labor Rate: ${r ? formatMoney(r.qualifiedLaborRateCents) + "/hr" : "—"} (Current: ${r ? formatMoney(r.currentLaborRateCents) + "/hr" : "—"})`,
      `- Qualified Parts Markup: ${r ? formatPct(r.qualifiedPartsMarkupBp) : "—"} (Current: ${r ? formatPct(r.currentPartsMarkupBp) : "—"})`,
      `- 12-Mo Projected GP Uplift: ${r ? formatMoney(r.uplift.totalUpliftCents) : "—"}`,
      `- Benchmark Verdict: ${r ? (r.qualifies50k ? "QUALIFIES ($50,000+)" : "Below $50,000") : "—"}`,
      `- Method: ${r ? r.selectedWindowLabel : "—"}`,
      ``,
      `Compliance confirmed: Zero DMS/OEM passwords will be shared; unaltered RO PDFs will be reconciled to $0.00 for our Fixed Ops / Service Director to self-upload.`,
    ];

    const body = bodyLines.join("\n");
    const mailtoHref = `mailto:${CONFIG.CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return { subject, body, mailtoHref };
  }

  function updateBookingPreview() {
    const payload = buildIntakeEmailPayload();
    els.intakePreviewBox.textContent = `To: ${CONFIG.CONTACT_EMAIL}\nSubject: ${payload.subject}\n\n${payload.body}`;
    els.mailtoBtn.href = payload.mailtoHref;
    els.contactEmailPill.textContent = CONFIG.CONTACT_EMAIL;
  }

  // =========================================================================
  // 9. EVENT LISTENERS & INITIALIZATION
  // =========================================================================
  els.stateTabs.forEach((btn) => {
    btn.addEventListener("click", () => switchStateOnly(btn.dataset.state));
  });

  els.demoBtns.forEach((btn) => {
    btn.addEventListener("click", () => loadSample(btn.dataset.demo));
  });

  els.heroDemoBtn.addEventListener("click", () => {
    loadSample(appState.state);
    document.getElementById("workbench").scrollIntoView({ behavior: "smooth" });
  });

  els.resetDefaultsBtn.addEventListener("click", () => {
    applyStateDefaults(appState.state);
    recompute();
  });

  [
    els.inputCurrentLabor,
    els.inputCurrentMarkup,
    els.inputAnnualHours,
    els.inputAnnualPartsCost,
    els.inputOhZeroCost,
    els.inputFlGpPct,
    els.inputFlTechWage,
  ].forEach((inp) => {
    inp.addEventListener("input", recompute);
  });

  els.exclusionSearch.addEventListener("input", (e) => {
    appState.exclusionFilter = e.target.value;
    if (appState.lastResult) renderExclusionsTable(appState.lastResult);
  });

  // CSV Dropzone & File Upload
  function handleLocalFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      appState.csvText = String(reader.result || "");
      appState.datasetLabel = `Local CSV: ${file.name}`;
      els.demoBtns.forEach((b) => b.classList.remove("active"));
      recompute();
    };
    reader.readAsText(file);
  }

  els.dropzone.addEventListener("click", () => els.fileInput.click());
  els.dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      els.fileInput.click();
    }
  });
  els.fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) handleLocalFile(e.target.files[0]);
  });
  els.dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    els.dropzone.classList.add("dragover");
  });
  els.dropzone.addEventListener("dragleave", () => els.dropzone.classList.remove("dragover"));
  els.dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    els.dropzone.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleLocalFile(e.dataTransfer.files[0]);
  });

  // Reconciliation preview toggle
  els.reconToggleBtns.forEach((btn) => {
    btn.addEventListener("click", () => renderReconciliationPreview(btn.dataset.reconMode));
  });

  // Download exports
  els.downloadJsonBtn.addEventListener("click", () => {
    const obj = buildSummaryObject();
    if (!obj) return;
    triggerDownload(`retailrate_prescreen_${obj.state}.json`, JSON.stringify(obj, null, 2), "application/json");
  });

  els.downloadTxtBtn.addEventListener("click", () => {
    const txt = buildTxtReport();
    if (!txt) return;
    triggerDownload(`retailrate_prescreen_${appState.state}.txt`, txt, "text/plain");
  });

  // Booking form listeners
  [
    els.reqDealerName,
    els.reqBrand,
    els.reqState,
    els.reqDms,
    els.reqContactName,
    els.reqEmail,
    els.reqNotes,
  ].forEach((el) => {
    el.addEventListener("input", updateBookingPreview);
    el.addEventListener("change", updateBookingPreview);
  });

  els.downloadIntakeBtn.addEventListener("click", () => {
    const payload = buildIntakeEmailPayload();
    const content = `To: ${CONFIG.CONTACT_EMAIL}\nSubject: ${payload.subject}\n\n${payload.body}\n`;
    triggerDownload(`retailrate_packet_request_${els.reqState.value || appState.state}.txt`, content, "text/plain");
    els.bookingFeedback.textContent = "Downloaded intake summary (.txt).";
  });

  els.copyIntakeBtn.addEventListener("click", async () => {
    const payload = buildIntakeEmailPayload();
    try {
      await navigator.clipboard.writeText(`To: ${CONFIG.CONTACT_EMAIL}\nSubject: ${payload.subject}\n\n${payload.body}`);
      els.bookingFeedback.textContent = "Copied email request to clipboard.";
    } catch {
      els.bookingFeedback.textContent = "Clipboard unavailable—use Download Intake Summary (.txt) or Open Pre-Filled Request Email.";
    }
  });

  // Expose testable API for Playwright & parity verification against engine/prescreen.py
  window.RetailRateEngine = {
    CONFIG,
    STATUTES,
    parseScaled,
    divRoundHalfUp,
    normalizeCsvText,
    runPrescreen,
    loadSample,
    getLastResult: () => appState.lastResult,
    setContactEmail: (email) => {
      CONFIG.CONTACT_EMAIL = email;
      updateBookingPreview();
    },
  };

  // Boot
  renderReconciliationPreview("pass");
  if (window.RETAILRATE_SAMPLES && window.RETAILRATE_SAMPLES.TX) {
    loadSample("TX");
  } else {
    renderStatuteCard("TX");
    toggleStateInputs("TX");
    updateBookingPreview();
  }
})();
