# SmartOA — Start Here

This file is the quickest hand-off guide for a new team member.

## Project flow
**Login → Patient Intake → Sensors → Occupation → Risk Result → Reports**

### Data flow
**Patient information + ESP32 sensor readings → feature extraction → ML model → OA risk → report**

### What each major folder does
| Order | Folder/File | Purpose |
|---|---|---|
| 01 | `01_Documentation/` | Readme and technical documentation |
| 02 | `02_Frontend/` | CSS, JavaScript and images used by the web UI |
| 03 | `03_Hardware/` | ESP32 BLE firmware and sensor wiring |
| 04 | `04_Data/` | Server-side healthcare-worker user data |
| 05 | `05_Security/` | Security review and hardening notes |
| 06 | `06_Developer_Tools/` | Optional scripts used while developing/editing |

## Start the app
```text
node server.js
```
Then open:
`http://127.0.0.1:4173/`

## Hardware
Open `03_Hardware/README.md` before connecting sensors.

## ML
The hardware only collects measurements. The ML model must be trained separately using labelled data and then integrated after feature extraction.

## Important
Do not move runtime files or rename asset paths casually. `server.js`, `sw.js`, the HTML entry pages, and the paths under `02_Frontend/` are connected. If a file is intentionally moved, update the corresponding references.
