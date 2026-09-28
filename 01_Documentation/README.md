# SmartOA — Team Guide

## 1. What this project is
SmartOA is an offline-first osteoarthritis risk-screening prototype. The current hardware path uses a real ESP32, two MPU6050 IMUs, and two FSR pressure sensors. The sensor readings are collected by the web app; an ML model is the next intelligence layer that converts extracted features into an OA-risk prediction.

## 2. Folder sequence

```text
SmartOA/
├── 00_START_HERE.md                 ← read this first
├── 01_Documentation/                ← project and hardware documentation
├── 02_Frontend/                     ← HTML support assets: CSS, JS, images
├── 03_Hardware/                     ← ESP32 firmware + wiring
├── 04_Data/                         ← server-side user store
├── 05_Security/                     ← security audit/checklist
├── 06_Developer_Tools/              ← optional developer/editing scripts
├── index.html                        ← main screening console
├── login.html                        ← healthcare-worker login
├── server.js                         ← local Node server + API/authentication
├── sw.js                             ← PWA service worker
├── manifest.webmanifest              ← PWA manifest
├── privacy.html / terms.html         ← draft legal pages
├── .env.example                      ← server configuration template
└── logs/                             ← server security logs
```

## 3. Run the website
1. Install Node.js.
2. From the project root run `node server.js`.
3. Open `http://127.0.0.1:4173/`.
4. Sign in using an account configured in `04_Data/users.json`.

## 4. Hardware workflow
1. Flash `03_Hardware/ESP32_SmartOA_BLE.ino` to the ESP32.
2. Connect the two MPU6050 modules and two FSR dividers according to `03_Hardware/README.md`.
3. Open the Sensors module.
4. Select **Connect ESP32**.
5. Capture real accelerometer, gyroscope, and FSR readings.

## 5. ML workflow
Hardware readings are data acquisition, not the AI model. The intended pipeline is:

```text
Patient questionnaire + IMU + FSR
              ↓
       Feature extraction
              ↓
       Trained ML model
              ↓
      OA risk prediction
              ↓
     Risk Result + Report
```

The current prototype should not be presented as a clinically validated diagnostic system. A trained and validated model with appropriately labelled data is required before making clinical-performance claims.

## 6. Important file ownership
- **Frontend behavior:** `02_Frontend/assets/js/app.js`
- **Login behavior:** `02_Frontend/assets/js/login.js`
- **Main styling:** `02_Frontend/assets/css/styles.css`
- **Authentication/server:** `server.js`
- **ESP32 firmware:** `03_Hardware/ESP32_SmartOA_BLE.ino`
- **Sensor wiring:** `03_Hardware/README.md`
- **Users:** `04_Data/users.json`
