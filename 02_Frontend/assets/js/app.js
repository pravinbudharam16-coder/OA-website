const state = {
  streaming: false,
  capturing: false,
  hardwareConnected: false,
  hardwareDevice: null,
  hardwareCharacteristic: null,
  packetBuffer: "",
  sampleCount: 0,
  sensorQuality: {
    validSamples: 0,
    invalidSamples: 0,
    lastMissingFields: [],
    lastPacketAt: null,
  },
  tick: 0,
  history: Array.from({ length: 48 }, () => ({
    leftImu: 0,
    rightImu: 0,
    leftFsr: 0,
    rightFsr: 0,
  })),
  latest: {
    leftImu: 0,
    rightImu: 0,
    leftFsr: 0,
    rightFsr: 0,
    leftImuX: 0, leftImuY: 0, leftImuZ: 0,
    rightImuX: 0, rightImuY: 0, rightImuZ: 0,
    leftGyroX: 0, leftGyroY: 0, leftGyroZ: 0,
    rightGyroX: 0, rightGyroY: 0, rightGyroZ: 0,
    leftFsrVoltage: 0, rightFsrVoltage: 0,
  },
  risk: 0,
  intakeSubmitted: false,
  sensorSubmitted: false,
  occupationSubmitted: false,
  riskCompleted: false,
  reportSaved: false,
  intakeData: null,
  occupationData: null,
  healthWorker: null,
};

const els = {
  pageNav: document.querySelector("#pageNav"),
  pages: Array.from(document.querySelectorAll("[data-page]")),
  form: document.querySelector("#intakeForm"),
  patientId: document.querySelector("#patientId"),
  patientName: document.querySelector("#patientName"),
  age: document.querySelector("#age"),
  height: document.querySelector("#height"),
  weight: document.querySelector("#weight"),
  bmi: document.querySelector("#bmi"),
  gender: document.querySelector("#gender"),
  pain: document.querySelector("#pain"),
  mobility: document.querySelector("#mobility"),
  painDurationDays: document.querySelector("#painDurationDays"),
  intakeSubmitStatus: document.querySelector("#intakeSubmitStatus"),
  occupationSubmitStatus: document.querySelector("#occupationSubmitStatus"),
  riskScore: document.querySelector("#riskScore"),
  riskLevel: document.querySelector("#riskLevel"),
  riskSummary: document.querySelector("#riskSummary"),
  factorList: document.querySelector("#factorList"),
  meterValue: document.querySelector("#meterValue"),
  leftImu: document.querySelector("#leftImu"),
  rightImu: document.querySelector("#rightImu"),
  leftImuAxes: document.querySelector("#leftImuAxes"),
  rightImuAxes: document.querySelector("#rightImuAxes"),
  leftGyro: document.querySelector("#leftGyro"),
  rightGyro: document.querySelector("#rightGyro"),
  leftGyroAxes: document.querySelector("#leftGyroAxes"),
  rightGyroAxes: document.querySelector("#rightGyroAxes"),
  leftFsr: document.querySelector("#leftFsr"),
  rightFsr: document.querySelector("#rightFsr"),
  leftFsrMeta: document.querySelector("#leftFsrMeta"),
  rightFsrMeta: document.querySelector("#rightFsrMeta"),
  imuAccelChart: document.querySelector("#imuAccelChart"),
  imuGyroChart: document.querySelector("#imuGyroChart"),
  pressureChart: document.querySelector("#pressureChart"),
  startStream: document.querySelector("#startStream"),
  stopStream: document.querySelector("#stopStream"),
  exitStream: document.querySelector("#exitStream"),
  streamState: document.querySelector("#streamState"),
  resetSensors: document.querySelector("#resetSensors"),
  connectionLabel: document.querySelector("#connectionLabel"),
  clearReports: document.querySelector("#clearReports"),
  reportList: document.querySelector("#reportList"),
  fullReportPreview: document.querySelector("#fullReportPreview"),
  dbTableBody: document.querySelector("#dbTableBody"),
  dbRecordCount: document.querySelector("#dbRecordCount"),
  previewPatient: document.querySelector("#previewPatient"),
  previewRisk: document.querySelector("#previewRisk"),
  previewLevel: document.querySelector("#previewLevel"),
  previewOccupation: document.querySelector("#previewOccupation"),
  saveReportInline: document.querySelector("#saveReportInline"),
  occupationForm: document.querySelector("#occupationForm"),
  occupationType: document.querySelector("#occupationType"),
  standingHours: document.querySelector("#standingHours"),
  liftingFreq: document.querySelector("#liftingFreq"),
  repetitiveMovements: document.querySelector("#repetitiveMovements"),
  occupationSummary: document.querySelector("#occupationSummary"),
  occupationFactors: document.querySelector("#occupationFactors"),
  workerName: document.querySelector("#workerName"),
  workerRole: document.querySelector("#workerRole"),
  logoutButton: document.querySelector("#logoutButton"),
  notificationButton: document.querySelector("#notificationButton"),
  notificationBar: document.querySelector("#notificationBar"),
  notificationClose: document.querySelector("#notificationClose"),
  notificationText: document.querySelector("#notificationText"),
  notificationIcon: document.querySelector(".notification-icon"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsPopover: document.querySelector("#settingsPopover"),
  settingsWorkerName: document.querySelector("#settingsWorkerName"),
  settingsLogout: document.querySelector("#settingsLogout"),
  oaMarkerSource: document.querySelector("#oaMarkerSource"),
  oaMarkerRisk: document.querySelector("#oaMarkerRisk"),
  oaMarkerRiskMeta: document.querySelector("#oaMarkerRiskMeta"),
  kneeRiskStage: document.querySelector("#kneeRiskStage"),
  kneeMarkerTitle: document.querySelector("#kneeMarkerTitle"),
  kneeMarkerDetail: document.querySelector("#kneeMarkerDetail"),
  kneeMarkerEyebrow: document.querySelector("#kneeMarkerEyebrow"),
  sensorPlacementStage: document.querySelector("#sensorPlacementStage"),
  sensorPlacementType: document.querySelector("#sensorPlacementType"),
  sensorPlacementTitle: document.querySelector("#sensorPlacementTitle"),
  sensorPlacementHint: document.querySelector("#sensorPlacementHint"),
  sensorDetailLabel: document.querySelector("#sensorDetailLabel"),
  sensorDetailName: document.querySelector("#sensorDetailName"),
  sensorDetailValue: document.querySelector("#sensorDetailValue"),
  sensorDetailText: document.querySelector("#sensorDetailText"),
  recentScreenings: document.querySelector("#recentScreenings"),
  overviewScreeningCount: document.querySelector("#overviewScreeningCount"),
  overviewLatestRisk: document.querySelector("#overviewLatestRisk"),
  overviewLatestRiskMeta: document.querySelector("#overviewLatestRiskMeta"),
  overviewSensorStatus: document.querySelector("#overviewSensorStatus"),
  overviewSensorMeta: document.querySelector("#overviewSensorMeta"),
  overviewWorkflow: document.querySelector("#overviewWorkflow"),
  overviewWorkflowMeta: document.querySelector("#overviewWorkflowMeta"),
  workflowPercent: document.querySelector("#workflowPercent"),
  workflowProgress: document.querySelector("#workflowProgress"),
};

const dbName = "smartoa-reports";
const storeName = "reports";
const dbVersion = 9;
const storageFallbackKey = "smartoa-report-fallback";
const notificationStorageKey = "smartoa-latest-notification";
const notificationLifetimeMs = 24 * 60 * 60 * 1000;

function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function ensureAuthenticated() {
  try {
    const response = await fetch("/api/session", { credentials: "same-origin", cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      state.healthWorker = data.user;
      localStorage.setItem("smartoa-health-worker", JSON.stringify(data.user));
      return true;
    }
    if (response.status === 401) {
      localStorage.removeItem("smartoa-health-worker");
      window.location.replace("/login.html");
      return false;
    }
  } catch (_) {
    // Offline mode: allow the healthcare worker who has already authenticated on this device.
    try {
      const cached = JSON.parse(localStorage.getItem("smartoa-health-worker") || "null");
      if (cached?.username && cached?.role === "Healthcare Worker") {
        state.healthWorker = cached;
        return true;
      }
    } catch (_) {}
  }
  window.location.replace("/login.html");
  return false;
}

function renderWorkerIdentity() {
  if (!state.healthWorker) return;
  els.workerName.textContent = state.healthWorker.displayName || state.healthWorker.username;
  els.workerRole.textContent = `${state.healthWorker.role || "Healthcare Worker"} · ${state.healthWorker.username}`;
  if (els.settingsWorkerName) els.settingsWorkerName.textContent = state.healthWorker.displayName || state.healthWorker.username;
}

async function logout() {
  try {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
  } catch (_) {}
  localStorage.removeItem("smartoa-health-worker");
  window.location.replace("/login.html");
}

function validateElements() {
  const missing = [];
  for (const [key, element] of Object.entries(els)) {
    if (!element) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing required DOM elements: ${missing.join(", ")}`);
  }
}

const routes = {
  overview: {
    title: "Overview",
    eyebrow: "SmartOA offline screening",
  },
  intake: {
    title: "Patient intake and clinical context",
    eyebrow: "",
  },
  screening: {
    title: "Combined OA screening result",
    eyebrow: "",
  },
  sensors: {
    title: "Live ESP32 sensor telemetry",
    eyebrow: "MPU6050 and FSR monitoring",
  },
  occupation: {
    title: "Occupational risk assessment",
    eyebrow: "Work activity impact analysis",
  },
  reports: {
    title: "Offline patient report history",
    eyebrow: "",
  },
};

function openDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(dbName, dbVersion);
    request.onupgradeneeded = () => {
      const db = request.result;
      let store;
      if (!db.objectStoreNames.contains(storeName)) {
        store = db.createObjectStore(storeName, { keyPath: "id" });
      } else {
        store = request.transaction.objectStore(storeName);
      }

      // Migrate existing records forward without deleting local data.
      if (request.oldVersion < 9) {
        const cursorRequest = store.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const record = cursor.value || {};
          const sensors = record.sensors || {};
          const occupationRiskValue =
            typeof record.occupationRisk === "number"
              ? record.occupationRisk
              : typeof record.occupationRisk?.totalScore === "number"
                ? record.occupationRisk.totalScore
                : "Not recorded";

          const upgraded = {
            ...record,
            schemaVersion: 9,
            dateTime: record.dateTime || new Date(record.createdAt || Date.now()).toISOString(),
            patientId: record.patientId || "Not recorded",
            patientName: record.patientName || "Not recorded",
            healthcareWorkerId: record.healthcareWorkerId || "Not recorded",
            healthcareWorkerName: record.healthcareWorkerName || "Not recorded",
            healthcareWorkerRole: record.healthcareWorkerRole || "Healthcare Worker",
            age: record.age ?? "Not recorded",
            height: record.height ?? "Not recorded",
            weight: record.weight ?? "Not recorded",
            bmi: record.bmi ?? "Not recorded",
            gender: record.gender ?? "Not recorded",
            kneePain: record.kneePain || "Not recorded",
            kneePainScore: record.kneePainScore ?? "Not recorded",
            painDurationDays: record.painDurationDays ?? "Not recorded",
            morningStiffness: record.morningStiffness || "Not recorded",
            morningStiffnessScore: record.morningStiffnessScore ?? "Not recorded",
            mobilityIssue: record.mobilityIssue || "Not recorded",
            mobilityIssueScore: record.mobilityIssueScore ?? "Not recorded",
            occupation: record.occupation || "Not recorded",
            occupationRisk: occupationRiskValue,
            occupationRiskLevel: record.occupationRiskLevel || "Not recorded",
            oaRisk: record.oaRisk || record.level || "Not recorded",
            oaRiskScore: record.oaRiskScore ?? record.score ?? "Not recorded",
            level: record.level || record.oaRisk || "Not recorded",
            score: record.score ?? record.oaRiskScore ?? "Not recorded",
            leftImu: record.leftImu ?? sensors.leftImu ?? null,
            rightImu: record.rightImu ?? sensors.rightImu ?? null,
            leftFsr: record.leftFsr ?? sensors.leftFsr ?? null,
            rightFsr: record.rightFsr ?? sensors.rightFsr ?? null,
            leftGyroX: record.leftGyroX ?? sensors.leftGyroX ?? 0,
            leftGyroY: record.leftGyroY ?? sensors.leftGyroY ?? 0,
            leftGyroZ: record.leftGyroZ ?? sensors.leftGyroZ ?? 0,
            rightGyroX: record.rightGyroX ?? sensors.rightGyroX ?? 0,
            rightGyroY: record.rightGyroY ?? sensors.rightGyroY ?? 0,
            rightGyroZ: record.rightGyroZ ?? sensors.rightGyroZ ?? 0,
            sensors: {
              ...sensors,
              leftImu: record.leftImu ?? sensors.leftImu ?? null,
              rightImu: record.rightImu ?? sensors.rightImu ?? null,
              leftFsr: record.leftFsr ?? sensors.leftFsr ?? null,
              rightFsr: record.rightFsr ?? sensors.rightFsr ?? null,
              leftGyroX: record.leftGyroX ?? sensors.leftGyroX ?? 0,
              leftGyroY: record.leftGyroY ?? sensors.leftGyroY ?? 0,
              leftGyroZ: record.leftGyroZ ?? sensors.leftGyroZ ?? 0,
              rightGyroX: record.rightGyroX ?? sensors.rightGyroX ?? 0,
              rightGyroY: record.rightGyroY ?? sensors.rightGyroY ?? 0,
              rightGyroZ: record.rightGyroZ ?? sensors.rightGyroZ ?? 0,
            },
            storage: "IndexedDB",
          };
          cursor.update(upgraded);
          cursor.continue();
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveReport(report) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(report);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    try {
      const reports = JSON.parse(localStorage.getItem(storageFallbackKey) || "[]");
      const nextReports = [report, ...reports.filter((item) => item.id !== report.id)];
      localStorage.setItem(storageFallbackKey, JSON.stringify(nextReports));
    } catch (parseError) {
      localStorage.setItem(storageFallbackKey, JSON.stringify([report]));
    }
    return undefined;
  }
}

async function getReports() {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.openCursor();
      const records = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          records.sort((a, b) => {
            const aTime = new Date(a.dateTime || a.createdAt || 0).getTime() || 0;
            const bTime = new Date(b.dateTime || b.createdAt || 0).getTime() || 0;
            return bTime - aTime;
          });
          resolve(records);
          return;
        }
        records.push(cursor.value);
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    try {
      const stored = JSON.parse(localStorage.getItem(storageFallbackKey) || "[]");
      return Array.isArray(stored) ? stored.sort((a, b) => {
        const aTime = new Date(a.dateTime || a.createdAt || 0).getTime() || 0;
        const bTime = new Date(b.dateTime || b.createdAt || 0).getTime() || 0;
        return bTime - aTime;
      }) : [];
    } catch (parseError) {
      return [];
    }
  }
}

async function recoverLegacyReports() {
  const recovered = [];
  const seen = new Set();
  const looksLikeReport = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    return Boolean(value.patientId || value.patientName) && Boolean(
      value.oaRisk || value.level || value.oaRiskScore !== undefined || value.score !== undefined || value.kneePain !== undefined
    );
  };
  const add = (value) => {
    const list = Array.isArray(value) ? value : [value];
    for (const item of list) {
      if (!looksLikeReport(item)) continue;
      const key = String(item.id || `${item.patientId}|${item.dateTime || item.createdAt || ""}`);
      if (seen.has(key)) continue;
      seen.add(key);
      recovered.push({
        ...item,
        id: item.id || generateId(),
        schemaVersion: 9,
        storage: "IndexedDB",
        sensors: item.sensors || {
          leftImu: item.leftImu ?? 0,
          rightImu: item.rightImu ?? 0,
          leftFsr: item.leftFsr ?? 0,
          rightFsr: item.rightFsr ?? 0,
          leftGyroX: item.leftGyroX ?? 0,
          leftGyroY: item.leftGyroY ?? 0,
          leftGyroZ: item.leftGyroZ ?? 0,
          rightGyroX: item.rightGyroX ?? 0,
          rightGyroY: item.rightGyroY ?? 0,
          rightGyroZ: item.rightGyroZ ?? 0,
        },
      });
    }
  };

  // Recover report arrays from localStorage used by older offline fallback builds.
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      const raw = localStorage.getItem(key);
      if (!raw || raw.length > 2_000_000) continue;
      try { add(JSON.parse(raw)); } catch (_) {}
    }
  } catch (_) {}

  // Recover records from older IndexedDB databases/stores when the browser still has them.
  if (typeof indexedDB.databases === "function") {
    try {
      const databases = await indexedDB.databases();
      for (const info of databases) {
        if (!info?.name || info.name === dbName) continue;
        await new Promise((resolve) => {
          let request;
          try { request = indexedDB.open(info.name); } catch (_) { resolve(); return; }
          request.onerror = () => resolve();
          request.onsuccess = () => {
            const db = request.result;
            const stores = Array.from(db.objectStoreNames);
            if (!stores.length) { db.close(); resolve(); return; }
            let pending = stores.length;
            for (const storeNameCandidate of stores) {
              let tx;
              try { tx = db.transaction(storeNameCandidate, "readonly"); } catch (_) { if (--pending === 0) { db.close(); resolve(); } continue; }
              const req = tx.objectStore(storeNameCandidate).openCursor();
              req.onsuccess = () => {
                const cursor = req.result;
                if (!cursor) { if (--pending === 0) { db.close(); resolve(); } return; }
                add(cursor.value);
                cursor.continue();
              };
              req.onerror = () => { if (--pending === 0) { db.close(); resolve(); } };
            }
          };
        });
      }
    } catch (_) {}
  }

  if (!recovered.length) return 0;
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      for (const report of recovered) store.put(report);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Recovery transaction aborted"));
    });
  } catch (_) {}
  return recovered.length;
}

async function clearReports() {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    localStorage.removeItem(storageFallbackKey);
  }
}


const LANGUAGE_KEY = "smartoa-language";
const workflowSteps = [
  { route: "intake", key: "intake" },
  { route: "sensors", key: "sensors" },
  { route: "occupation", key: "occupation" },
  { route: "screening", key: "risk" },
  { route: "reports", key: "report" },
];

const translations = {
  en: {
    nav: { overview:"Overview", intake:"Patient Intake", sensors:"Sensors", occupation:"Occupation", risk:"Risk Result", reports:"Reports" },
    module: { overview:"Overview", intake:"Patient Intake", sensors:"Sensors", occupation:"Occupation", screening:"Risk Result", reports:"Reports" },
    eyebrow: { overview:"Healthcare worker dashboard", intake:"Patient assessment", sensors:"Movement & loading", occupation:"Risk context", screening:"AI-assisted analysis", reports:"Saved screening records" },
    progress:"Screening progress", step:"Step", of:"of", complete:"complete", current:"Current", done:"Done",
    settings:"Settings", worker:"Healthcare worker", mode:"Mode: Offline-first", language:"Language", logout:"Logout",
    buttons:{ start:"Start", stop:"Stop", exit:"Exit", reset:"Reset readings", submitPatient:"Submit patient information", submitOccupation:"Submit occupation information", save:"Save & Download PDF report", clear:"Clear", viewAll:"View all →" },
    intake:{ context:"Clinical context", required:"Required inputs", id:"Patient ID", name:"Patient Name", age:"Age", height:"Height (cm)",weight:"Weight (kg)",bmi:"BMI (calculated)",gender:"Gender",pain:"Knee pain", painDuration:"Pain duration (days)", mobility:"Mobility limit", selectPain:"Select pain level", selectMobility:"Select mobility issue" },
    sensors:{ placement:"Sensor placement", setup:"2 IMU + 2 FSR • Shank + Insole", telemetry:"Live telemetry", movement:"Movement and loading", note:"Connect the physical ESP32/BLE hardware to capture real sensor readings." },
    occupation:{ activity:"Work activity", assessment:"Occupation assessment", type:"Occupation type", standing:"Daily standing hours", lifting:"Lifting frequency", repetitive:"Repetitive movements", impact:"Occupational impact" },
    risk:{ result:"Screening result", summary:"Combining symptoms, BMI, gait asymmetry, foot loading imbalance and occupation." },
    reports:{ saved:"Saved reports", records:"Patient records", preview:"Report preview", current:"Current screening", date:"Date & Time", patient:"Patient", riskScore:"Risk score", status:"Status", occupation:"Occupation" },
    overview:{ history:"History", recent:"Recent Screening", start:"Start new screening", workflow:"Screening workflow", workflowHint:"Move through the modules in order" }
  },
  as: {
    nav:{ overview:"সাৰাংশ", intake:"ৰোগীৰ তথ্য", sensors:"চেন্সৰ", occupation:"পেছা", risk:"ঝুঁকিৰ ফলাফল", reports:"প্ৰতিবেদন" },
    module:{ overview:"সাৰাংশ", intake:"ৰোগীৰ তথ্য", sensors:"চেন্সৰ", occupation:"পেছা", screening:"ঝুঁকিৰ ফলাফল", reports:"প্ৰতিবেদন" },
    eyebrow:{ overview:"স্বাস্থ্যকৰ্মীৰ ডেশ্বব'ৰ্ড", intake:"ৰোগীৰ মূল্যায়ন", sensors:"চলন আৰু চাপ", occupation:"ঝুঁকিৰ প্ৰসংগ", screening:"AI-সহায়ক বিশ্লেষণ", reports:"সংৰক্ষিত স্ক্ৰিনিং ৰেকৰ্ড" },
    progress:"স্ক্ৰিনিং অগ্ৰগতি", step:"ধাপ", of:"ৰ", complete:"সম্পূৰ্ণ", current:"বৰ্তমান", done:"সম্পূৰ্ণ", settings:"ছেটিংছ", worker:"স্বাস্থ্যকৰ্মী", mode:"ম'ড: অফলাইন-প্ৰথম", language:"ভাষা", logout:"লগআউট",
    buttons:{ start:"আৰম্ভ", stop:"বন্ধ", exit:"বাহিৰ", reset:"পঢ়া মান ৰিছেট", submitPatient:"ৰোগীৰ তথ্য দাখিল", submitOccupation:"পেছাৰ তথ্য দাখিল", save:"সংৰক্ষণ আৰু PDF ডাউনলোড", clear:"মচক", viewAll:"সকলো চাওক →" },
    intake:{ context:"ক্লিনিকেল তথ্য", required:"প্ৰয়োজনীয় তথ্য", id:"ৰোগী ID", name:"ৰোগীৰ নাম", age:"বয়স", height:"Height (cm)",weight:"Weight (kg)",bmi:"BMI (calculated)",gender:"Gender",pain:"হাঁুৰ বিষ", painDuration:"বিষৰ সময়কাল (দিন)", mobility:"চলাচল সীমাবদ্ধতা", selectPain:"বিষৰ স্তৰ বাছক", selectMobility:"চলাচল সমস্যা বাছক" },
    sensors:{ placement:"চেন্সৰ স্থাপন", setup:"২ IMU + ২ FSR ছেটআপ", telemetry:"লাইভ টেলিমেট্ৰি", movement:"চলন আৰু চাপ", note:"ভৌতিক ESP32/BLE হাৰ্ডৱেৰ সংযোগ কৰি বাস্তৱ চেন্সৰ ৰিডিং লওক।" },
    occupation:{ activity:"কৰ্ম কাৰ্যকলাপ", assessment:"পেছাৰ মূল্যায়ন", type:"পেছাৰ ধৰণ", standing:"দৈনিক থিয় হৈ থকা ঘণ্টা", lifting:"ভাৰ তোলাৰ সঘনতা", repetitive:"পুনৰাবৃত্তিমূলক চলন", impact:"পেছাগত প্ৰভাৱ" },
    risk:{ result:"স্ক্ৰিনিং ফলাফল", summary:"লক্ষণ, BMI, খোজৰ অসমতা, ভৰিৰ চাপ আৰু পেছা একেলগে বিশ্লেষণ কৰা হৈছে।" },
    reports:{ saved:"সংৰক্ষিত প্ৰতিবেদন", records:"ৰোগীৰ ৰেকৰ্ড", preview:"প্ৰতিবেদন পূৰ্বদৰ্শন", current:"বৰ্তমান স্ক্ৰিনিং", date:"তাৰিখ আৰু সময়", patient:"ৰোগী", riskScore:"ঝুঁকি স্ক'ৰ", status:"অৱস্থা", occupation:"পেছা" },
    overview:{ history:"ইতিহাস", recent:"শেহতীয়া স্ক্ৰিনিং", start:"নতুন স্ক্ৰিনিং আৰম্ভ", workflow:"স্ক্ৰিনিং ধাপ", workflowHint:"ধাপসমূহ ক্ৰম অনুসৰি সম্পূৰ্ণ কৰক" }
  },
  bn: {
    nav:{ overview:"ওভারভিউ", intake:"রোগীর তথ্য", sensors:"সেন্সর", occupation:"পেশা", risk:"ঝুঁকির ফলাফল", reports:"রিপোর্ট" },
    module:{ overview:"ওভারভিউ", intake:"রোগীর তথ্য", sensors:"সেন্সর", occupation:"পেশা", screening:"ঝুঁকির ফলাফল", reports:"রিপোর্ট" },
    eyebrow:{ overview:"স্বাস্থ্যকর্মী ড্যাশবোর্ড", intake:"রোগী মূল্যায়ন", sensors:"চলন ও চাপ", occupation:"ঝুঁকির প্রসঙ্গ", screening:"AI-সহায়ক বিশ্লেষণ", reports:"সংরক্ষিত স্ক্রিনিং রেকর্ড" },
    progress:"স্ক্রিনিং অগ্রগতি", step:"ধাপ", of:"এর", complete:"সম্পূর্ণ", current:"বর্তমান", done:"সম্পন্ন", settings:"সেটিংস", worker:"স্বাস্থ্যকর্মী", mode:"মোড: অফলাইন-প্রথম", language:"ভাষা", logout:"লগআউট",
    buttons:{ start:"শুরু", stop:"বন্ধ", exit:"বেরিয়ে যান", reset:"রিডিং রিসেট", submitPatient:"রোগীর তথ্য জমা দিন", submitOccupation:"পেশার তথ্য জমা দিন", save:"সংরক্ষণ ও PDF ডাউনলোড", clear:"মুছুন", viewAll:"সব দেখুন →" },
    intake:{ context:"ক্লিনিক্যাল তথ্য", required:"প্রয়োজনীয় তথ্য", id:"রোগী ID", name:"রোগীর নাম", age:"বয়স", height:"Height (cm)",weight:"Weight (kg)",bmi:"BMI (calculated)",gender:"Gender",pain:"হাঁটুর ব্যথা", painDuration:"ব্যথার সময়কাল (দিন)", mobility:"চলাচলের সীমাবদ্ধতা", selectPain:"ব্যথার মাত্রা নির্বাচন করুন", selectMobility:"চলাচলের সমস্যা নির্বাচন করুন" },
    sensors:{ placement:"সেন্সর স্থাপন", setup:"২ IMU + ২ FSR সেটআপ", telemetry:"লাইভ টেলিমেট্রি", movement:"চলন ও চাপ", note:"ভৌত ESP32/BLE হার্ডওয়্যার সংযুক্ত করে বাস্তব সেন্সর রিডিং নিন।" },
    occupation:{ activity:"কাজের কার্যকলাপ", assessment:"পেশা মূল্যায়ন", type:"পেশার ধরন", standing:"প্রতিদিন দাঁড়িয়ে থাকার ঘণ্টা", lifting:"ভার তোলার হার", repetitive:"পুনরাবৃত্ত চলন", impact:"পেশাগত প্রভাব" },
    risk:{ result:"স্ক্রিনিং ফলাফল", summary:"উপসর্গ, BMI, হাঁটার অসমতা, পায়ের চাপের ভারসাম্যহীনতা ও পেশা একত্রে বিশ্লেষণ করা হচ্ছে।" },
    reports:{ saved:"সংরক্ষিত রিপোর্ট", records:"রোগীর রেকর্ড", preview:"রিপোর্ট পূর্বরূপ", current:"বর্তমান স্ক্রিনিং", date:"তারিখ ও সময়", patient:"রোগী", riskScore:"ঝুঁকি স্কোর", status:"অবস্থা", occupation:"পেশা" },
    overview:{ history:"ইতিহাস", recent:"সাম্প্রতিক স্ক্রিনিং", start:"নতুন স্ক্রিনিং শুরু", workflow:"স্ক্রিনিং ধাপ", workflowHint:"ধাপগুলো ক্রমানুসারে সম্পূর্ণ করুন" }
  },
  brx: { nav:{overview:"फिननाय",intake:"हाब्रि फोरों",sensors:"सेन्सर",occupation:"थाखाय",risk:"रिस्क रिजाल्ट",reports:"रिपोर्ट"}, module:{overview:"फिननाय",intake:"हाब्रि फोरों",sensors:"सेन्सर",occupation:"थाखाय",screening:"रिस्क रिजाल्ट",reports:"रिपोर्ट"}, eyebrow:{overview:"हेल्थकेयर वर्कार डेशबोर्ड",intake:"हाब्रि मुल्यायन",sensors:"जायगा आरो लोडिं",occupation:"रिस्क संदर्भ",screening:"AI साहाज्य विश्लेषण",reports:"सेभ स्क्रिनिं रेकर्ड"}, progress:"स्क्रिनिं प्रोग्रेस",step:"स्टेप",of:"नि",complete:"फुरा",current:"दानो",done:"फुरा",settings:"सेटिंग",worker:"हेल्थकेयर वर्कार",mode:"मोड: अफलाइन-फोरों",language:"राव",logout:"लॉगआउट",buttons:{start:"जागाय",stop:"बन्द",exit:"बाहेर",reset:"रीडिंग रिसेट",submitPatient:"हाब्रि फोरों दाथाय",submitOccupation:"थाखाय दाथाय",save:"सेभ आरो PDF डाउनलोड",clear:"खालाम",viewAll:"गासै नाय →"},intake:{context:"क्लिनिकल फोरों",required:"जरुरी फोरों",id:"हाब्रि ID",name:"हाब्रि मुं",age:"बयस",height:"Height (cm)",weight:"Weight (kg)",bmi:"BMI (calculated)",gender:"Gender",pain:"जानु दुखु",painDuration:"दुखु सम (दिन)",mobility:"नावजाबाय सीमाय",selectPain:"दुखु लेभेल सायख",selectMobility:"नावजाबाय समस्या सायख"},sensors:{placement:"सेन्सर जायगा",setup:"2 IMU + 2 FSR सेटअप",telemetry:"लाइभ टेलिमेट्री",movement:"नावजाबाय आरो लोडिं",note:"फिजिकल ESP32/BLE हार्डवेर जाबाय रियल सेन्सर रिडिंग लाबो।"},occupation:{activity:"खामानि",assessment:"थाखाय मुल्यायन",type:"थाखाय रोखोम",standing:"दिनै थांनाय घण्टा",lifting:"बोझा लाबनाय सघनता",repetitive:"दोहोरायनाय नावजाबाय",impact:"थाखाय असर"},risk:{result:"स्क्रिनिं रिजाल्ट",summary:"लक्षण, BMI, गैत असमाय, फराय लोडिं आरो थाखाय एकलोगे विश्लेषण।"},reports:{saved:"सेभ रिपोर्ट",records:"हाब्रि रेकर्ड",preview:"रिपोर्ट नाय",current:"दानो स्क्रिनिं",date:"दिन आरो सम",patient:"हाब्रि",riskScore:"रिस्क स्कोर",status:"अवस्था",occupation:"थाखाय"},overview:{history:"जिरायती",recent:"दानो स्क्रिनिं",start:"नोगोर स्क्रिनिं जागाय",workflow:"स्क्रिनिं स्टेप",workflowHint:"स्टेप फोरों गोनांनाय"}},
  mni: { nav:{overview:"ꯃꯈꯥ ꯑꯣꯏꯕ",intake:"ꯂꯩꯄꯥꯛ ꯂꯣꯏꯁꯤꯟ",sensors:"ꯁꯦꯟꯁꯔ",occupation:"ꯊꯧꯔꯥꯡ",risk:"ꯔꯤꯁ꯭ꯀ ꯔꯤꯖꯜꯇ",reports:"ꯔꯤꯄꯣꯔꯠ"}, module:{overview:"ꯃꯈꯥ ꯑꯣꯏꯕ",intake:"ꯂꯩꯄꯥꯛ ꯂꯣꯏꯁꯤꯟ",sensors:"ꯁꯦꯟꯁꯔ",occupation:"ꯊꯧꯔꯥꯡ",screening:"ꯔꯤꯁ꯭ꯀ ꯔꯤꯖꯜꯇ",reports:"ꯔꯤꯄꯣꯔꯠ"}, eyebrow:{overview:"ꯍꯦꯜꯊꯀꯦꯔ ꯋꯥꯔꯀꯔ ꯗꯦꯁꯕꯣꯔꯗ",intake:"ꯂꯩꯄꯥꯛ ꯃꯇꯦꯡ",sensors:"ꯃꯥꯔꯣꯜ ꯑꯃꯁꯨꯡ ꯂꯣꯗꯤꯡ",occupation:"ꯔꯤꯁ꯭ꯀ ꯄꯥꯡꯊꯣꯛ",screening:"AI-ꯆꯥꯡꯁꯤꯟꯕ ꯑꯦꯅꯥꯂꯥꯏꯁꯤꯁ",reports:"ꯁꯦꯚ ꯆꯦꯛꯀꯤꯡ ꯔꯦꯀꯣꯔꯗ"}, progress:"ꯆꯦꯛꯀꯤꯡ ꯄ꯭ꯔꯣꯒ꯭ꯔꯦꯁ",step:"ꯁ꯭ꯇꯦꯞ",of:"ꯒꯤ",complete:"ꯂꯣꯏꯁꯤꯜꯂꯕ",current:"ꯍꯧꯖꯤꯛ",done:"ꯂꯣꯏꯁꯤꯜꯂꯕ",settings:"ꯁꯦꯇꯤꯡ",worker:"ꯍꯦꯜꯊꯀꯦꯔ ꯋꯥꯔꯀꯔ",mode:"ꯃꯣꯗ: ꯑꯣꯐꯂꯥꯏꯟ",language:"ꯂꯣꯟ",logout:"ꯂꯣꯒꯑꯥꯎꯠ",buttons:{start:"ꯍꯧꯖꯤꯟꯕ",stop:"ꯂꯣꯏꯁꯤꯟꯕ",exit:"ꯅꯣꯡꯃꯥ",reset:"ꯔꯤꯗꯤꯡ ꯔꯤꯁꯦꯠ",submitPatient:"ꯂꯩꯄꯥꯛ ꯐꯣꯔꯣꯝ ꯄꯤꯕ",submitOccupation:"ꯊꯧꯔꯥꯡ ꯐꯣꯔꯣꯝ ꯄꯤꯕ",save:"ꯁꯦꯚ ꯑꯃꯁꯨꯡ PDF ꯗꯥꯎꯅꯂꯣꯗ",clear:"ꯂꯣꯏꯁꯤꯟꯕ",viewAll:"ꯄꯨꯝꯕ ꯎꯅꯕ →"}, intake:{context:"ꯀ꯭ꯂꯤꯅꯤꯀꯦꯜ ꯐꯣꯔꯣꯝ",required:"ꯃꯇꯨꯡ ꯄꯥꯡꯊꯣꯛꯄ ꯐꯣꯔꯣꯝ",id:"ꯂꯩꯄꯥꯛ ID",name:"ꯂꯩꯄꯥꯛ ꯃꯤꯡ",age:"ꯊꯧ",height:"Height (cm)",weight:"Weight (kg)",bmi:"BMI (calculated)",gender:"Gender",pain:"ꯅꯨꯡꯁꯤ ꯂꯣꯟ",painDuration:"ꯅꯨꯡꯁꯤ ꯃꯇꯥꯡ (ꯅꯨꯃꯤꯠ)",mobility:"ꯃꯥꯔꯣꯜ ꯂꯣꯏꯁꯤꯟꯕ",selectPain:"ꯅꯨꯡꯁꯤ ꯂꯦꯚꯦꯜ ꯁꯥꯏꯈ",selectMobility:"ꯃꯥꯔꯣꯜ ꯁꯥꯏꯈ"}, sensors:{placement:"ꯁꯦꯟꯁꯔ ꯑꯃꯁꯨꯡ ꯊꯝꯄ",setup:"2 IMU + 2 FSR ꯁꯦꯠꯑꯞ",telemetry:"ꯂꯥꯏꯚ ꯇꯦꯂꯤꯃꯦꯇ꯭ꯔꯤ",movement:"ꯃꯥꯔꯣꯜ ꯑꯃꯁꯨꯡ ꯂꯣꯗꯤꯡ",note:"ꯐꯤꯖꯤꯀꯦꯜ ESP32/BLE ꯍꯥꯔꯗꯋꯦꯔ ꯁꯝꯖꯤꯟꯅꯥ ꯔꯤꯌꯦꯜ ꯁꯦꯟꯁꯔ ꯔꯤꯗꯤꯡ ꯂꯧꯕꯤꯌꯨ।"}, occupation:{activity:"ꯊꯧꯔꯥꯡ",assessment:"ꯊꯧꯔꯥꯡ ꯃꯇꯦꯡ",type:"ꯊꯧꯔꯥꯡ ꯃꯈꯥ",standing:"ꯅꯨꯃꯤꯠ ꯁꯤꯡꯖꯤꯟꯕ ꯄꯨꯡ",lifting:"ꯂꯥꯡꯕ ꯁꯥꯏꯅꯕ",repetitive:"ꯑꯃꯁꯨꯡ ꯑꯃꯁꯨꯡ ꯍꯥꯡꯕ",impact:"ꯊꯧꯔꯥꯡ ꯑꯁꯤ"}, risk:{result:"ꯆꯦꯛꯀꯤꯡ ꯔꯤꯖꯜꯇ",summary:"ꯁꯤꯝꯇꯣꯝ, BMI, ꯆꯥꯡꯁꯤꯟ ꯑꯁꯝꯕ, ꯐꯨꯠ ꯂꯣꯗꯤꯡ ꯑꯃꯁꯨꯡ ꯊꯧꯔꯥꯡ ꯄꯨꯝꯅꯃꯛ ꯑꯦꯅꯥꯂꯥꯏꯁꯤꯁ ꯇꯧꯏ"}, reports:{saved:"ꯁꯦꯚ ꯔꯤꯄꯣꯔꯠ",records:"ꯂꯩꯄꯥꯛ ꯔꯦꯀꯣꯔꯗ",preview:"ꯔꯤꯄꯣꯔꯠ ꯎꯠꯄ",current:"ꯍꯧꯖꯤꯛ ꯆꯦꯛꯀꯤꯡ",date:"ꯇꯥꯔꯤꯈ ꯑꯃꯁꯨꯡ ꯃꯇꯝ",patient:"ꯂꯩꯄꯥꯛ",riskScore:"ꯔꯤꯁ꯭ꯀ ꯁ꯭ꯀꯣꯔ",status:"ꯁ꯭ꯇꯦꯇꯁ",occupation:"ꯊꯧꯔꯥꯡ"}, overview:{history:"ꯍꯤꯁꯇꯔꯤ",recent:"ꯅꯨꯡꯉꯥꯏ ꯆꯦꯛꯀꯤꯡ",start:"ꯑꯅꯧꯕ ꯆꯦꯛꯀꯤꯡ ꯍꯧꯖꯤꯟꯕ",workflow:"ꯆꯦꯛꯀꯤꯡ ꯁ꯭ꯇꯦꯞ",workflowHint:"ꯁ꯭ꯇꯦꯞ ꯄꯨꯝꯅꯃꯛ ꯑꯅꯨꯕꯥ ꯆꯠꯂꯨ"}},
  kha: { nav:{overview:"Kyndon",intake:"Ka jingtip u nongpang",sensors:"Ki sensor",occupation:"Kamai",risk:"Ka jingmih jong ka jingma",reports:"Ki report"}, module:{overview:"Kyndon",intake:"Ka jingtip u nongpang",sensors:"Ki sensor",occupation:"Kamai",screening:"Ka jingmih jong ka jingma",reports:"Ki report"}, eyebrow:{overview:"Dashboard jong u nongtrei ka koit ka khiah",intake:"Ka jingbishar nongpang",sensors:"Ka jingïaid bad ka jingkit",occupation:"Ka jingma ha ka kam",screening:"Ka jingbishar AI",reports:"Ki record ba la buh"}, progress:"Ka jingïaid shaphrang",step:"Step",of:"na",complete:"la dep",current:"mynta",done:"la dep",settings:"Ki settings",worker:"Nongtrei ka koit ka khiah",mode:"Mode: Offline",language:"Ktien",logout:"Log out",buttons:{start:"Sdang",stop:"Pynsangeh",exit:"Exit",reset:"Reset readings",submitPatient:"Buhrieh jingtip nongpang",submitOccupation:"Buhrieh jingtip kamai",save:"Buh bad download PDF",clear:"Pynkhuid",viewAll:"Peit lut →"},intake:{context:"Ka jingtip klinikal",required:"Ki jingtip ba donkam",id:"Patient ID",name:"Ka kyrteng",age:"Rta",height:"Height (cm)",weight:"Weight (kg)",bmi:"BMI (calculated)",gender:"Gender",pain:"Ka jingpang khoh",painDuration:"Por ka jingpang (ki sngi)",mobility:"Ka jingeh jingïaid",selectPain:"Jied ka jingïa pang",selectMobility:"Jied ka jingeh jingïaid"},sensors:{placement:"Ka jaka sensor",setup:"2 IMU + 2 FSR",telemetry:"Live telemetry",movement:"Ïaid bad jingkit",note:"Pynïasoh ïa ka physical ESP32/BLE hardware ban shim ïa ki sensor readings ba shisha."},occupation:{activity:"Ka kam",assessment:"Ka jingbishar kamai",type:"Jait kam",standing:"Ki kynta ba ieng man ka sngi",lifting:"Ka jingïakhun jingkit",repetitive:"Ki jingïaid ba manla",impact:"Ka jingktah na ka kam"},risk:{result:"Ka jingmih screening",summary:"La pynïasoh lang ïa ki symptom, BMI, jingïaid, jingïapher ka jingkit bad ka kam."},reports:{saved:"Ki report ba la buh",records:"Ki record nongpang",preview:"Ka jingpeit report",current:"Screening mynta",date:"Tarik bad por",patient:"Nongpang",riskScore:"Risk score",status:"Status",occupation:"Kamai"},overview:{history:"Ka histori",recent:"Screening ba dang shen",start:"Sdang screening thymmai",workflow:"Ki step screening",workflowHint:"Bud ïa ki module ha ka rukom"}},
  lus: { nav:{overview:"Thilthlawn",intake:"Mihing Thil",sensors:"Sensors",occupation:"Hna",risk:"Risk Result",reports:"Report"}, module:{overview:"Thilthlawn",intake:"Mihing Thil",sensors:"Sensors",occupation:"Hna",screening:"Risk Result",reports:"Report"}, eyebrow:{overview:"Health worker dashboard",intake:"Mihing check",sensors:"Hranghnawm leh load",occupation:"Hna risk",screening:"AI analysis",reports:"Report dah"}, progress:"Screening kalna",step:"Step",of:"a",complete:"zo",current:"tun",done:"zo",settings:"Settings",worker:"Health worker",mode:"Mode: Offline",language:"Ṭawng",logout:"Logout",buttons:{start:"Tan",stop:"Tawp",exit:"Chhuak",reset:"Reset readings",submitPatient:"Patient info submit",submitOccupation:"Hna info submit",save:"Save leh PDF download",clear:"Paih",viewAll:"En vek →"},intake:{context:"Clinical info",required:"Info mamawh",id:"Patient ID",name:"Patient hming",age:"Kum",height:"Height (cm)",weight:"Weight (kg)",bmi:"BMI (calculated)",gender:"Gender",pain:"Knee nat",painDuration:"Nat hun (ni)",mobility:"Kal theihna harsat",selectPain:"Pain level thlang",selectMobility:"Mobility harsat thlang"},sensors:{placement:"Sensor dahna",setup:"2 IMU + 2 FSR",telemetry:"Live telemetry",movement:"Kalna leh load",note:"Pynïasoh ïa ka physical ESP32/BLE hardware ban shim ïa ki sensor readings ba shisha."},occupation:{activity:"Hna",assessment:"Hna check",type:"Hna type",standing:"Ni khatah ding hun",lifting:"Boh thlak tlan",repetitive:"Thil tih nawn",impact:"Hna nghawng"},risk:{result:"Screening result",summary:"Symptom, BMI, kalna, kutke load leh hna kan en tlang."},reports:{saved:"Report dah",records:"Patient record",preview:"Report enna",current:"Screening tunah",date:"Tarik leh hun",patient:"Patient",riskScore:"Risk score",status:"Status",occupation:"Hna"},overview:{history:"History",recent:"Screening thar",start:"Screening thar tan",workflow:"Screening step",workflowHint:"Module te chu order in kal rawh"}},
  grt: { nav:{overview:"Nokrek",intake:"Rikgital",sensors:"Sensor",occupation:"Kam",risk:"Risk Result",reports:"Report"}, module:{overview:"Nokrek",intake:"Rikgital",sensors:"Sensor",occupation:"Kam",screening:"Risk Result",reports:"Report"}, eyebrow:{overview:"Health worker dashboard",intake:"Patient assessment",sensors:"Movement aro loading",occupation:"Kam aro risk",screening:"AI analysis",reports:"Saved screening record"}, progress:"Screening progress",step:"Step",of:"ni",complete:"finish",current:"daal",done:"finish",settings:"Settings",worker:"Health worker",mode:"Mode: Offline",language:"Kattarang",logout:"Logout",buttons:{start:"Start",stop:"Stop",exit:"Exit",reset:"Reset readings",submitPatient:"Patient info submit",submitOccupation:"Occupation info submit",save:"Save aro PDF download",clear:"Clear",viewAll:"View all →"},intake:{context:"Clinical context",required:"Required information",id:"Patient ID",name:"Patient name",age:"Age",height:"Height (cm)",weight:"Weight (kg)",bmi:"BMI (calculated)",gender:"Gender",pain:"Knee pain",painDuration:"Pain duration (days)",mobility:"Mobility limit",selectPain:"Select pain level",selectMobility:"Select mobility issue"},sensors:{placement:"Sensor placement",setup:"2 IMU + 2 FSR setup",telemetry:"Live telemetry",movement:"Movement aro loading",note:"Connect the physical ESP32/BLE hardware to capture real sensor readings."},occupation:{activity:"Work activity",assessment:"Occupation assessment",type:"Occupation type",standing:"Daily standing hours",lifting:"Lifting frequency",repetitive:"Repetitive movements",impact:"Occupational impact"},risk:{result:"Screening result",summary:"Symptoms, BMI, gait asymmetry, foot loading aro occupation are combined."},reports:{saved:"Saved reports",records:"Patient records",preview:"Report preview",current:"Current screening",date:"Date & Time",patient:"Patient",riskScore:"Risk score",status:"Status",occupation:"Occupation"},overview:{history:"History",recent:"Recent screening",start:"Start new screening",workflow:"Screening workflow",workflowHint:"Move through modules in order"}},
  kok: { nav:{overview:"Bwtai",intake:"Bwtai rong",sensors:"Sensor",occupation:"Khulum",risk:"Risk Result",reports:"Report"}, module:{overview:"Bwtai",intake:"Bwtai rong",sensors:"Sensor",occupation:"Khulum",screening:"Risk Result",reports:"Report"}, eyebrow:{overview:"Healthcare worker dashboard",intake:"Patient assessment",sensors:"Movement aro loading",occupation:"Risk context",screening:"AI analysis",reports:"Saved screening records"}, progress:"Screening progress",step:"Step",of:"ni",complete:"complete",current:"current",done:"done",settings:"Settings",worker:"Healthcare worker",mode:"Mode: Offline-first",language:"Kothok",logout:"Logout",buttons:{start:"Start",stop:"Stop",exit:"Exit",reset:"Reset readings",submitPatient:"Submit patient information",submitOccupation:"Submit occupation information",save:"Save aro PDF download",clear:"Clear",viewAll:"View all →"},intake:{context:"Clinical context",required:"Required inputs",id:"Patient ID",name:"Patient Name",age:"Age",height:"Height (cm)",weight:"Weight (kg)",bmi:"BMI (calculated)",gender:"Gender",pain:"Knee pain",painDuration:"Pain duration (days)",mobility:"Mobility limit",selectPain:"Select pain level",selectMobility:"Select mobility issue"},sensors:{placement:"Sensor placement",setup:"2 IMU + 2 FSR setup",telemetry:"Live telemetry",movement:"Movement and loading",note:"Connect the physical ESP32/BLE hardware to capture real sensor readings."},occupation:{activity:"Work activity",assessment:"Occupation assessment",type:"Occupation type",standing:"Daily standing hours",lifting:"Lifting frequency",repetitive:"Repetitive movements",impact:"Occupational impact"},risk:{result:"Screening result",summary:"Symptoms, BMI, gait asymmetry, foot loading imbalance and occupation combined."},reports:{saved:"Saved reports",records:"Patient records",preview:"Report preview",current:"Current screening",date:"Date & Time",patient:"Patient",riskScore:"Risk score",status:"Status",occupation:"Occupation"},overview:{history:"History",recent:"Recent Screening",start:"Start new screening",workflow:"Screening workflow",workflowHint:"Move through the modules in order",gait:"3D Gait Analysis",gaitEyebrow:"Live bilateral gait visualization"}}
};

let currentLanguage = localStorage.getItem(LANGUAGE_KEY) || "en";
function t(path) {
  const parts = path.split(".");
  let value = translations[currentLanguage] || translations.en;
  for (const part of parts) value = value?.[part];
  return value ?? tFromEnglish(path);
}
function tFromEnglish(path) {
  const parts = path.split("."); let value = translations.en;
  for (const part of parts) value = value?.[part];
  return value ?? path;
}
function setElementText(selector, value) {
  const el = document.querySelector(selector);
  if (!el) return;
  if (el.children.length === 0) { el.textContent = value; return; }
  const textNode = Array.from(el.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (textNode) textNode.textContent = ` ${value} `;
}
function translateLabel(selector, value) {
  const el = document.querySelector(selector);
  if (!el) return;
  const textNode = Array.from(el.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (textNode) textNode.textContent = ` ${value} `;
}
function renderWorkflowProgress(activeRoute) {
  document.querySelectorAll("[data-progress]").forEach((container) => {
    const route = container.dataset.progress;
    const activeIndex = workflowSteps.findIndex((s) => s.route === route);
    const currentIndex = workflowSteps.findIndex((s) => s.route === activeRoute);
    const idx = activeIndex >= 0 ? activeIndex : currentIndex;
    const isWorkflow = activeIndex >= 0;
    if (!isWorkflow) {
      container.innerHTML = "";
      return;
    }
    const completion = {
      intake: !!state.intakeSubmitted,
      sensors: !!state.sensorSubmitted,
      occupation: !!state.occupationSubmitted,
      screening: !!state.riskCompleted,
      reports: !!state.reportSaved,
    };
    const completedCount = workflowSteps.filter((step) => completion[step.route]).length;
    const progress = Math.round((completedCount / workflowSteps.length) * 100);
    container.innerHTML = `<div class="progress-track-inline" role="list" aria-label="${escapeHtml(t("progress"))}: ${idx + 1} ${escapeHtml(t("of"))} ${workflowSteps.length}">${workflowSteps.map((step, i) => {
      const done = !!completion[step.route];
      const current = step.route === route;
      return `<span class="progress-node ${done ? "done" : ""} ${current ? "current" : ""}" role="listitem" title="${escapeHtml(t("module." + step.route))}">${done ? "✓" : i + 1}</span>${i < workflowSteps.length - 1 ? `<span class="progress-line"><span style="width:${completion[workflowSteps[i].route] ? 100 : 0}%"></span></span>` : ""}`;
    }).join("")}</div>`;
  });
}
function applyLanguage() {
  document.documentElement.lang = currentLanguage === "mni" ? "mni" : currentLanguage;
  document.body.dataset.lang = currentLanguage;
  const route = currentRoute();
  const navMap = { overview:"overview", intake:"intake", sensors:"sensors", occupation:"occupation", screening:"risk", reports:"reports" };
  Object.entries(navMap).forEach(([routeKey, key]) => setElementText(`[data-route="${routeKey}"] span`, t(`nav.${key}`)));
  document.querySelectorAll("[data-module-header]").forEach((header) => {
    const r = header.dataset.moduleHeader;
    const h = header.querySelector("h1"); const e = header.querySelector(".eyebrow");
    if (h) h.textContent = t(`module.${r}`);
    if (e) e.textContent = t(`eyebrow.${r}`);
  });
  setElementText(".settings-popover > strong", t("settings"));
  const workerSpan = document.querySelector(".settings-popover > span");
  if (workerSpan) {
    const b = workerSpan.querySelector("b"); workerSpan.firstChild.textContent = `${t("worker")}: `; if (b) b.textContent = state.healthWorker?.name || state.healthWorker?.username || "—";
  }
  const modeSpan = document.querySelectorAll(".settings-popover > span")[1]; if (modeSpan) modeSpan.textContent = t("mode");
  const langLabel = document.querySelector(".language-control"); if (langLabel) { const select = langLabel.querySelector("select"); langLabel.firstChild.textContent = `${t("language")} `; if (select) select.value = currentLanguage; }
  setElementText("#settingsLogout", t("logout"));
  // Core module labels and actions.
  setElementText("#page-intake .panel-heading h2", t("intake.context")); setElementText("#page-intake .panel-heading .chip", t("intake.required"));
  translateLabel("#page-intake label:nth-of-type(1)", t("intake.id")); translateLabel("#page-intake label:nth-of-type(2)", t("intake.name")); translateLabel("#page-intake label:nth-of-type(3)", t("intake.age")); translateLabel("#page-intake label:nth-of-type(4)", t("intake.height")); translateLabel("#page-intake label:nth-of-type(5)", t("intake.weight")); translateLabel("#page-intake label:nth-of-type(6)", t("intake.bmi")); translateLabel("#page-intake label:nth-of-type(7)", t("intake.gender")); translateLabel("#page-intake label:nth-of-type(8)", t("intake.pain")); translateLabel("#page-intake label:nth-of-type(9)", t("intake.painDuration")); translateLabel("#page-intake label:nth-of-type(10)", t("intake.mobility"));
  setElementText("#intakeForm .primary-button", t("buttons.submitPatient"));
  setElementText("#page-sensors .body-map-panel .panel-heading .eyebrow", t("sensors.placement")); setElementText("#page-sensors .body-map-panel h2", t("sensors.setup")); setElementText("#page-sensors .telemetry-panel .panel-heading .eyebrow", t("sensors.telemetry")); setElementText("#page-sensors .telemetry-panel h2", t("sensors.movement")); setElementText("#page-sensors .panel-note", t("sensors.note")); setElementText("#startStream", t("buttons.start")); setElementText("#stopStream", t("buttons.stop")); setElementText("#exitStream", t("buttons.exit")); setElementText("#resetSensors", t("buttons.reset"));
  setElementText("#page-occupation .occupation-panel .panel-heading .eyebrow", t("occupation.activity")); setElementText("#page-occupation .occupation-panel h2", t("occupation.assessment")); setElementText("#page-occupation .occupation-risk-panel h2", t("occupation.impact"));
  translateLabel("#occupationForm label:nth-of-type(1)", t("occupation.type")); translateLabel("#occupationForm label:nth-of-type(2)", t("occupation.standing")); translateLabel("#occupationForm label:nth-of-type(3)", t("occupation.lifting")); translateLabel("#occupationForm label:nth-of-type(4)", t("occupation.repetitive")); setElementText("#occupationForm .primary-button", t("buttons.submitOccupation"));
  setElementText("#page-screening .risk-copy h2", t("risk.result")); setElementText("#riskSummary", t("risk.summary")); setElementText("#saveReportInline", t("buttons.save"));
  setElementText("#page-reports .reports-panel h2", t("reports.saved")); setElementText("#clearReports", t("buttons.clear")); setElementText("#page-reports .local-db-heading h3", t("reports.records")); setElementText("#page-reports .report-actions-panel .eyebrow", t("reports.current")); setElementText("#page-reports .report-actions-panel h2", t("reports.preview"));
  const previewLabels = document.querySelectorAll("#page-reports .preview-list > div > span"); if (previewLabels.length >= 4) { previewLabels[0].textContent=t("reports.patient"); previewLabels[1].textContent=t("reports.riskScore"); previewLabels[2].textContent=t("reports.status"); previewLabels[3].textContent=t("reports.occupation"); }
  setElementText("#page-overview .overview-start span", t("overview.start")); setElementText("#page-overview .gait-3d-widget .widget-heading .eyebrow", t("overview.gaitEyebrow")); setElementText("#page-overview .gait-3d-widget h3", t("overview.gait")); setElementText("#page-overview .workflow-heading .eyebrow", t("overview.workflow")); setElementText("#page-overview .workflow-heading strong", t("overview.workflowHint")); setElementText("#page-overview .recent-widget .widget-heading .eyebrow", t("overview.history")); setElementText("#page-overview .recent-widget h3", t("overview.recent")); setElementText("#page-overview .recent-widget .widget-link", t("buttons.viewAll"));
  renderWorkflowProgress(route);
}
function initLanguageSupport() {
  const select = document.querySelector("#languageSelect");
  if (!select) return;
  select.value = currentLanguage;
  select.addEventListener("change", () => { currentLanguage = select.value; localStorage.setItem(LANGUAGE_KEY, currentLanguage); applyLanguage(); renderOverview(); renderReports(); });
  applyLanguage();
}

function currentRoute() {
  const route = window.location.hash.replace("#/", "");
  return routes[route] ? route : "overview";
}

function showRoute(route) {
  const activeRoute = routes[route] ? route : "overview";
  els.pages.forEach((page) => {
    page.hidden = page.dataset.page !== activeRoute;
  });
  els.pageNav.querySelectorAll("[data-route]").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === activeRoute);
  });
  document.body.dataset.activeRoute = activeRoute;
  renderWorkflowProgress(activeRoute);
  if (activeRoute === "reports") renderReports();
  if (activeRoute === "overview") renderOverview();
  if (window.location.hash !== `#/${activeRoute}`) {
    window.history.replaceState(null, "", `#/${activeRoute}`);
  }
}

function numberValue(element) {
  const value = Number(element?.value);
  return Number.isFinite(value) ? value : 0;
}

const BLE_CONFIG = Object.freeze({
  serviceUuid: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  txCharacteristicUuid: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
  deviceNamePrefix: "SmartOA",
});

function pushSensorSample(sample) {
  const toFinite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const requiredFields = [
    "leftImuX", "leftImuY", "leftImuZ", "leftGyroX", "leftGyroY", "leftGyroZ",
    "rightImuX", "rightImuY", "rightImuZ", "rightGyroX", "rightGyroY", "rightGyroZ",
    "leftFsr", "rightFsr",
  ];
  const missingFields = requiredFields.filter((key) => !Number.isFinite(Number(sample[key])));
  const failedMpu = [sample.leftMpuOk === false ? "leftMpu" : null, sample.rightMpuOk === false ? "rightMpu" : null].filter(Boolean);
  state.sensorQuality.lastMissingFields = [...missingFields, ...failedMpu];
  state.sensorQuality.lastPacketAt = Date.now();
  if (state.sensorQuality.lastMissingFields.length) state.sensorQuality.invalidSamples += 1;
  else state.sensorQuality.validSamples += 1;
  const leftX = toFinite(sample.leftImuX ?? sample.leftAx ?? sample.lx);
  const leftY = toFinite(sample.leftImuY ?? sample.leftAy ?? sample.ly);
  const leftZ = toFinite(sample.leftImuZ ?? sample.leftAz ?? sample.lz);
  const rightX = toFinite(sample.rightImuX ?? sample.rightAx ?? sample.rx);
  const rightY = toFinite(sample.rightImuY ?? sample.rightAy ?? sample.ry);
  const rightZ = toFinite(sample.rightImuZ ?? sample.rightAz ?? sample.rz);
  const leftGx = toFinite(sample.leftGyroX ?? sample.leftGx ?? sample.lgx);
  const leftGy = toFinite(sample.leftGyroY ?? sample.leftGy ?? sample.lgy);
  const leftGz = toFinite(sample.leftGyroZ ?? sample.leftGz ?? sample.lgz);
  const rightGx = toFinite(sample.rightGyroX ?? sample.rightGx ?? sample.rgx);
  const rightGy = toFinite(sample.rightGyroY ?? sample.rightGy ?? sample.rgy);
  const rightGz = toFinite(sample.rightGyroZ ?? sample.rightGz ?? sample.rgz);
  const leftMagnitude = toFinite(sample.leftImu ?? Math.sqrt(leftX ** 2 + leftY ** 2 + leftZ ** 2));
  const rightMagnitude = toFinite(sample.rightImu ?? Math.sqrt(rightX ** 2 + rightY ** 2 + rightZ ** 2));
  const leftFsr = toFinite(sample.leftFsr ?? sample.leftPressure ?? sample.fsrLeft ?? sample.leftFsrRaw);
  const rightFsr = toFinite(sample.rightFsr ?? sample.rightPressure ?? sample.fsrRight ?? sample.rightFsrRaw);
  state.latest = {
    leftImu: leftMagnitude,
    rightImu: rightMagnitude,
    leftFsr,
    rightFsr,
    leftImuX: leftX, leftImuY: leftY, leftImuZ: leftZ,
    rightImuX: rightX, rightImuY: rightY, rightImuZ: rightZ,
    leftGyroX: leftGx, leftGyroY: leftGy, leftGyroZ: leftGz,
    rightGyroX: rightGx, rightGy: rightGy, rightGyroZ: rightGz,
    leftFsrVoltage: toFinite(sample.leftFsrVoltage ?? sample.leftVoltage),
    rightFsrVoltage: toFinite(sample.rightFsrVoltage ?? sample.rightVoltage),
  };
  state.tick += 1;
  state.sampleCount = state.sensorQuality.validSamples;
  state.history.push({
    leftImu: leftMagnitude,
    rightImu: rightMagnitude,
    leftFsr,
    rightFsr,
    leftGyro: Math.sqrt(leftGx ** 2 + leftGy ** 2 + leftGz ** 2),
    rightGyro: Math.sqrt(rightGx ** 2 + rightGy ** 2 + rightGz ** 2),
  });
  state.history = state.history.slice(-64);
  updateAll();
}
function parseHardwarePacket(text) {
  const clean = String(text || "").trim();
  if (!clean) return;
  try {
    const parsed = JSON.parse(clean);
    if (parsed && typeof parsed === "object") {
      if (parsed.data && typeof parsed.data === "object") return pushSensorSample(parsed.data);
      return pushSensorSample(parsed);
    }
  } catch (_) {
    const parts = clean.split(/[,;\s]+/).map(Number);
    if (parts.length >= 4 && parts.slice(0, 4).every(Number.isFinite)) {
      pushSensorSample({ leftImu: parts[0], rightImu: parts[1], leftFsr: parts[2], rightFsr: parts[3] });
    }
  }
}

function handleBleNotification(event) {
  const decoder = handleBleNotification.decoder || (handleBleNotification.decoder = new TextDecoder());
  state.packetBuffer += decoder.decode(event.target.value, { stream: true });
  const packets = state.packetBuffer.split(/\r?\n/);
  state.packetBuffer = packets.pop() || "";
  packets.forEach(parseHardwarePacket);
}

async function connectHardware() {
  if (!("bluetooth" in navigator)) throw new Error("Web Bluetooth is not supported in this browser. Use Chrome or Edge on HTTPS or localhost.");
  if (!window.isSecureContext) throw new Error("Bluetooth access requires HTTPS or localhost.");
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [BLE_CONFIG.serviceUuid] }, { namePrefix: BLE_CONFIG.deviceNamePrefix }],
    optionalServices: [BLE_CONFIG.serviceUuid],
  });
  device.addEventListener("gattserverdisconnected", handleHardwareDisconnected);
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(BLE_CONFIG.serviceUuid);
  const characteristic = await service.getCharacteristic(BLE_CONFIG.txCharacteristicUuid);
  await characteristic.startNotifications();
  characteristic.addEventListener("characteristicvaluechanged", handleBleNotification);
  state.hardwareDevice = device;
  state.hardwareCharacteristic = characteristic;
  state.hardwareConnected = true;
  state.streaming = true;
  state.capturing = true;
  state.sampleCount = 0;
  state.sensorQuality = { validSamples: 0, invalidSamples: 0, lastMissingFields: [], lastPacketAt: null };
  els.streamState.textContent = "Connected • capturing";
  els.streamState.classList.add("green");
  els.connectionLabel.textContent = `${device.name || "ESP32"} connected`;
  els.startStream.hidden = true;
  els.stopStream.hidden = false;
  els.exitStream.hidden = false;
  setNotification("ESP32 connected. Capturing real MPU6050 and FSR readings.", true);
  updateAll();
}

function isSensorCaptureReady() {
  return state.sensorQuality.validSamples >= 10;
}

function handleHardwareDisconnected() {
  state.hardwareConnected = false;
  state.streaming = false;
  state.capturing = false;
  state.hardwareDevice = null;
  state.hardwareCharacteristic = null;
  els.streamState.textContent = "Hardware disconnected";
  els.streamState.classList.remove("green");
  els.connectionLabel.textContent = "ESP32 not connected";
  els.startStream.hidden = false;
  els.stopStream.hidden = true;
  els.exitStream.hidden = true;
  setNotification("ESP32 disconnected. Connect the hardware before collecting another sensor sample.", false);
  updateAll();
}

function resetSensorReadings() {
  state.sampleCount = 0;
  state.tick = 0;
  state.sensorSubmitted = false;
  state.sensorQuality = { validSamples: 0, invalidSamples: 0, lastMissingFields: [], lastPacketAt: null };
  state.history = Array.from({ length: 48 }, () => ({ leftImu: 0, rightImu: 0, leftFsr: 0, rightFsr: 0, leftGyro: 0, rightGyro: 0 }));
  state.latest = {
    leftImu: 0, rightImu: 0, leftFsr: 0, rightFsr: 0,
    leftImuX: 0, leftImuY: 0, leftImuZ: 0,
    rightImuX: 0, rightImuY: 0, rightImuZ: 0,
    leftGyroX: 0, leftGyroY: 0, leftGyroZ: 0,
    rightGyroX: 0, rightGyroY: 0, rightGyroZ: 0,
    leftFsrVoltage: 0, rightFsrVoltage: 0,
  };
  updateAll();
}

function calculateBmi() {
  const heightCm = Number(els.height?.value) || 0;
  const weightKg = Number(els.weight?.value) || 0;
  if (!heightCm || !weightKg) {
    if (els.bmi) els.bmi.value = "";
    return null;
  }
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const rounded = Math.round(bmi * 10) / 10;
  if (els.bmi) els.bmi.value = Number.isFinite(rounded) ? rounded.toFixed(1) : "";
  return Number.isFinite(rounded) ? rounded : null;
}

function calculateRisk() {
  const intake = state.intakeData || {};
  const age = Number(intake.age ?? numberValue(els.age)) || 0;
  const bmi = Number(intake.bmi ?? calculateBmi() ?? numberValue(els.bmi)) || 0;
  const pain = Number(intake.kneePainScore ?? numberValue(els.pain)) || 0;
  const mobility = Number(intake.mobilityIssueScore ?? numberValue(els.mobility)) || 0;
  const imuAsymmetry = Math.abs(state.latest.leftImu - state.latest.rightImu) / 0.5;
  const loadAsymmetry = Math.abs(state.latest.leftFsr - state.latest.rightFsr) / 120;

  const ageScore = Math.max(0, Math.min(18, (age - 40) * 0.55));
  const bmiScore = Math.max(0, Math.min(18, (bmi - 23) * 1.55));
  const symptomScore = pain * 10 + mobility * 7;
  const sensorScore = Math.min(24, imuAsymmetry * 12 + loadAsymmetry * 16);
  const occupation = calculateOccupationRisk();
  const occupationScore = Math.min(12, occupation.totalScore * 0.24);

  state.risk = Math.round(Math.max(5, Math.min(96, ageScore + bmiScore + symptomScore + sensorScore + occupationScore)));

  return {
    ageScore,
    bmiScore,
    symptomScore,
    sensorScore,
    occupationScore,
    imuAsymmetry,
    loadAsymmetry,
  };
}

function riskLabel(score) {
  if (score >= 70) return { label: "High", color: "#dc2626" };
  if (score >= 42) return { label: "Moderate", color: "#d97706" };
  return { label: "Low", color: "#0f766e" };
}

function riskStageClass(level) {
  const normalized = String(level || "").toLowerCase();
  if (normalized.includes("high")) return "risk-stage-high-badge";
  if (normalized.includes("moderate")) return "risk-stage-moderate-badge";
  if (normalized.includes("low")) return "risk-stage-low-badge";
  return "risk-stage-neutral-badge";
}

function applyReportPreview(report) {
  if (!report) return;
  const score = Number(report.oaRiskScore ?? report.score ?? 0);
  const level = report.oaRisk || report.level || "Not assessed";
  els.previewPatient.textContent = report.patientId || report.patientName || "Unknown patient";
  els.previewRisk.textContent = Number.isFinite(score) ? score : "—";
  els.previewLevel.textContent = `${level} risk`;
  els.previewLevel.className = `risk-preview-value ${riskStageClass(level)}`;
  els.previewOccupation.textContent = report.occupation || "Not selected";

  const esc = escapeHtml;
  const value = (v, fallback = "Not recorded") => v === null || v === undefined || v === "" ? fallback : esc(String(v));
  const num = (v, decimals = 2, unit = "") => {
    const n = Number(v);
    return Number.isFinite(n) ? `${n.toFixed(decimals)}${unit ? ` ${unit}` : ""}` : "Not recorded";
  };
  const sensor = report.sensors || {};
  const leftImu = report.leftImu ?? sensor.leftImu;
  const rightImu = report.rightImu ?? sensor.rightImu;
  const leftFsr = report.leftFsr ?? sensor.leftFsr;
  const rightFsr = report.rightFsr ?? sensor.rightFsr;
  const capture = report.sensorCapture || {};

  if (els.fullReportPreview) {
    els.fullReportPreview.innerHTML = `
      <div class="full-report-header">
        <div><p class="eyebrow">Complete screening report</p><h3>${value(report.patientName, "Patient")} · ${value(report.patientId)}</h3><small>${value(report.dateTime || report.createdAt)}</small></div>
        <span class="risk-badge ${riskStageClass(level)}">${value(level)} · ${Number.isFinite(score) ? score : "—"}/100</span>
      </div>
      <div class="full-report-section"><h4>Patient details</h4><div class="full-report-grid">
        <div><span>Patient ID</span><strong>${value(report.patientId)}</strong></div><div><span>Name</span><strong>${value(report.patientName)}</strong></div>
        <div><span>Age</span><strong>${value(report.age)}</strong></div><div><span>Gender</span><strong>${value(report.gender)}</strong></div>
        <div><span>Height</span><strong>${value(report.height)} cm</strong></div><div><span>Weight</span><strong>${value(report.weight)} kg</strong></div>
        <div><span>BMI</span><strong>${value(report.bmi)}</strong></div><div><span>Knee pain</span><strong>${value(report.kneePain)}</strong></div>
        <div><span>Pain duration</span><strong>${value(report.painDurationDays)} days</strong></div><div><span>Mobility issue</span><strong>${value(report.mobilityIssue)}</strong></div>
        <div><span>Occupation</span><strong>${value(report.occupation)}</strong></div><div><span>Occupation risk</span><strong>${value(report.occupationRiskLevel)} (${value(report.occupationRisk)} pts)</strong></div>
      </div></div>
      <div class="full-report-section"><h4>Risk assessment</h4><div class="full-report-grid">
        <div><span>OA risk</span><strong class="risk-preview-value ${riskStageClass(level)}">${value(level)}</strong></div><div><span>OA risk score</span><strong>${Number.isFinite(score) ? score : "Not recorded"}/100</strong></div>
      </div></div>
      <div class="full-report-section"><h4>Sensor data quality</h4><div class="full-report-grid">
        <div><span>Capture status</span><strong>${value(capture.status, "Not recorded")}</strong></div><div><span>Valid samples</span><strong>${value(capture.validSamples, "0")}</strong></div>
        <div><span>Incomplete packets</span><strong>${value(capture.invalidSamples, "0")}</strong></div><div><span>Last missing fields</span><strong>${value((capture.lastMissingFields || []).join(", "), "None")}</strong></div>
      </div></div>
      <div class="full-report-section"><h4>IMU readings</h4><div class="full-report-grid">
        <div><span>Left accelerometer</span><strong>${num(leftImu)} g</strong></div><div><span>Right accelerometer</span><strong>${num(rightImu)} g</strong></div>
        <div><span>Left acceleration axes</span><strong>X ${num(report.leftImuX)} / Y ${num(report.leftImuY)} / Z ${num(report.leftImuZ)} g</strong></div>
        <div><span>Right acceleration axes</span><strong>X ${num(report.rightImuX)} / Y ${num(report.rightImuY)} / Z ${num(report.rightImuZ)} g</strong></div>
        <div><span>Left gyroscope</span><strong>X ${num(report.leftGyroX,1)} / Y ${num(report.leftGyroY,1)} / Z ${num(report.leftGyroZ,1)} °/s</strong></div>
        <div><span>Right gyroscope</span><strong>X ${num(report.rightGyroX,1)} / Y ${num(report.rightGyroY,1)} / Z ${num(report.rightGyroZ,1)} °/s</strong></div>
      </div></div>
      <div class="full-report-section"><h4>Pressure sensor readings</h4><div class="full-report-grid">
        <div><span>Left FSR</span><strong>${num(leftFsr,0)} ADC</strong></div><div><span>Right FSR</span><strong>${num(rightFsr,0)} ADC</strong></div>
        <div><span>Left FSR voltage</span><strong>${num(report.leftFsrVoltage,2)} V</strong></div><div><span>Right FSR voltage</span><strong>${num(report.rightFsrVoltage,2)} V</strong></div>
      </div></div>
      <div class="full-report-section"><h4>Healthcare worker</h4><div class="full-report-grid">
        <div><span>Name</span><strong>${value(report.healthcareWorkerName)}</strong></div><div><span>ID</span><strong>${value(report.healthcareWorkerId)}</strong></div>
      </div></div>`;
  }
  const panel = document.querySelector("#reportPreviewPanel");
  if (panel) panel.classList.add("report-preview-highlight");
}

async function fetchMlPrediction() {
  if (state.isFetchingMl) return;
  state.isFetchingMl = true;
  try {
    if (!isSensorCaptureReady()) {
      state.mlResult = null;
      return;
    }
    const intake = state.intakeData || {};
    const age = Number(intake.age ?? numberValue(els.age)) || 50;
    const bmi = Number(intake.bmi ?? calculateBmi() ?? numberValue(els.bmi)) || 25.0;
    const pain = Number(intake.kneePainScore ?? numberValue(els.pain)) || 1;
    const mobility = Number(intake.mobilityIssueScore ?? numberValue(els.mobility)) || 0;

    const imuAsym = Math.abs(state.latest.leftImu - state.latest.rightImu);
    const fsrAsym = Math.abs(state.latest.leftFsr - state.latest.rightFsr);

    const payload = {
      age,
      sex: intake.gender || els.gender?.value || "Female",
      bmi,
      vas_pain_score: Math.min(10, Math.max(0, pain * 3.3)),
      womac_score: Math.min(96, Math.max(0, (pain + mobility) * 12)),
      prior_injury_history: "No Prior Injury",
      activity_level: state.occupationData?.occupationType === "heavy" || state.occupationData?.occupationType === "athletic" ? "High" : "Moderate",
      stance_time_asymmetry: Math.round(Math.min(30, imuAsym * 15 + fsrAsym * 0.05) * 10) / 10,
      knee_rom_left: Math.round(Math.max(30, 65 - state.latest.leftImu * 5) * 10) / 10,
      knee_rom_right: Math.round(Math.max(30, 65 - state.latest.rightImu * 5) * 10) / 10,
      load_distribution_ratio: state.latest.rightFsr > 0 ? Math.round((state.latest.leftFsr / state.latest.rightFsr) * 100) / 100 : 1.0,
      cadence: 100.0,
      heel_strike_force_left: Math.round(Math.max(0.5, state.latest.leftImu || 1.1) * 10) / 10,
      heel_strike_force_right: Math.round(Math.max(0.5, state.latest.rightImu || 1.1) * 10) / 10,
      toe_off_force_left: 1.0,
      toe_off_force_right: 1.0,
      gait_cycle_variability: Math.round(Math.min(15, fsrAsym / 40 + 2.0) * 10) / 10
    };

    const res = await fetch("/api/ml/predict-risk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const mlResult = await res.json();
      if (mlResult && mlResult.ok) {
        state.mlResult = mlResult;
        updateMlUi(mlResult);
      }
    }
  } catch (err) {
    console.warn("ML Prediction API call fallback:", err);
  } finally {
    state.isFetchingMl = false;
  }
}

function updateMlUi(mlResult) {
  if (!mlResult) return;
  const questPct = mlResult.feature_attribution_share?.Questionnaire_percent ?? 39.6;
  const sensorPct = mlResult.feature_attribution_share?.Wearable_Sensor_percent ?? 60.4;
  
  if (els.mlShareQuest) els.mlShareQuest.style.width = `${questPct}%`;
  if (els.mlShareSensor) els.mlShareSensor.style.width = `${sensorPct}%`;
  if (els.mlQuestPct) els.mlQuestPct.textContent = `${questPct}%`;
  if (els.mlSensorPct) els.mlSensorPct.textContent = `${sensorPct}%`;

  if (mlResult.predicted_risk_tier) {
    const tier = mlResult.predicted_risk_tier;
    const conf = mlResult.confidence_score;
    const qualityNote = mlResult.input_quality?.complete ? "Complete inputs." : `Missing inputs filled: ${(mlResult.input_quality?.imputed_fields || []).join(", ")}.`;
    els.riskSummary.textContent = `Random Forest AI Model Prediction: ${tier} Risk (${conf}% confidence). ${qualityNote}`;
  }
}

function updateRiskUi(factors) {
  const score = state.risk;
  const level = riskLabel(score);
  const circumference = 402;
  els.riskScore.textContent = score;
  els.riskLevel.textContent = `${level.label} risk`;
  els.meterValue.style.stroke = level.color;
  els.meterValue.style.strokeDashoffset = String(circumference - (score / 100) * circumference);
  
  if (state.mlResult && state.mlResult.predicted_risk_tier) {
    els.riskSummary.textContent = `Random Forest AI Model Prediction: ${state.mlResult.predicted_risk_tier} Risk (${state.mlResult.confidence_score}% confidence). Analyzed patient intake and live sensor telemetry.`;
  } else {
    els.riskSummary.textContent = !isSensorCaptureReady()
      ? "Connect the ESP32 and capture at least 10 complete sensor samples before using the AI risk result."
      : level.label === "High"
        ? "Sensor asymmetry and symptoms suggest this patient should be flagged for clinical follow-up."
        : level.label === "Moderate"
          ? "The result suggests measurable risk factors. Repeat screening and compare reports over time."
          : "Current values are low risk, but this is a screening aid and not a medical diagnosis.";
  }

  const factorRows = [
    ["Symptom score", `${Math.round(factors.symptomScore)} pts`],
    ["BMI contribution", `${Math.round(factors.bmiScore)} pts`],
    ["IMU asymmetry", `${Math.round(factors.imuAsymmetry * 100)}%`],
    ["Load asymmetry", `${Math.round(factors.loadAsymmetry * 100)}%`],
    ["Occupation contribution", `${Math.round(factors.occupationScore)} pts`],
  ];

  els.factorList.innerHTML = factorRows
    .map(([name, value]) => `<div class="factor"><span>${name}</span><strong>${value}</strong></div>`)
    .join("");
  updateReportPreview(level);
}

function updateReportPreview(level) {
  els.previewPatient.textContent = state.intakeData?.patientId || els.patientId.value || "Unknown patient";
  els.previewRisk.textContent = state.risk;
  els.previewLevel.textContent = `${level.label} risk`;
  els.previewOccupation.textContent = getOccupationLabel();
}

function getOccupationLabel() {
  if (state.occupationData?.occupation) return state.occupationData.occupation;
  const option = els.occupationType.options[els.occupationType.selectedIndex];
  return els.occupationType.value ? option.textContent : "Not selected";
}

function calculateOccupationRisk() {
  const occupation = state.occupationData || {};
  const occupationType = occupation.occupationType ?? els.occupationType.value;
  const standingHours = Number(occupation.standingHours ?? numberValue(els.standingHours)) || 0;
  const liftingFreq = Number(occupation.liftingFreq ?? numberValue(els.liftingFreq)) || 0;
  const repetitiveMovements = Number(occupation.repetitiveMovements ?? numberValue(els.repetitiveMovements)) || 0;

  const occupationScores = {
    sedentary: 0,
    light: 5,
    moderate: 15,
    heavy: 25,
    athletic: 20,
  };

  const typeScore = occupationScores[occupationType] || 0;
  const standingScore = Math.min(15, standingHours * 1.5);
  const liftingScore = liftingFreq * 6;
  const repetitiveScore = repetitiveMovements * 5;

  const totalScore = Math.round(typeScore + standingScore + liftingScore + repetitiveScore);

  return {
    totalScore,
    typeScore,
    standingScore,
    liftingScore,
    repetitiveScore,
  };
}

function updateOccupationUi() {
  const risk = calculateOccupationRisk();
  const level = risk.totalScore >= 30 ? "High" : risk.totalScore >= 15 ? "Moderate" : "Low";
  const color = level === "High" ? "#dc2626" : level === "Moderate" ? "#d97706" : "#0f766e";

  if (!els.occupationType.value && !state.occupationData) {
    els.occupationSummary.textContent = "Select occupation details to assess occupational risk factors for osteoarthritis.";
    els.occupationFactors.innerHTML = "";
    return;
  }

  els.occupationSummary.textContent = `Occupational risk score: ${risk.totalScore} (${level} risk)`;

  const factorRows = [
    ["Occupation type", `${risk.typeScore} pts`],
    ["Standing hours", `${risk.standingScore} pts`],
    ["Lifting frequency", `${risk.liftingScore} pts`],
    ["Repetitive movements", `${risk.repetitiveScore} pts`],
  ];

  els.occupationFactors.innerHTML = factorRows
    .map(([name, value]) => `<div class="factor"><span>${name}</span><strong>${value}</strong></div>`)
    .join("");
}

function updateTelemetryUi() {
  els.leftImu.textContent = `${state.latest.leftImu.toFixed(2)} g`;
  els.rightImu.textContent = `${state.latest.rightImu.toFixed(2)} g`;
  els.leftImuAxes.textContent = `X ${state.latest.leftImuX.toFixed(2)} • Y ${state.latest.leftImuY.toFixed(2)} • Z ${state.latest.leftImuZ.toFixed(2)} g`;
  els.rightImuAxes.textContent = `X ${state.latest.rightImuX.toFixed(2)} • Y ${state.latest.rightImuY.toFixed(2)} • Z ${state.latest.rightImuZ.toFixed(2)} g`;
  els.leftGyro.textContent = `${Math.sqrt(state.latest.leftGyroX ** 2 + state.latest.leftGyroY ** 2 + state.latest.leftGyroZ ** 2).toFixed(1)} °/s`;
  els.rightGyro.textContent = `${Math.sqrt(state.latest.rightGyroX ** 2 + state.latest.rightGyroY ** 2 + state.latest.rightGyroZ ** 2).toFixed(1)} °/s`;
  els.leftGyroAxes.textContent = `X ${state.latest.leftGyroX.toFixed(1)} • Y ${state.latest.leftGyroY.toFixed(1)} • Z ${state.latest.leftGyroZ.toFixed(1)} °/s`;
  els.rightGyroAxes.textContent = `X ${state.latest.rightGyroX.toFixed(1)} • Y ${state.latest.rightGyroY.toFixed(1)} • Z ${state.latest.rightGyroZ.toFixed(1)} °/s`;
  els.leftFsr.textContent = `${Math.round(state.latest.leftFsr)} ADC`;
  els.rightFsr.textContent = `${Math.round(state.latest.rightFsr)} ADC`;
  els.leftFsrMeta.textContent = `Raw analog: ${Math.round(state.latest.leftFsr)}${state.latest.leftFsrVoltage ? ` • ${state.latest.leftFsrVoltage.toFixed(2)} V` : ""}`;
  els.rightFsrMeta.textContent = `Raw analog: ${Math.round(state.latest.rightFsr)}${state.latest.rightFsrVoltage ? ` • ${state.latest.rightFsrVoltage.toFixed(2)} V` : ""}`;
}

function drawChart() {
  drawSensorChart(els.imuAccelChart, "Accelerometer magnitude", [
    ["leftImu", "Left", 0, 2.5],
    ["rightImu", "Right", 0, 2.5],
  ], "g");

  drawSensorChart(els.imuGyroChart, "Gyroscope angular speed", [
    ["leftGyro", "Left", 0, 250],
    ["rightGyro", "Right", 0, 250],
  ], "°/s");

  drawSensorChart(els.pressureChart, "FSR pressure reading", [
    ["leftFsr", "Left", 0, 4095],
    ["rightFsr", "Right", 0, 4095],
  ], "ADC");
}

function drawSensorChart(canvas, title, series, unit) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#071d1c";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i += 1) {
    const y = (height / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  series.forEach(([key, label, min, max], index) => {
    drawSeries(ctx, canvas, key, index === 0 ? "#38bdf8" : "#a7f3d0", min, max);
  });

  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = "700 18px system-ui";
  ctx.fillText(title, 22, 30);
  ctx.font = "500 12px system-ui";
  ctx.fillText(unit, 22, height - 12);
  ctx.fillText(series.map(([key, label]) => `${label}: ${key}`).join("   "), 22, 50);
}

function drawSeries(ctx, canvas, key, color, min, max) {
  const width = canvas.width;
  const height = canvas.height;
  const points = state.history;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((sample, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * width;
    const normalized = (sample[key] - min) / (max - min);
    const y = height - Math.max(0, Math.min(1, normalized)) * (height - 72) - 24;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateGait3D(source = "Live sensor stream") {
  const left = Number(state.latest?.leftImu ?? 0.9);
  const right = Number(state.latest?.rightImu ?? 0.9);
  const leftLoad = Number(state.latest?.leftFsr ?? 180);
  const rightLoad = Number(state.latest?.rightFsr ?? 180);
  const phaseBase = ((state.tick * 7) % 100);
  const leftPhase = Math.round((phaseBase + Math.max(-12, Math.min(12, (left - 0.9) * 55))) % 100);
  const rightPhase = Math.round((phaseBase + 50 + Math.max(-12, Math.min(12, (right - 0.9) * 55))) % 100);
  const loadTotal = Math.max(1, leftLoad + rightLoad);
  const symmetry = Math.round(100 - Math.min(45, Math.abs(leftLoad - rightLoad) / loadTotal * 100));
  const balance = symmetry >= 90 ? "Balanced" : symmetry >= 75 ? "Mild variation" : "Asymmetric";
  const leftSwing = Math.sin((leftPhase / 100) * Math.PI * 2) * 17;
  const rightSwing = Math.sin((rightPhase / 100) * Math.PI * 2) * 17;
  const leftDepth = Math.cos((leftPhase / 100) * Math.PI * 2) * 7;
  const rightDepth = Math.cos((rightPhase / 100) * Math.PI * 2) * 7;
  if (els.leftLeg3d) els.leftLeg3d.style.transform = `translate3d(${leftSwing}px,0,${leftDepth}px) rotateY(${leftSwing * 0.45}deg) rotateZ(${leftSwing * 0.10}deg)`;
  if (els.rightLeg3d) els.rightLeg3d.style.transform = `translate3d(${rightSwing}px,0,${rightDepth}px) rotateY(${rightSwing * 0.45}deg) rotateZ(${rightSwing * 0.10}deg)`;
  if (els.gaitLeftPhase) els.gaitLeftPhase.textContent = `${leftPhase}%`;
  if (els.gaitRightPhase) els.gaitRightPhase.textContent = `${rightPhase}%`;
  if (els.gaitSymmetry) els.gaitSymmetry.textContent = `${symmetry}%`;
  if (els.gaitBalance) els.gaitBalance.textContent = balance;
  if (els.gait3dSource) els.gait3dSource.textContent = source;
  if (els.gait3dText) els.gait3dText.textContent = state.streaming
    ? `${balance} • bilateral gait is updating from the live physical IMU + FSR stream.`
    : "Start the sensor stream to see both legs move through a synchronized gait cycle.";
}

const markerDetails = {
  "Medial load": {
    title: "Medial loading",
    text: "Highlights the inner side of the knee where uneven loading can be reviewed during screening."
  },
  "Joint-space region": {
    title: "Joint-space region",
    text: "Marks the central joint region used as a visual reference when reviewing movement and loading patterns."
  },
  "Movement marker": {
    title: "Movement pattern",
    text: "Highlights the lateral reference area used to inspect movement symmetry alongside IMU telemetry."
  }
};

const sensorDetails = {
  "Left IMU": {
    type: "MPU6050 • IMU",
    hint: "Outer side of left lower leg, below the knee",
    text: "Attach firmly to the outer shank below the knee so the sensor follows lower-leg movement."
  },
  "Right IMU": {
    type: "MPU6050 • IMU",
    hint: "Outer side of right lower leg, below the knee",
    text: "Attach firmly to the outer shank below the knee and keep the orientation consistent with the left side."
  },
  "Left FSR": {
    type: "FSR • pressure",
    hint: "Inside left shoe / insole loading area",
    text: "Place the pressure sensor inside the shoe under the main foot-loading area to capture plantar loading changes."
  },
  "Right FSR": {
    type: "FSR • pressure",
    hint: "Inside right shoe / insole loading area",
    text: "Place the pressure sensor inside the shoe under the main foot-loading area and secure it below the insole."
  }
};

function selectKneeMarker(marker) {
  const detail = markerDetails[marker] || markerDetails["Medial load"];
  if (els.kneeMarkerTitle) els.kneeMarkerTitle.textContent = detail.title;
  if (els.kneeMarkerDetail) els.kneeMarkerDetail.textContent = detail.title;
  if (els.kneeMarkerEyebrow) els.kneeMarkerEyebrow.textContent = marker;
  document.querySelectorAll(".marker-select").forEach((button) => {
    button.classList.toggle("active", button.dataset.marker === marker);
  });
  document.querySelectorAll(".hotspot,.load-zone").forEach((node) => {
    node.classList.toggle("active", node.dataset.marker === marker);
  });
}

function updateInteractiveKneeVisual(report) {
  const score = report ? Number(report.oaRiskScore ?? report.score ?? 0) : 0;
  const stage = document.querySelector("#kneeRiskStage");
  if (stage) {
    stage.classList.add("latest-analysis");
    stage.classList.remove("risk-low", "risk-moderate", "risk-high", "risk-critical");
    const level = String(report?.oaRisk || report?.level || "").toLowerCase();
    const riskClass = level.includes("critical") ? "risk-critical" : level.includes("high") ? "risk-high" : level.includes("moderate") || level.includes("medium") ? "risk-moderate" : "risk-low";
    if (report) stage.classList.add(riskClass);
  }
  if (els.oaMarkerRisk) els.oaMarkerRisk.textContent = report ? `${Math.max(0, Math.min(100, Math.round(score)))}/100` : "—";
  if (els.oaMarkerRiskMeta) els.oaMarkerRiskMeta.textContent = report
    ? `${report.patientName || report.patientId || "Latest patient"} • ${report.oaRisk || report.level || "Not assessed"} • ${new Date(report.dateTime || report.createdAt).toLocaleString()}`
    : "Complete a screening to show the latest result.";
  selectKneeMarker("Medial load");
}

function sensorValue(sensor) {
  const latest = state.latest || {};
  if (sensor === "Left IMU") return `${Number(latest.leftImu ?? 0).toFixed(2)} g`;
  if (sensor === "Right IMU") return `${Number(latest.rightImu ?? 0).toFixed(2)} g`;
  if (sensor === "Left FSR") return `${Math.round(Number(latest.leftFsr ?? 0))} N`;
  return `${Math.round(Number(latest.rightFsr ?? 0))} N`;
}

function selectSensorPlacement(sensor) {
  const detail = sensorDetails[sensor] || sensorDetails["Left IMU"];
  if (els.sensorPlacementType) els.sensorPlacementType.textContent = detail.type;
  if (els.sensorPlacementTitle) els.sensorPlacementTitle.textContent = sensor;
  if (els.sensorPlacementHint) els.sensorPlacementHint.textContent = detail.hint;
  if (els.sensorDetailLabel) els.sensorDetailLabel.textContent = "Selected sensor";
  if (els.sensorDetailName) els.sensorDetailName.textContent = sensor;
  if (els.sensorDetailValue) els.sensorDetailValue.textContent = sensorValue(sensor);
  if (els.sensorDetailText) els.sensorDetailText.textContent = detail.text;
  document.querySelectorAll(".sensor-choice").forEach((button) => {
    button.classList.toggle("active", button.dataset.sensor === sensor);
  });
  document.querySelectorAll(".sensor-hotspot").forEach((node) => {
    node.classList.toggle("active", node.dataset.sensor === sensor);
  });
}

function updateSensorPlacementVisual() {
  if (!els.sensorPlacementStage) return;
  els.sensorPlacementStage.classList.toggle("is-streaming", !!state.streaming);
  const active = document.querySelector(".sensor-choice.active")?.dataset.sensor || "Left IMU";
  selectSensorPlacement(active);
}

function initInteractiveVisuals() {
  document.querySelectorAll(".marker-select").forEach((button) => {
    button.addEventListener("click", () => selectKneeMarker(button.dataset.marker));
  });
  document.querySelectorAll(".hotspot,.load-zone").forEach((node) => {
    node.addEventListener("click", () => selectKneeMarker(node.dataset.marker));
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectKneeMarker(node.dataset.marker);
      }
    });
  });
  document.querySelectorAll(".sensor-choice").forEach((button) => {
    button.addEventListener("click", () => selectSensorPlacement(button.dataset.sensor));
  });
  document.querySelectorAll(".sensor-hotspot").forEach((node) => {
    node.addEventListener("click", () => selectSensorPlacement(node.dataset.sensor));
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectSensorPlacement(node.dataset.sensor);
      }
    });
  });
  selectKneeMarker("Medial load");
  selectSensorPlacement("Left IMU");
}

async function renderOverview() {
  const reports = await getReports();
  if (els.oaMarkerSource) els.oaMarkerSource.textContent = reports.length ? "Latest saved screening" : "No screening yet";
  if (els.oaMarkerRisk) els.oaMarkerRisk.textContent = reports.length ? `${reports[0].oaRiskScore ?? reports[0].score ?? 0}/100` : "—";
  if (els.oaMarkerRiskMeta) els.oaMarkerRiskMeta.textContent = reports.length ? `${reports[0].oaRisk || reports[0].level || "Not assessed"} • ${new Date(reports[0].dateTime || reports[0].createdAt).toLocaleString()}` : "Complete a screening to show the latest result.";
  updateInteractiveKneeVisual(reports[0] || null);

  const latestReport = reports[0];
  const completed = [
    !!state.intakeSubmitted,
    !!state.sensorSubmitted,
    !!state.occupationSubmitted,
    !!state.riskCompleted,
    !!state.reportSaved,
  ];
  const completedCount = completed.filter(Boolean).length;
  const percent = Math.round((completedCount / 5) * 100);
  if (els.overviewScreeningCount) els.overviewScreeningCount.textContent = String(reports.length);
  if (els.overviewLatestRisk) els.overviewLatestRisk.textContent = latestReport ? `${latestReport.oaRiskScore ?? latestReport.score ?? 0}/100` : "—";
  if (els.overviewLatestRiskMeta) els.overviewLatestRiskMeta.textContent = latestReport ? `${latestReport.oaRisk || latestReport.level || "Not assessed"} • ${new Date(latestReport.dateTime || latestReport.createdAt).toLocaleDateString()}` : "No screening yet";
  if (els.overviewSensorStatus) els.overviewSensorStatus.textContent = state.hardwareConnected ? (state.capturing ? "Capturing" : "Connected") : "Disconnected";
  if (els.overviewSensorMeta) els.overviewSensorMeta.textContent = state.hardwareConnected ? "ESP32 • MPU6050 ×2 • FSR ×2" : "Connect physical ESP32 hardware";
  if (els.overviewWorkflow) els.overviewWorkflow.textContent = `${completedCount} / 5`;
  if (els.overviewWorkflowMeta) els.overviewWorkflowMeta.textContent = completedCount === 5 ? "Screening complete" : `${5 - completedCount} step${5 - completedCount === 1 ? "" : "s"} remaining`;
  if (els.workflowPercent) els.workflowPercent.textContent = `${percent}% complete`;
  if (els.workflowProgress) els.workflowProgress.style.width = `${percent}%`;

  if (!reports.length) {
    if (els.recentScreenings) els.recentScreenings.innerHTML = '<div class="empty-state">No recent screenings yet. Complete and save a screening to see it here.</div>';
    return;
  }
  const recent = reports.slice(0, 5);
  if (els.recentScreenings) {
    els.recentScreenings.innerHTML = recent.map((report) => {
      const score = Number(report.oaRiskScore ?? report.score ?? 0);
      const level = report.oaRisk || report.level || "Not assessed";
      const date = new Date(report.dateTime || report.createdAt).toLocaleString();
      return `<button class="recent-screening" type="button" data-report-id="${escapeHtml(report.id ?? report.patientId ?? "")}">
        <span class="recent-avatar">${escapeHtml((report.patientName || report.patientId || "P").charAt(0).toUpperCase())}</span>
        <span class="recent-main"><strong>${escapeHtml(report.patientName || report.patientId || "Patient")}</strong><small>${escapeHtml(report.patientId || "—")} • ${escapeHtml(date)}</small></span>
        <span class="recent-risk"><b class="risk-stage-badge ${riskStageClass(level)}">${escapeHtml(level)}</b><small>${escapeHtml(score)}/100</small></span>
      </button>`;
    }).join("");
  }
}

async function renderReports() {
  const reports = await getReports();
  if (!reports.length) {
    els.dbRecordCount.textContent = '0 records';
    els.dbTableBody.innerHTML = '<tr><td colspan="20" class="db-empty-cell">No records yet — save a screening report to populate this local table.</td></tr>';
    return;
  }

  els.dbRecordCount.textContent = `${reports.length} ${reports.length === 1 ? "record" : "records"}`;
  els.dbTableBody.innerHTML = reports.map((report) => {
    const sensors = report.sensors || {};
    const occupationRisk = typeof report.occupationRisk === "number"
      ? report.occupationRisk
      : report.occupationRisk?.totalScore ?? "Not recorded";
    const occupationRiskLevel = report.occupationRiskLevel || "Not recorded";
    const pain = report.kneePain || "Not recorded";
    const mobility = report.mobilityIssue || "Not recorded";
    const oaRisk = report.oaRisk || report.level || "Not recorded";
    const oaScore = report.oaRiskScore ?? report.score ?? "Not recorded";
    const sensorValue = (direct, nested, unit, decimals) => {
      const value = direct ?? nested;
      if (value === null || value === undefined || value === "") return "Not recorded";
      const n = Number(value);
      return Number.isFinite(n) ? `${n.toFixed(decimals)} ${unit}` : escapeHtml(value);
    };
    return `
      <tr>
        <td>${escapeHtml(new Date(report.dateTime || report.createdAt).toLocaleString())}</td>
        <td><strong>${escapeHtml(report.patientId)}</strong></td>
        <td>${escapeHtml(report.patientName || "Not recorded")}</td>
        <td>${escapeHtml(report.age)}</td>
        <td>${escapeHtml(report.height ?? "Not recorded")}</td>
        <td>${escapeHtml(report.weight ?? "Not recorded")}</td>
        <td>${escapeHtml(report.bmi)}</td>
        <td>${escapeHtml(report.gender ?? "Not recorded")}</td>
        <td>${escapeHtml(pain)}</td>
        <td>${escapeHtml(report.painDurationDays ?? "Not recorded")}</td>
        <td>${escapeHtml(mobility)}</td>
        <td>${escapeHtml(report.occupation || "Not recorded")}</td>
        <td><span class="risk-badge ${riskStageClass(occupationRiskLevel)}">${escapeHtml(occupationRiskLevel)} (${escapeHtml(occupationRisk)} pts)</span></td>
        <td><span class="risk-badge ${riskStageClass(oaRisk)}">${escapeHtml(oaRisk)}</span></td>
        <td>${escapeHtml(oaScore)}</td>
        <td>${sensorValue(report.leftImu, sensors.leftImu, "g", 2)}</td>
        <td>${sensorValue(report.rightImu, sensors.rightImu, "g", 2)}</td>
        <td>${sensorValue(report.leftFsr, sensors.leftFsr, "N", 1)}</td>
        <td>${sensorValue(report.rightFsr, sensors.rightFsr, "N", 1)}</td>
        <td>
          <div class="report-table-actions">
            <button type="button" class="report-action-button report-download-button" data-report-action="download" data-report-id="${escapeHtml(report.id || "")}">Download</button>
            <button type="button" class="report-action-button report-view-button" data-report-action="view" data-report-id="${escapeHtml(report.id || "")}">View</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function buildCurrentReport() {
  const occupationRisk = calculateOccupationRisk();
  const occupationRiskLevel = occupationRisk.totalScore >= 30 ? "High" : occupationRisk.totalScore >= 15 ? "Moderate" : "Low";
  const selectedText = (element) => element.options[element.selectedIndex]?.textContent || "Not recorded";
  const now = new Date();
  return {
    id: generateId(),
    createdAt: Date.now(),
    dateTime: now.toISOString(),
    patientId: state.intakeData?.patientId || els.patientId.value || "Unknown patient",
    patientName: state.intakeData?.patientName || els.patientName.value || "Unknown patient",
    healthcareWorkerId: state.healthWorker?.username || "Not recorded",
    healthcareWorkerName: state.healthWorker?.displayName || "Not recorded",
    healthcareWorkerRole: state.healthWorker?.role || "Healthcare Worker",
    age: state.intakeData?.age ?? numberValue(els.age),
    height: state.intakeData?.height ?? numberValue(els.height),
    weight: state.intakeData?.weight ?? numberValue(els.weight),
    bmi: state.intakeData?.bmi ?? calculateBmi() ?? numberValue(els.bmi),
    gender: state.intakeData?.gender || els.gender?.value || "Not recorded",
    kneePain: state.intakeData?.kneePain || selectedText(els.pain),
    kneePainScore: state.intakeData?.kneePainScore ?? numberValue(els.pain),
    painDurationDays: state.intakeData?.painDurationDays ?? numberValue(els.painDurationDays),
    mobilityIssue: state.intakeData?.mobilityIssue || selectedText(els.mobility),
    mobilityIssueScore: state.intakeData?.mobilityIssueScore ?? numberValue(els.mobility),
    occupation: state.occupationData?.occupation || getOccupationLabel(),
    occupationRisk: occupationRisk.totalScore,
    occupationRiskLevel,
    oaRisk: riskLabel(state.risk).label,
    oaRiskScore: state.risk,
    score: state.risk,
    level: riskLabel(state.risk).label,
    sensors: { ...state.latest },
    sensorCapture: {
      status: isSensorCaptureReady() ? "Complete" : "Incomplete",
      validSamples: state.sensorQuality.validSamples,
      invalidSamples: state.sensorQuality.invalidSamples,
      lastMissingFields: [...state.sensorQuality.lastMissingFields],
      connectedDevice: state.hardwareDevice?.name || "Not connected",
    },
    leftImuX: state.latest.leftImuX,
    leftImuY: state.latest.leftImuY,
    leftImuZ: state.latest.leftImuZ,
    rightImuX: state.latest.rightImuX,
    rightImuY: state.latest.rightImuY,
    rightImuZ: state.latest.rightImuZ,
    leftGyroX: state.latest.leftGyroX,
    leftGyroY: state.latest.leftGyroY,
    leftGyroZ: state.latest.leftGyroZ,
    rightGyroX: state.latest.rightGyroX,
    rightGyroY: state.latest.rightGyroY,
    rightGyroZ: state.latest.rightGyroZ,
    leftFsrVoltage: state.latest.leftFsrVoltage,
    rightFsrVoltage: state.latest.rightFsrVoltage,
    leftImu: state.latest.leftImu,
    rightImu: state.latest.rightImu,
    leftFsr: state.latest.leftFsr,
    rightFsr: state.latest.rightFsr,
    schemaVersion: 9,
    storage: "IndexedDB",
  };
}

function pdfEscape(value) {
  return String(value ?? "Not recorded")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

function createPdfBlob(report) {
  const sensor = (v, unit) => v === null || v === undefined || Number.isNaN(Number(v))
    ? "Not recorded"
    : `${Number(v).toFixed(unit === "g" ? 2 : 1)} ${unit === "dps" ? "°/s" : unit}`;

  const dateText = new Date(report.dateTime).toLocaleString();
  const rows = [
    ["Date & Time", dateText],
    ["Patient ID", report.patientId],
    ["Patient Name", report.patientName],
    ["Healthcare Worker", report.healthcareWorkerName],
    ["Healthcare Worker ID", report.healthcareWorkerId],
    ["Age", report.age],
    ["Height (cm)", report.height],
    ["Weight (kg)", report.weight],
    ["BMI", report.bmi],
    ["Gender", report.gender],
    ["Knee Pain", report.kneePain],
    ["Pain Duration (days)", report.painDurationDays],
    ["Mobility Issue", report.mobilityIssue],
    ["Occupation", report.occupation],
    ["Occupation Risk", `${report.occupationRiskLevel} (${report.occupationRisk} pts)`],
    ["OA Risk", `${report.oaRisk}`],
    ["OA Risk Score", report.oaRiskScore],
    ["Sensor capture status", report.sensorCapture?.status || "Not recorded"],
    ["Valid sensor samples", report.sensorCapture?.validSamples ?? 0],
    ["Incomplete sensor packets", report.sensorCapture?.invalidSamples ?? 0],
    ["Missing sensor fields", (report.sensorCapture?.lastMissingFields || []).join(", ") || "None"],
  ];
  const sensorRows = [
    ["Left IMU magnitude", sensor(report.leftImu, "g")],
    ["Left IMU axes", `X ${sensor(report.leftImuX, "g")} / Y ${sensor(report.leftImuY, "g")} / Z ${sensor(report.leftImuZ, "g")}`],
    ["Right IMU magnitude", sensor(report.rightImu, "g")],
    ["Right IMU axes", `X ${sensor(report.rightImuX, "g")} / Y ${sensor(report.rightImuY, "g")} / Z ${sensor(report.rightImuZ, "g")}`],
    ["Left IMU gyroscope", `X ${sensor(report.leftGyroX, "dps")} / Y ${sensor(report.leftGyroY, "dps")} / Z ${sensor(report.leftGyroZ, "dps")}`],
    ["Right IMU gyroscope", `X ${sensor(report.rightGyroX, "dps")} / Y ${sensor(report.rightGyroY, "dps")} / Z ${sensor(report.rightGyroZ, "dps")}`],
    ["Left FSR pressure sensor", `${Math.round(Number(report.leftFsr ?? 0))} ADC / ${Number(report.leftFsrVoltage ?? 0).toFixed(2)} V`],
    ["Right FSR pressure sensor", `${Math.round(Number(report.rightFsr ?? 0))} ADC / ${Number(report.rightFsrVoltage ?? 0).toFixed(2)} V`],
  ];

  // Small self-contained PDF writer so PDF export works fully offline.
  // Uses standard PDF Helvetica fonts and needs no external library/CDN.
  const pages = [];
  let lines = [
    { text: "SmartOA Screening Report", size: 20, bold: true },
    { text: "Offline Multimodal OA Risk Screening", size: 10, bold: false },
    { text: "", size: 10 },
    { text: "Patient Information", size: 14, bold: true },
    ...rows.flatMap(([label, value]) => [
      { text: `${label}: ${value}`, size: 10, bold: false }
    ]),
    { text: "", size: 10 },
    { text: "Sensor Values", size: 14, bold: true },
    ...sensorRows.map(([label, value]) => ({ text: `${label}: ${value}`, size: 10, bold: false })),
    { text: "", size: 10 },
    { text: "Note: This screening output is not a medical diagnosis.", size: 9, bold: false },
  ];

  // Wrap long values and split onto additional pages if necessary.
  const wrapped = [];
  const maxChars = 88;
  for (const line of lines) {
    const text = String(line.text);
    if (!text) { wrapped.push(line); continue; }
    for (let i = 0; i < text.length; i += maxChars) {
      wrapped.push({ ...line, text: text.slice(i, i + maxChars) });
    }
  }
  const perPage = 34;
  for (let i = 0; i < wrapped.length; i += perPage) pages.push(wrapped.slice(i, i + perPage));

  const objects = [];
  const addObject = (body) => { objects.push(body); return objects.length; };
  const catalogId = addObject(null);
  const pagesId = addObject(null);
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds = [];

  pages.forEach((pageLines) => {
    const content = [];
    let y = 750;
    for (const line of pageLines) {
      const font = line.bold ? fontBoldId : fontId;
      const size = line.size || 10;
      content.push(`BT /F${line.bold ? 2 : 1} ${size} Tf 50 ${y} Td (${pdfEscape(line.text)}) Tj ET`);
      y -= line.size >= 18 ? 28 : line.size >= 14 ? 22 : 18;
    }
    const stream = content.join("\n");
    const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n%SmartOA-Offline-PDF\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets[index + 1] = pdf.length;
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function downloadReport(report) {
  const blob = createPdfBlob(report);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `SmartOA_Report_${String(report.patientId).replace(/[^a-z0-9_-]/gi, "_")}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resetSensors() { resetSensorReadings(); }

function updateAll() {
  calculateBmi();
  const factors = calculateRisk();
  updateTelemetryUi();
  updateRiskUi(factors);
  updateSensorPlacementVisual();
  drawChart();
}

const submitStatusTimers = new WeakMap();
function showSubmitStatus(element, message) {
  element.textContent = message;
  element.classList.add("visible");
  const previous = submitStatusTimers.get(element);
  if (previous) clearTimeout(previous);
  const timer = setTimeout(() => {
    element.classList.remove("visible");
    element.textContent = "";
    submitStatusTimers.delete(element);
  }, 3000);
  submitStatusTimers.set(element, timer);
}

function validatePatientForm() {
  const name = els.patientName.value.trim();
  const nameValid = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '\-'][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/.test(name);
  if (!nameValid) {
    els.patientName.setCustomValidity("Patient name must contain letters, spaces, hyphens or apostrophes only.");
  } else {
    els.patientName.setCustomValidity("");
  }
  if (!els.form.checkValidity()) {
    els.form.reportValidity();
    return false;
  }
  return true;
}

els.patientName.addEventListener("input", () => {
  const cleaned = els.patientName.value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ'\- ]/g, "");
  if (cleaned !== els.patientName.value) els.patientName.value = cleaned;
  els.patientName.setCustomValidity("");
  state.intakeSubmitted = false;
  els.intakeSubmitStatus.classList.remove("visible");
});

els.form.addEventListener("input", updateAll);
els.form.addEventListener("change", updateAll);
els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!validatePatientForm()) return;
  const selectedText = (element) => element.options[element.selectedIndex]?.textContent || "Not recorded";
  state.intakeData = {
    patientId: els.patientId.value.trim(),
    patientName: els.patientName.value.trim(),
    age: numberValue(els.age),
    height: numberValue(els.height),
    weight: numberValue(els.weight),
    bmi: calculateBmi() ?? numberValue(els.bmi),
    gender: els.gender.value,
    kneePain: selectedText(els.pain),
    kneePainScore: numberValue(els.pain),
    painDurationDays: numberValue(els.painDurationDays),
    mobilityIssue: selectedText(els.mobility),
    mobilityIssueScore: numberValue(els.mobility),
  };
  state.intakeSubmitted = true;
  showSubmitStatus(els.intakeSubmitStatus, "Submitted successfully");
  els.form.reset();
  els.patientName.setCustomValidity("");
  updateAll();
});

els.occupationForm.addEventListener("input", () => {
  state.occupationSubmitted = false;
  els.occupationSubmitStatus.classList.remove("visible");
  updateOccupationUi();
});
els.occupationForm.addEventListener("change", () => {
  state.occupationSubmitted = false;
  els.occupationSubmitStatus.classList.remove("visible");
  updateOccupationUi();
});
els.occupationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!els.occupationForm.checkValidity()) {
    els.occupationForm.reportValidity();
    return;
  }
  const selectedText = (element) => element.options[element.selectedIndex]?.textContent || "Not recorded";
  state.occupationData = {
    occupationType: els.occupationType.value,
    occupation: selectedText(els.occupationType),
    standingHours: numberValue(els.standingHours),
    liftingFreq: numberValue(els.liftingFreq),
    repetitiveMovements: numberValue(els.repetitiveMovements),
  };
  state.occupationSubmitted = true;
  showSubmitStatus(els.occupationSubmitStatus, "Submitted successfully");
  els.occupationForm.reset();
  updateOccupationUi();
  updateAll();
});

window.addEventListener("hashchange", () => showRoute(currentRoute()));

els.startStream.addEventListener("click", async () => {
  try {
    await connectHardware();
  } catch (error) {
    setNotification(error?.message || "Unable to connect to the ESP32.", false);
    els.streamState.textContent = "Connection failed";
  }
});

els.stopStream.addEventListener("click", () => {
  state.capturing = false;
  state.sensorSubmitted = isSensorCaptureReady();
  els.streamState.textContent = state.hardwareConnected ? "Connected • capture stopped" : "Hardware disconnected";
  if (state.sensorSubmitted) setNotification("Real sensor capture stopped. The latest MPU6050 and FSR readings are ready for analysis.", true);
  else setNotification("Capture stopped, but the report needs at least 10 complete sensor samples. Check both MPU6050 and FSR connections.", false);
  updateAll();
});

els.exitStream.addEventListener("click", async () => {
  try {
    if (state.hardwareCharacteristic) {
      try { await state.hardwareCharacteristic.stopNotifications(); } catch (_) {}
      state.hardwareCharacteristic.removeEventListener("characteristicvaluechanged", handleBleNotification);
    }
    if (state.hardwareDevice?.gatt?.connected) state.hardwareDevice.gatt.disconnect();
  } finally {
    handleHardwareDisconnected();
  }
});

async function handleSaveReport() {
  if (!isSensorCaptureReady()) {
    setNotification("Connect the ESP32 and capture at least 10 complete sensor samples before saving a final risk report.", false);
    return;
  }
  const report = buildCurrentReport();
  await saveReport(report);
  state.riskCompleted = true;
  state.reportSaved = true;
  await renderReports();
  await renderOverview();
  setNotification(localizedNotification("analysis", report), true);
  downloadReport(report);
}

els.saveReportInline.addEventListener("click", handleSaveReport);

els.resetSensors.addEventListener("click", resetSensors);

async function handleReportAction(action, reportId) {
  const reports = await getReports();
  const report = reports.find((item) => String(item.id) === String(reportId));
  if (!report) return;
  if (action === "view") {
    applyReportPreview(report);
    const panel = document.querySelector("#reportPreviewPanel");
    panel?.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (action === "download") downloadReport(report);
}

els.dbTableBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-report-action]");
  if (!button) return;
  handleReportAction(button.dataset.reportAction, button.dataset.reportId);
});

els.recentScreenings.addEventListener("click", async (event) => {
  const item = event.target.closest("[data-report-id]");
  if (!item) return;
  const reports = await getReports();
  const report = reports.find((entry) => String(entry.id) === String(item.dataset.reportId));
  if (report) {
    applyReportPreview(report);
    const panel = document.querySelector("#reportPreviewPanel");
    if (currentRoute() === "overview") {
      window.location.hash = "#/reports";
      setTimeout(() => panel?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    }
  }
});

function localizedNotification(type, report = null) {
  const id = report?.patientId || "patient";
  const level = report?.oaRisk || report?.level || "Not assessed";
  const messages = {
    en: { sensorStart:"ESP32 is connected. Real joint movement and pressure readings are being captured.", sensorStop:"Real sensor capture stopped. The latest hardware readings remain visible.", sensorExit:"ESP32 disconnected. SmartOA is ready for the next hardware capture.", analysis:`Analysis successfully completed for ${id}. OA risk: ${level}. Report saved and PDF download started.` },
    as: { sensorStart:"চেন্সৰ ষ্ট্ৰিম সক্ৰিয়। IMU ডেমোৰ পৰা জয়েন্ট চলন আপডেট হৈছে।", sensorStop:"চেন্সৰ ষ্ট্ৰিম বন্ধ হৈছে। শেষ চলন মান ডেশ্বব'ৰ্ডত আছে।", sensorExit:"চেন্সৰ ছেছন শেষ। SmartOA পৰৱৰ্তী স্ক্ৰিনিঙৰ বাবে সাজু।", analysis:`${id}-ৰ বিশ্লেষণ সফলভাৱে সম্পূৰ্ণ হৈছে। OA ঝুঁকি: ${level}। প্ৰতিবেদন সংৰক্ষণ আৰু PDF ডাউনলোড আৰম্ভ হৈছে।` },
    bn: { sensorStart:"সেন্সর স্ট্রিম সক্রিয়। IMU ডেমো থেকে জয়েন্ট মুভমেন্ট আপডেট হচ্ছে।", sensorStop:"সেন্সর স্ট্রিম বন্ধ হয়েছে। শেষ মুভমেন্ট মান ড্যাশবোর্ডে আছে।", sensorExit:"সেন্সর সেশন শেষ। SmartOA পরবর্তী স্ক্রিনিংয়ের জন্য প্রস্তুত।", analysis:`${id}-এর বিশ্লেষণ সফলভাবে সম্পন্ন হয়েছে। OA ঝুঁকি: ${level}। রিপোর্ট সংরক্ষণ ও PDF ডাউনলোড শুরু হয়েছে।` },
    brx: { sensorStart:"सेन्सर स्ट्रीम जागाय। IMU डेमो नि जोइन्ट नावजाबाय अपडेट जायो।", sensorStop:"सेन्सर स्ट्रीम बन्द। जोबथा नावजाबाय मान डेशबोर्डाव दं।", sensorExit:"सेन्सर सेसन फुरा। SmartOA उनाव स्क्रिनिंनि थाखाय रेडी।", analysis:`${id} नि एनालिसिस फुरा। OA रिस्क: ${level}। रिपोर्ट सेभ आरो PDF डाउनलोड जागाय।` },
    mni: { sensorStart:"ꯁꯦꯟꯁꯔ ꯏꯁꯇ꯭ꯔꯤꯝ ꯁꯦꯝꯕꯥ। IMU ꯗꯦꯃꯣꯒꯤ ꯃꯥꯔꯣꯜ ꯑꯄꯗꯦꯠ ꯇꯧꯔꯤ।", sensorStop:"ꯁꯦꯟꯁꯔ ꯏꯁꯇ꯭ꯔꯤꯝ ꯂꯣꯏꯁꯤꯟꯂꯦ। ꯂꯣꯏꯁꯤꯟꯕ ꯃꯥꯔꯣꯜ ꯃꯇꯥꯡ ꯑꯃꯨꯛ ꯎꯠꯂꯤ।", sensorExit:"ꯁꯦꯟꯁꯔ ꯁꯦꯁꯟ ꯂꯣꯏꯁꯤꯟꯂꯦ। SmartOA ꯑꯅꯧꯕ ꯆꯦꯛꯀꯤꯡꯒꯤ ꯊꯥꯛ ꯁꯦꯝꯂꯦ।", analysis:`${id} ꯒꯤ ꯑꯦꯅꯥꯂꯥꯏꯁꯤꯁ ꯂꯣꯏꯁꯤꯜꯂꯦ। OA ꯔꯤꯁ꯭ꯀ: ${level}। ꯔꯤꯄꯣꯔꯠ ꯁꯦꯚ ꯑꯃꯁꯨꯡ PDF ꯗꯥꯎꯅꯂꯣꯗ ꯍꯧꯖꯤꯟꯂꯦ।` },
    kha: { sensorStart:"Ka sensor stream ka treikam. Ka jingïaid joint ka update na ka IMU demo.", sensorStop:"La pynsangeh sensor stream. Ki value ba khatduh ki dang paw.", sensorExit:"Ka sensor session ka la kut. SmartOA ka la pynkhreh ïa ka screening kaba bud.", analysis:`Ka analysis jong ${id} ka la dep bha. OA risk: ${level}. La buh ïa ka report bad la sdang PDF download.` },
    lus: { sensorStart:"Sensor stream a kal mek. IMU demo atangin joint movement a update.", sensorStop:"Sensor stream a tawp. Movement value hnuhnung chu dashboard-ah a lang.", sensorExit:"Sensor session a tawp. SmartOA chu screening thar tan turin a inbuatsaih.", analysis:`${id} chuan analysis a zo. OA risk: ${level}. Report dah leh PDF download a tan.` },
    grt: { sensorStart:"Sensor stream ka active. Joint movement ka IMU demo ni update ong-a.", sensorStop:"Sensor stream ka stop. Movement value mikka dashboard-o dong.", sensorExit:"Sensor session ka finish. SmartOA ka screening gipin ong-a ready.", analysis:`${id} ni analysis ka finish. OA risk: ${level}. Report save aro PDF download ka start.` },
    kok: { sensorStart:"Sensor stream active. Joint movement IMU demo nwi update.", sensorStop:"Sensor stream stop. Last movement value dashboard-o dong.", sensorExit:"Sensor session finish. SmartOA screening nwi ready.", analysis:`${id} ni analysis finish. OA risk: ${level}. Report save aro PDF download start.` }
  };
  return (messages[currentLanguage] || messages.en)[type] || messages.en[type];
}

function clearStoredNotification() {
  localStorage.removeItem(notificationStorageKey);
  if (els.notificationBar) els.notificationBar.setAttribute("hidden", "");
  if (els.notificationButton) els.notificationButton.setAttribute("aria-expanded", "false");
  const dot = document.querySelector(".notification-dot");
  if (dot) dot.hidden = true;
}

function restoreNotification() {
  try {
    const saved = JSON.parse(localStorage.getItem(notificationStorageKey) || "null");
    if (!saved || !saved.createdAt || Date.now() - saved.createdAt >= notificationLifetimeMs) {
      clearStoredNotification();
      return;
    }
    if (els.notificationText) els.notificationText.textContent = saved.message;
    if (els.notificationBar) els.notificationBar.setAttribute("hidden", "");
    const dot = document.querySelector(".notification-dot");
    if (dot) dot.hidden = false;
    window.clearTimeout(window.smartOANotificationTimer);
    window.smartOANotificationTimer = window.setTimeout(clearStoredNotification, notificationLifetimeMs - (Date.now() - saved.createdAt));
  } catch (_) {
    clearStoredNotification();
  }
}

function setNotification(message, open = false) {
  const payload = { message, createdAt: Date.now() };
  localStorage.setItem(notificationStorageKey, JSON.stringify(payload));
  if (els.notificationText) els.notificationText.textContent = message;
  if (els.notificationBar) {
    if (open) els.notificationBar.removeAttribute("hidden");
    else els.notificationBar.setAttribute("hidden", "");
  }
  if (els.notificationButton) els.notificationButton.setAttribute("aria-expanded", open ? "true" : "false");
  const dot = document.querySelector(".notification-dot");
  if (dot) dot.hidden = false;
  window.clearTimeout(window.smartOANotificationTimer);
  window.smartOANotificationTimer = window.setTimeout(clearStoredNotification, notificationLifetimeMs);
}

els.notificationButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  if (!els.notificationBar) return;
  const willOpen = els.notificationBar.hasAttribute("hidden");
  if (willOpen) {
    els.settingsPopover?.setAttribute("hidden", "");
    els.settingsButton?.setAttribute("aria-expanded", "false");
    els.notificationBar.removeAttribute("hidden");
  } else {
    els.notificationBar.setAttribute("hidden", "");
  }
  els.notificationButton.setAttribute("aria-expanded", willOpen ? "true" : "false");
});

document.addEventListener("click", (event) => {
  if (!els.notificationBar || els.notificationBar.hasAttribute("hidden")) return;
  if (event.target === els.notificationClose || els.notificationClose?.contains(event.target)) return;
  els.notificationBar.setAttribute("hidden", "");
  els.notificationButton?.setAttribute("aria-expanded", "false");
});

els.notificationClose?.addEventListener("click", (event) => {
  event.stopPropagation();
  clearStoredNotification();
});

els.settingsButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  const open = els.settingsPopover?.hasAttribute("hidden");
  if (!els.settingsPopover) return;
  if (open) {
    els.notificationBar?.setAttribute("hidden", "");
    els.notificationButton?.setAttribute("aria-expanded", "false");
    els.settingsPopover.removeAttribute("hidden");
  } else {
    els.settingsPopover.setAttribute("hidden", "");
  }
  els.settingsButton.setAttribute("aria-expanded", open ? "true" : "false");
});

els.settingsLogout?.addEventListener("click", logout);
document.addEventListener("click", (event) => {
  if (els.settingsPopover && !els.settingsPopover.hasAttribute("hidden") && !els.settingsPopover.contains(event.target) && !els.settingsButton?.contains(event.target)) {
    els.settingsPopover.setAttribute("hidden", "");
    els.settingsButton?.setAttribute("aria-expanded", "false");
  }
});

let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const button = document.getElementById("installAppButton");
  if (button && !isStandaloneApp()) {
    button.hidden = false;
    button.disabled = false;
    button.removeAttribute("aria-disabled");
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("../../sw.js", { updateViaCache: "none" }).then(reg => reg.update().catch(() => {})).catch(() => {});
}

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function setupAppInstall() {
  const button = document.getElementById("installAppButton");
  if (!button) return;
  if (isStandaloneApp()) { button.hidden = true; return; }
  button.hidden = false;
  button.disabled = false;

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    button.hidden = true;
    showNotification("SmartOA was installed successfully.");
  });

  button.addEventListener("click", async () => {
    if (isStandaloneApp()) return;
    if (deferredInstallPrompt) {
      const promptEvent = deferredInstallPrompt;
      deferredInstallPrompt = null;
      try {
        promptEvent.prompt();
        const result = await promptEvent.userChoice;
        if (result?.outcome === "accepted") {
          button.hidden = true;
          return;
        }
      } catch (_) { /* fall through to browser instructions */ }
      button.hidden = false;
      return;
    }
    const ua = navigator.userAgent;
    let message = "SmartOA can be installed as an app. Open your browser menu and choose Install SmartOA or Install this site as an app.";
    if (/iPhone|iPad|iPod/i.test(ua)) message = "To install SmartOA on iPhone/iPad, tap Share and choose Add to Home Screen.";
    else if (/Android/i.test(ua)) message = "To install SmartOA on Android, open the browser menu and choose Install app or Add to Home screen.";
    showNotification(message, false);
  });
}

async function initializeApp() {
  const authenticated = await ensureAuthenticated();
  if (!authenticated) return;
  validateElements();
  initInteractiveVisuals();
  renderWorkerIdentity();
  initLanguageSupport();
  setupAppInstall();
  els.logoutButton.addEventListener("click", logout);
  showRoute(currentRoute());
  updateAll();
  const recoveredCount = await recoverLegacyReports();
  await renderReports();
  await renderOverview();
  restoreNotification();
  if (recoveredCount > 0) setNotification(`Recovered ${recoveredCount} previous local screening record${recoveredCount === 1 ? "" : "s"}.`, true);
  setInterval(updateAll, 1000);
  setInterval(renderOverview, 5000);
}

initializeApp();
