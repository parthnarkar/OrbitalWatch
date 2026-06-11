# Product Requirement Document (PRD) — OrbitalWatch

## 1. Executive Summary & Problem Statement
Currently, there are over **40,000 tracked objects** orbiting the Earth in Low Earth Orbit (LEO) and Geostationary Orbit (GEO). Managing the risks associated with space debris collisions requires rapid, accessible, and automated tracking. Professional Space Situational Awareness (SSA) software is prohibitively expensive ($10,000 - $100,000+ per year), keeping small satellite operators, academic university labs, and researchers locked out.

**OrbitalWatch** is an open-source, web-based, real-time Space Traffic Control and Conjunction Analysis Dashboard. It parses live Two-Line Element (TLE) datasets, performs SGP4 orbital propagation, calculates proximity collision risks, and streams real-time coordinate updates to an interactive 3D WebGL globe.

---

## 2. Target Audience & Users
*   **Small Satellite Operators**: Need to monitor their payloads and receive alerts on upcoming proximity events in the next 72 hours.
*   **Academic Space Labs**: Need an interactive 3D tool to study orbital dynamics and catalog satellite groups (e.g., GPS, weather, Starlink, Cosmos).
*   **Space Debris Researchers**: Need altitude-band density distributions and conjunction maps.

---

## 3. Product Specifications & Features

### Core Feature 1: Real-Time SGP4 Orbit Propagation
*   **Description**: Ingest standard TLE data from CelesTrak and propagate coordinates using Python's `sgp4` and `skyfield` engines.
*   **Metrics**: Calculate latitude, longitude, geocentric XYZ coordinate, velocity, and orbital period.
*   **Optimization**: Cache parsed `EarthSatellite` models in-memory to prevent CPU-heavy TLE string parsing.

### Core Feature 2: 3D Globe Visualisation
*   **Description**: Display a fully interactive 3D Earth using React Three Fiber, OrbitControls, and customizable shaders.
*   **Details**:
    *   Plot satellites using instanced rendering (`InstancedMesh`) for fast performance up to 500+ items.
    *   Differentiate satellites by color codes (Payloads: Green, Debris: Red, Rocket Bodies: Orange, Unknown: Grey).
    *   Show detailed orbit trails and camera tracking hooks for selected satellites.

### Core Feature 3: Conjunction Detection & Analysis
*   **Description**: Perform proximity evaluations between active objects in the database.
*   **Details**:
    *   Flag close approaches within a 5 km threshold over the next 72 hours.
    *   Perform a coarse filtering scan (geocentric radial shell overlap) followed by a fine-grained 1-minute step propagation scan.
    *   Evaluate collision probability based on miss distance and relative velocity.

### Core Feature 4: Alert Panel & Notifications
*   **Description**: A tabular list of conjunction warnings sortable by severity (HIGH, MEDIUM, LOW) and approach time. Includes simulated real-time alert toast notifications.

---

## 4. Non-Functional Requirements
*   **Performance**: Database query times under 150ms using optimized batched `IN` queries (solving the N+1 problem).
*   **Scalability**: Cache results and support horizontal scaling of workers for large TLE batch propagation.
*   **Compatibility**: WebGL 2.0 support in all modern desktop and mobile browsers.
