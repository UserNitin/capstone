# BloodConnect 360 — Frontend Only

A responsive multi-page frontend prototype for the BloodConnect 360 Smart Emergency Blood Donor Finder and Blood Request Management System.

## Run it
1. Extract the ZIP file.
2. Open the folder in VS Code.
3. Open `index.html` directly in a browser, or use the VS Code Live Server extension.
4. No backend, database, build step, or API key is required.

## Pages
- `index.html` — landing page, project overview, how it works, user roles and safety notice
- `find-blood.html` — sample donor directory with blood-group, city, and availability filters
- `login.html` — demo login and role selection
- `register.html` — local demo profile registration
- `request-blood.html` — create and review locally saved demo blood requests
- `dashboard.html` — role-aware demo dashboard, quick actions and local request history
- `style.css` — responsive styles
- `app.js` — sample data and frontend interactions

## What works in this frontend
- Responsive desktop/mobile navigation
- Donor directory filtering
- Demo registration and login role selection
- Creating blood requests and saving them in browser `localStorage`
- Dashboard summaries and locally saved request list

## Limitations
This is frontend-only. Data is stored only in the current browser and is not shared across users or devices. Login is not real authentication. Donor profiles are synthetic sample data. No real donor notifications, hospital verification, geolocation matching, medical compatibility checks, or backend security are implemented. Do not use this prototype for actual medical decisions or emergencies. Hospitals/blood banks must handle eligibility, compatibility, testing, and transfusion decisions.
