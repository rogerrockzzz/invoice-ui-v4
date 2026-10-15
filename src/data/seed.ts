/* Seed data copied verbatim from journey-opd-v3.html (lines 946–1219, 3322–3328).
   Keep it identical to v3 — demos, goldens and e2e tests depend on these scenarios. */
import { CASH_PAYER } from "../domain/constants";
import { today } from "../domain/clock";
import type { InsStatus, NphiesPolicy, Patient, Plan, Visit, World } from "../domain/types";

export type { NphiesPolicy };
export interface DirectoryPayer {
  id: string; label: string; kind: string; group: string; contract: string; policy?: string; plan: Plan;
}

/* What an NPHIES eligibility check returns per patient (simulated). */
export const NPHIES: Record<string, NphiesPolicy[]> = {
  "7000203": [
    { id:"NCCI-A", insurer:"NCCI", cls:"CLASS A", status:"Eligible", group:"1104 - NCCI", contract:"66120 - NCCI GROUP",
      policy:"401122 - CLASS A", policyNo:"66120", subPolicy:"01", cardId:"2034 5521 9", validTo:"2027-03-31",
      holderCode:"NCCI-8812", holder:"Saudi Electricity Co." },
    { id:"MEDGULF-B", insurer:"MEDGULF", cls:"PLUS B", status:"Eligible", group:"1310 - MEDGULF", contract:"70310 - MEDGULF CORP",
      policy:"512200 - PLUS B", policyNo:"70310", subPolicy:"", cardId:"7710 2201 4", validTo:"2026-12-31",
      holderCode:"MG-4410", holder:"Almarai" } ],
  "7000667": [
    { id:"BUPA-GOLD", insurer:"BUPA", cls:"GOLD", status:"Eligible", group:"2288 - BUPA", contract:"80737 - BUPA CORP",
      policy:"545367 - GOLD", policyNo:"80737", subPolicy:"03", cardId:"3234 3435 1", validTo:"2027-06-30",
      holderCode:"BP-22019", holder:"Saudi Aramco" },
    { id:"TAW-SILVER", insurer:"TAWUNIYA", cls:"SILVER", status:"Not eligible", reason:"Policy expired on 30 Sep",
      group:"3002 - TAWUNIYA", contract:"90110 - TAWUNIYA SME", policy:"610455 - SILVER", policyNo:"90110", subPolicy:"",
      cardId:"5512 0098 2", validTo:"2026-09-30", holderCode:"TW-7730", holder:"Riyadh Trading Est." } ],
  "7100482": [
    { id:"TAW-SILVER", insurer:"TAWUNIYA", cls:"SILVER", status:"Eligible", group:"3002 - TAWUNIYA", contract:"90110 - TAWUNIYA SME",
      policy:"610455 - SILVER", policyNo:"90110", subPolicy:"02", cardId:"5512 0141 7", validTo:"2027-01-31",
      holderCode:"TW-7731", holder:"Riyadh Trading Est." } ],
  "1063301": [
    { id:"GIG-C", insurer:"GIG", cls:"CLASS C", status:"Eligible", isNew:true, group:"4120 - GIG", contract:"55021 - GIG RETAIL",
      policy:"702210 - CLASS C", policyNo:"55021", subPolicy:"", cardId:"9081 2230 5", validTo:"2027-02-28",
      holderCode:"GIG-1201", holder:"Self",
      plan:{ name:"GIG CLASS C", deductiblePct:.30, discountPct:0, visitCap:300, annualLeft:2400 } } ],
  "8825140": []
};
/* payers the hospital creates itself — charity, zakat, staff schemes; they cover in full on an internal approval */
export const INTERNAL_PAYERS: DirectoryPayer[] = [
  { id:"CH-HABIB", label:"Al Habib Charity Fund", kind:"Charity", group:"9001 - INTERNAL CHARITY", contract:"Charity programme 2026",
    plan:{ name:"Charity — full cover", deductiblePct:0, discountPct:0, visitCap:0, annualLeft:99999, internal:true } },
  { id:"CH-ZAKAT", label:"Zakat Committee", kind:"Charity", group:"9002 - ZAKAT", contract:"Zakat assistance",
    plan:{ name:"Zakat — full cover", deductiblePct:0, discountPct:0, visitCap:0, annualLeft:99999, internal:true } },
  { id:"STAFF-FAM", label:"Staff family scheme", kind:"Staff", group:"9100 - STAFF", contract:"Employee dependants",
    plan:{ name:"Staff family — 50%", deductiblePct:.50, discountPct:0, visitCap:500, annualLeft:5000, internal:true } }
];
/* The hospital's payer directory: every contracted insurer policy plus the internal payers. */
export const PAYER_DIRECTORY: DirectoryPayer[] = [
  ...INTERNAL_PAYERS.map(x=>({ ...x, policy:x.plan.name })),
  { id:"RAJHI-B",  label:"AL RAJHI TAKAFUL · CLASS B", kind:"Company", group:"5101 - AL RAJHI TAKAFUL", contract:"61002 - RAJHI CORP",   policy:"803110 - CLASS B",
    plan:{ name:"AL RAJHI CLASS B", deductiblePct:.20, discountPct:0, visitCap:200, annualLeft:3000 } },
  { id:"MALATH-V", label:"MALATH · VIP",               kind:"Company", group:"5220 - MALATH",          contract:"61440 - MALATH VIP",   policy:"804001 - VIP",
    plan:{ name:"MALATH VIP", deductiblePct:.10, discountPct:.05, visitCap:100, annualLeft:8000 } },
  { id:"SAICO-C",  label:"SAICO · CLASS C",            kind:"Company", group:"5330 - SAICO",           contract:"61870 - SAICO SME",    policy:"805220 - CLASS C",
    plan:{ name:"SAICO CLASS C", deductiblePct:.30, discountPct:0, visitCap:300, annualLeft:2000 } },
  { id:"WALAA-B",  label:"WALAA · CLASS B",            kind:"Company", group:"5440 - WALAA",           contract:"62010 - WALAA GROUP",  policy:"806300 - CLASS B",
    plan:{ name:"WALAA CLASS B", deductiblePct:.20, discountPct:0, visitCap:250, annualLeft:2500 } },
  { id:"BUPA-SIL", label:"BUPA · SILVER",              kind:"Company", group:"2288 - BUPA",            contract:"80740 - BUPA SME",     policy:"545370 - SILVER",
    plan:{ name:"BUPA SILVER", deductiblePct:.25, discountPct:0, visitCap:250, annualLeft:2200 } }
];

export const LATER_ORDERS: { code: string; name: string; price: number; kind: InsStatus }[][] = [
  [{ code:"LAB-208", name:"CRP Quantitative",   price:180, kind:"approved" },
   { code:"RAD-311", name:"Chest CT",           price:900, kind:"pending"  }],
  [{ code:"LAB-415", name:"Blood Culture",      price:260, kind:"approved" }],
  [{ code:"PHY-120", name:"Physiotherapy Session", price:220, kind:"approved" },
   { code:"LAB-660", name:"Vitamin B12",        price:150, kind:"pending"  }]
];

/* visits already booked for the coming days are dated relative to today */
export const daysAhead = (n: number) => {
  const d = today();
  d.setDate(d.getDate() + n);
  return `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleString("en-GB", { month: "short" })}`;
};

/* a fresh copy of the v3 world on every call */
export function createSeed(): Pick<World, "patients" | "cases"> {
    const patients: Record<string, Patient> = {
    "7000203": { mrn:"7000203", name:"WADHA DAIFALLAH", age:"4M", gender:"Female", mobile:"0555 401 220",
      wallet:{ advance:{Open:0,Doctor:0,Clinic:0} },
      payers:[ { id:"NCCI-A", label:"NCCI · CLASS A", plan:{ name:"NCCI CLASS A", deductiblePct:.20, discountPct:0, visitCap:150, annualLeft:1360 } },
               { id:"MEDGULF-B", label:"MEDGULF · PLUS B", plan:{ name:"MEDGULF PLUS B", deductiblePct:.10, discountPct:0, visitCap:100, annualLeft:900 } },
               CASH_PAYER ] },
    "7000667": { mrn:"7000667", name:"MOHAMMED AL QAHTANI", age:41, gender:"Male", mobile:"0555 112 233",
      wallet:{ advance:{Open:500,Doctor:0,Clinic:0} },
      ledger:[
        { k:7280905, at:"09:05", date:"28 Jul", by:"SAADAN SAAFAN", type:"CREDIT_RAISED", amount:120.00,
          invoiceId:"INV-731044", visitId:11, note:"Consultation left unsettled" },
        { k:8120941, at:"09:41", date:"12 Aug", by:"SAADAN SAAFAN", type:"ADV_IN", amount:500.00, cat:"Open",
          mode:"Card", visitId:10, note:"Open advance received" },
        { k:8121022, at:"10:22", date:"12 Aug", by:"SAADAN SAAFAN", type:"CREDIT_RAISED", amount:180.00,
          invoiceId:"INV-742118", visitId:10, note:"Orders left unsettled" }
      ],
      payers:[ { id:"BUPA-GOLD", label:"BUPA · GOLD", plan:{ name:"BUPA GOLD", deductiblePct:.20, discountPct:.05, visitCap:200, annualLeft:1850 } },
               { id:"TAW-SILVER", label:"TAWUNIYA · SILVER", plan:{ name:"TAWUNIYA SILVER", deductiblePct:.25, discountPct:0, visitCap:250, annualLeft:1700 } },
               CASH_PAYER ] },
    "7100482": { mrn:"7100482", name:"NOURA AL HARBI", age:34, gender:"Female", mobile:"0553 220 118",
      wallet:{ advance:{Open:200,Doctor:0,Clinic:0} },
      ledger:[{ k:9000935, at:"09:35", date:"Today", by:"SAADAN SAAFAN", type:"ADV_IN", amount:200.00, cat:"Open",
        mode:"Cash", visitId:3, note:"Open advance received at registration" }],
      payers:[ { id:"TAW-SILVER", label:"TAWUNIYA · SILVER", plan:{ name:"TAWUNIYA SILVER", deductiblePct:.25, discountPct:0, visitCap:250, annualLeft:1700 } },
               CASH_PAYER ] },
    "8825140": { mrn:"8825140", name:"AHMED BIN SALEM", age:57, gender:"Male", mobile:"0501 998 442",
      wallet:{ advance:{Open:0,Doctor:0,Clinic:0} },
      payers:[ CASH_PAYER ] },
    "1063301": { mrn:"1063301", name:"RASANGIKA JAYAWARDHANA", age:34, gender:"Female", mobile:"0714 162 377",
      wallet:{ advance:{Open:0,Doctor:0,Clinic:0} },
      payers:[ CASH_PAYER ] }
  };

    const cases: Visit[] = [
    { id:1, mrn:"7000203", visitType:"Consultation", clinic:"PAEDIATRICS", doctor:"LINA FAROUK", arrived:"09:12", date:"Today", sortKey:9000,
      payerId:"NCCI-A", dedUsed:0,
      consult:{ name:"Paediatric Consultation", code:"CON-101", price:200, priceIns:200, priceCash:170, ins:"approved", paid:false },
      orders:[], invoices:[], bill:null, link:null, closed:false, prefs:{},
      history:[{ at:"09:12", ic:"i", tx:"<b>Visit created</b> at reception", sub:"Paediatrics · Dr Lina Farouk", type:"VISIT", by:"SAADAN SAAFAN" }] },

    { id:2, mrn:"7000667", visitType:"Consultation", clinic:"CARDIOLOGY", doctor:"AHMED AL SUBAIE", arrived:"08:40", date:"Today", sortKey:9000,
      payerId:"BUPA-GOLD", dedUsed:57,
      consult:{ name:"Cardiology Consultation", code:"CON-204", price:300, priceIns:300, priceCash:260, ins:"approved", paid:true, via:"Payment link", invoiceId:"INV-771204" },
      orders:[
        { code:"LAB-010", name:"Full Blood Count",   price:120, priceIns:120, priceCash:100, ins:"approved", ordered:"09:21", paid:false },
        { code:"RAD-050", name:"Chest X-Ray 2 View", price:250, priceIns:250, priceCash:210, ins:"partial",  ordered:"09:21", paid:false },
        { code:"CAR-330", name:"Echocardiogram",     price:900, priceIns:900, priceCash:760, ins:"pending",  ordered:"09:21", paid:false },
        /* a package: bill it once here, then its procedures can be booked on other days */
        { code:"PKG-100", name:"Cardiac Care Package", price:1500, priceIns:1500, priceCash:1250, ins:"approved", ordered:"09:21", paid:false,
          package:true, children:[
            { code:"PKG-100-A", name:"Treadmill Stress Test" },
            { code:"PKG-100-B", name:"Echocardiogram Review" },
            { code:"PKG-100-C", name:"Lipid Profile Recheck" },
            { code:"PKG-100-D", name:"Cardiology Follow-up Review" }
          ] }
      ],
      invoices:[{ id:"INV-771204", scope:"consult", at:"08:47", patient:65.55, company:262.20, deductible:57, paid:true, via:"Payment link",
        payer:"BUPA · GOLD", rows:[{ name:"Cardiology Consultation", code:"CON-204",
          calc:{ gross:300, discount:15, net:285, deductible:57, patient:57, company:228, patientWithTax:65.55, companyWithTax:262.20 } }] }],
      bill:null, link:null, closed:false, prefs:{},
      history:[
        { at:"09:21", ic:"i", tx:"<b>Dr Ahmed placed 4 orders</b>", sub:"3 approved · 1 awaiting BUPA · includes the Cardiac Care Package",
          type:"ORDERS", by:"Dr AHMED AL SUBAIE",
          lines:[{ name:"Full Blood Count", code:"LAB-010", ins:"approved", price:120 },
                 { name:"Chest X-Ray 2 View", code:"RAD-050", ins:"partial", price:250 },
                 { name:"Echocardiogram", code:"CAR-330", ins:"pending", price:900 },
                 { name:"Cardiac Care Package", code:"PKG-100", ins:"approved", price:1500 }] },
        { at:"08:47", ic:"", tx:"<b>Consultation paid</b> — SAR 65.55", sub:"Payment link · invoice INV-771204 created · SAR 262.20 to BUPA",
          type:"PAYMENT", invoiceId:"INV-771204", amount:65.55, company:262.20, deductible:57, mode:"Payment link", scope:"consult", by:"SAADAN SAAFAN" },
        { at:"08:44", ic:"i", tx:"<b>Payment link sent</b> — SAR 65.55", sub:"To 0555 112 233",
          type:"LINK", amount:65.55, mode:"Payment link", scope:"consult", by:"SAADAN SAAFAN" },
        { at:"08:41", ic:"i", tx:"<b>Approval received</b> for the consultation", sub:"BUPA GOLD · approved in full",
          type:"APPROVAL", by:"BUPA", lines:[{ name:"Cardiology Consultation", code:"CON-204", ins:"approved", price:300 }] },
        { at:"08:40", ic:"i", tx:"<b>Visit created</b> at reception", sub:"Cardiology · Dr Ahmed Al Subaie", type:"VISIT", by:"SAADAN SAAFAN" }
      ] },

    { id:3, mrn:"7100482", visitType:"Consultation", clinic:"DERMATOLOGY", doctor:"HUDA AL MUTAIRI", arrived:"09:35", date:"Today", sortKey:9000,
      payerId:"TAW-SILVER", dedUsed:0,
      consult:{ name:"Dermatology Consultation", code:"CON-402", price:250, priceIns:250, priceCash:215, ins:"pending", paid:false },
      orders:[], invoices:[], bill:null, link:null, closed:false, prefs:{},
      history:[{ at:"09:35", ic:"i", tx:"<b>Visit created</b> at reception", sub:"Approval requested from Tawuniya", type:"VISIT", by:"SAADAN SAAFAN" }] },

    { id:4, mrn:"8825140", visitType:"Consultation", clinic:"ORTHOPAEDICS", doctor:"OMAR HASSAN", arrived:"08:05", date:"Today", sortKey:9000,
      payerId:"CASH", dedUsed:0,
      consult:{ name:"Orthopaedic Consultation", code:"CON-310", price:250, ins:"notinsured", paid:true, via:"Cash", invoiceId:"INV-660310" },
      orders:[ { code:"RAD-120", name:"Knee X-Ray", price:180, ins:"notinsured", ordered:"08:51", paid:true, via:"Payment link", invoiceId:"INV-660477",
        performed:"09:20" } ],
      invoices:[{ id:"INV-660310", scope:"consult", at:"08:09", patient:287.50, company:0, deductible:0, paid:true, via:"Cash", payer:"Cash / Self-pay",
        rows:[{ name:"Orthopaedic Consultation", code:"CON-310",
          calc:{ gross:250, discount:0, net:250, deductible:0, patient:250, company:0, patientWithTax:287.50, companyWithTax:0 } }] },
                { id:"INV-660477", scope:"orders", at:"08:58", patient:207.00, company:0, deductible:0, paid:true, via:"Payment link", payer:"Cash / Self-pay",
        rows:[{ name:"Knee X-Ray", code:"RAD-120",
          calc:{ gross:180, discount:0, net:180, deductible:0, patient:180, company:0, patientWithTax:207.00, companyWithTax:0 } }] }],
      bill:null, link:null, closed:false, prefs:{},
      history:[
        { at:"08:58", ic:"", tx:"<b>Orders paid</b> — SAR 207.00", sub:"Payment link · invoice INV-660477 created · Knee X-Ray",
          type:"PAYMENT", invoiceId:"INV-660477", amount:207, company:0, mode:"Payment link", scope:"orders", by:"SAADAN SAAFAN" },
        { at:"08:09", ic:"", tx:"<b>Consultation paid</b> — SAR 287.50", sub:"Cash at desk · invoice INV-660310 created",
          type:"PAYMENT", invoiceId:"INV-660310", amount:287.5, company:0, mode:"Cash", scope:"consult", by:"SAADAN SAAFAN" },
        { at:"08:05", ic:"i", tx:"<b>Visit created</b> at reception", sub:"Orthopaedics · Dr Omar Hassan", type:"VISIT", by:"SAADAN SAAFAN" }
      ] }
  ];

  /* earlier visits — where the outstanding credit came from */
  cases.push(
    { id:10, mrn:"7000667", visitType:"Consultation", clinic:"CARDIOLOGY", doctor:"AHMED AL SUBAIE", arrived:"10:22",
      date:"12 Aug", sortKey:8120, payerId:"BUPA-GOLD", dedUsed:0,
      consult:{ name:"Cardiology Consultation", code:"CON-204", price:300, ins:"approved", paid:true, via:"Card", invoiceId:"INV-742001" },
      orders:[ { code:"CAR-410", name:"Holter Monitor 24h", price:400, ins:"notcovered", ordered:"10:40", paid:false, via:"Credit", invoiceId:"INV-742118" } ],
      invoices:[
        { id:"INV-742118", scope:"orders", at:"12 Aug 10:22", patient:180.00, company:0, deductible:0, paid:false, settled:false, via:"Credit",
          payer:"BUPA · GOLD", rows:[{ name:"Holter Monitor 24h", code:"CAR-410",
            calc:{ gross:400, discount:20, net:380, deductible:0, patient:156.52, company:0, patientWithTax:180.00, companyWithTax:0 } }] },
        { id:"INV-742001", scope:"consult", at:"12 Aug 09:58", patient:65.55, company:262.20, deductible:57, paid:true, via:"Card",
          payer:"BUPA · GOLD", rows:[{ name:"Cardiology Consultation", code:"CON-204",
            calc:{ gross:300, discount:15, net:285, deductible:57, patient:57, company:228, patientWithTax:65.55, companyWithTax:262.20 } }] }],
      bill:null, link:null, closed:true, prefs:{},
      history:[
        { at:"10:22", ic:"w", tx:"<b>Orders put on credit</b> — SAR 180.00", sub:"Credit · invoice INV-742118 created · Holter Monitor 24h",
          type:"PAYMENT", invoiceId:"INV-742118", amount:180, mode:"Credit", scope:"orders", by:"SAADAN SAAFAN" },
        { at:"09:58", ic:"", tx:"<b>Consultation paid</b> — SAR 65.55", sub:"Card · invoice INV-742001 created",
          type:"PAYMENT", invoiceId:"INV-742001", amount:65.55, company:262.20, mode:"Card", scope:"consult", by:"SAADAN SAAFAN" },
        { at:"09:50", ic:"i", tx:"<b>Visit created</b> at reception", sub:"Cardiology · Dr Ahmed Al Subaie", type:"VISIT", by:"SAADAN SAAFAN" }] },

    { id:11, mrn:"7000667", visitType:"Follow-up", clinic:"CARDIOLOGY", doctor:"AHMED AL SUBAIE", arrived:"09:05",
      date:"28 Jul", sortKey:7280, payerId:"BUPA-GOLD", dedUsed:0,
      consult:{ name:"Cardiology Follow-up", code:"CON-205", price:250, ins:"notcovered", paid:false, via:"Credit", invoiceId:"INV-731044" },
      orders:[], invoices:[
        { id:"INV-731044", scope:"consult", at:"28 Jul 09:05", patient:120.00, company:0, deductible:0, paid:false, settled:false, via:"Credit",
          payer:"BUPA · GOLD", rows:[{ name:"Cardiology Follow-up", code:"CON-205",
            calc:{ gross:250, discount:12.5, net:237.5, deductible:0, patient:104.35, company:0, patientWithTax:120.00, companyWithTax:0 } }] }],
      bill:null, link:null, closed:true, prefs:{},
      history:[
        { at:"09:05", ic:"w", tx:"<b>Consultation put on credit</b> — SAR 120.00", sub:"Credit · invoice INV-731044 created",
          type:"PAYMENT", invoiceId:"INV-731044", amount:120, mode:"Credit", scope:"consult", by:"SAADAN SAAFAN" },
        { at:"08:58", ic:"i", tx:"<b>Visit created</b> at reception", sub:"Follow-up · Cardiology", type:"VISIT", by:"SAADAN SAAFAN" }] },

    { id:12, mrn:"7000203", visitType:"Consultation", clinic:"PAEDIATRICS", doctor:"LINA FAROUK", arrived:"11:14",
      date:"02 Sep", sortKey:8902, payerId:"NCCI-A", dedUsed:40,
      consult:{ name:"Paediatric Consultation", code:"CON-101", price:200, ins:"approved", paid:true, via:"Cash", invoiceId:"INV-702255" },
      orders:[], invoices:[{ id:"INV-702255", scope:"consult", at:"02 Sep 11:20", patient:46.00, company:184.00, deductible:40, paid:true, via:"Cash",
        payer:"NCCI · CLASS A", rows:[{ name:"Paediatric Consultation", code:"CON-101",
          calc:{ gross:200, discount:0, net:200, deductible:40, patient:40, company:160, patientWithTax:46.00, companyWithTax:184.00 } }] }],
      bill:null, link:null, closed:true, prefs:{},
      history:[
        { at:"11:20", ic:"", tx:"<b>Consultation paid</b> — SAR 46.00", sub:"Cash · invoice INV-702255 created",
          type:"PAYMENT", invoiceId:"INV-702255", amount:46, company:184, mode:"Cash", scope:"consult", by:"SAADAN SAAFAN" },
        { at:"11:14", ic:"i", tx:"<b>Visit created</b> at reception", sub:"Paediatrics · Dr Lina Farouk", type:"VISIT", by:"SAADAN SAAFAN" }] }
  );
  /* received from another hospital — the orders were placed there, the money is taken here */
  cases.push(
    { id:20, mrn:"7000667", visitType:"Interbranch orders", clinic:"RADIOLOGY", doctor:"KHALID AL ZAHRANI",
      arrived:"11:05", date:"Today", sortKey:9002,
      interbranch:true, fromBranch:"AL TAKHASSUSI HOSPITAL",
      payerId:"BUPA-GOLD", dedUsed:0,
      consult:{ name:"Consultation billed at AL TAKHASSUSI HOSPITAL", code:"CON-901", price:0,
        ins:"notcovered", paid:true, elsewhere:true },
      orders:[
        { code:"RAD-220", name:"MRI Lumbar Spine", price:1200, ins:"approved", ordered:"11:05",
          branch:"AL TAKHASSUSI HOSPITAL", paid:false },
        { code:"LAB-118", name:"Vitamin D Total",  price:180,  ins:"pending",  ordered:"11:05",
          branch:"AL TAKHASSUSI HOSPITAL", paid:false }
      ],
      invoices:[], bill:null, link:null, closed:false, prefs:{},
      history:[{ at:"11:05", ic:"i", tx:"<b>Visit received from AL TAKHASSUSI HOSPITAL</b>",
        sub:"2 orders placed there · consultation already billed at that branch · to be invoiced here",
        type:"INTERBRANCH", by:"System" }] },

    { id:21, mrn:"7000203", visitType:"Interbranch orders", clinic:"LABORATORY", doctor:"SARA AL DOSSARI",
      arrived:"10:40", date:"05 Sep", sortKey:8905,
      interbranch:true, fromBranch:"AL RAYAN HOSPITAL",
      payerId:"NCCI-A", dedUsed:0,
      consult:{ name:"Consultation billed at AL RAYAN HOSPITAL", code:"CON-902", price:0,
        ins:"notcovered", paid:true, elsewhere:true },
      orders:[ { code:"LAB-330", name:"Newborn Screening Panel", price:320, ins:"approved", ordered:"10:40",
        branch:"AL RAYAN HOSPITAL", paid:true, via:"Cash", invoiceId:"INV-690221" } ],
      invoices:[{ id:"INV-690221", scope:"orders", at:"05 Sep 10:52", patient:73.60, company:294.40, deductible:64,
        paid:true, via:"Cash", payer:"NCCI · CLASS A", branch:"AL RAYAN HOSPITAL",
        rows:[{ name:"Newborn Screening Panel", code:"LAB-330",
          calc:{ gross:320, discount:0, net:320, deductible:64, patient:64, company:256, patientWithTax:73.60, companyWithTax:294.40 } }] }],
      bill:null, link:null, closed:true, prefs:{},
      history:[
        { at:"10:52", ic:"", tx:"<b>Orders paid</b> — SAR 73.60", sub:"Cash · invoice INV-690221 created · performed at AL RAYAN HOSPITAL",
          type:"PAYMENT", invoiceId:"INV-690221", amount:73.60, company:294.40, mode:"Cash", scope:"orders", by:"SAADAN SAAFAN" },
        { at:"10:40", ic:"i", tx:"<b>Visit received from AL RAYAN HOSPITAL</b>", sub:"1 order to be invoiced here",
          type:"INTERBRANCH", by:"System" }] }
  );
  cases.push(
    { id:13, mrn:"7000203", visitType:"Follow-up", clinic:"PAEDIATRICS", doctor:"LINA FAROUK", arrived:"09:50",
      date:"Today", sortKey:9003, payerId:"NCCI-A", dedUsed:0, parentId:12,
      consult:{ name:"Paediatric Follow-up", code:"CON-110", price:0, ins:"approved", paid:false },
      orders:[], invoices:[], bill:null, link:null, closed:false, prefs:{},
      history:[{ at:"09:50", ic:"i", tx:"<b>Visit created</b> at reception", sub:"Follow-up within 14 days · no consultation charge",
        type:"VISIT", by:"SAADAN SAAFAN" }] }
  );


  const BOOKED_1 = daysAhead(2), BOOKED_2 = daysAhead(6);
  cases.push(
    { id:30, mrn:"7000667", visitType:"Follow-up", clinic:"CARDIOLOGY", doctor:"AHMED AL SUBAIE", arrived:"10:30",
      date:BOOKED_1, future:true, sortKey:9500, payerId:"BUPA-GOLD", dedUsed:0,
      consult:{ name:"Cardiology Follow-up", code:"CON-205", price:150, priceIns:150, priceCash:130, ins:"pending", paid:false },
      orders:[], invoices:[], bill:null, link:null, closed:false, prefs:{},
      history:[{ at:"Booked", ic:"i", tx:`<b>Visit booked</b> for ${BOOKED_1} 10:30`, sub:"Follow-up · Cardiology · approval requested from BUPA",
        type:"VISIT", by:"SAADAN SAAFAN" }] },
    { id:31, mrn:"7000203", visitType:"Consultation", clinic:"PAEDIATRICS", doctor:"LINA FAROUK", arrived:"09:00",
      date:BOOKED_2, future:true, sortKey:9600, payerId:"NCCI-A", dedUsed:0,
      consult:{ name:"Paediatric Consultation", code:"CON-101", price:200, priceIns:200, priceCash:170, ins:"approved", paid:false },
      orders:[], invoices:[], bill:null, link:null, closed:false, prefs:{},
      history:[{ at:"Booked", ic:"i", tx:`<b>Visit booked</b> for ${BOOKED_2} 09:00`, sub:"Consultation · Paediatrics · NCCI approved in advance",
        type:"VISIT", by:"SAADAN SAAFAN" }] }
  );
  return { patients, cases };
}
