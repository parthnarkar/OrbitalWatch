# OrbitalWatch Frontend

OrbitalWatch is a modern, high-performance, real-time Space Situational Awareness (SSA) dashboard that tracks orbiting objects, calculates collision risks (conjunctions), and visualizes satellites on an interactive 3D Earth.

The frontend is built using **React 19**, **Vite 6**, **Three.js**, **React Three Fiber (R3F)**, and **Recharts**.

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v18.0.0 or higher) and [npm](https://www.npmjs.com/) installed on your machine.

### Installation

Clone the repository and navigate to the frontend directory:

```bash
cd frontend
npm install
```

### Development Server

Start the local development server with Hot Module Replacement (HMR):

```bash
npm run dev
```

Once running, open [http://localhost:5173](http://localhost:5173) in your browser to view the application.

---

## 📦 Build & Production

To compile the application into static assets optimized for production:

```bash
npm run build
```

This will output all bundled, minified code to the `dist/` directory, which can be deployed to any static site hosting provider (e.g., Vercel, Netlify, AWS S3).

To preview the production build locally:

```bash
npm run preview
```

---

## ⚙️ Environment Variables

The application uses Vite environment variables. You can configure them in `.env`, `.env.local`, or `.env.production` files.

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base URL of the backend REST API | `/api` or `http://localhost:8000/api` |
| `VITE_WS_URL` | Base URL of the backend WebSocket server | `/` or `ws://localhost:8000` |

---

## 🌐 Browser Support

OrbitalWatch uses modern 3D graphics (WebGL via Three.js), CSS Grid/Flexbox, and modern JS syntax. It supports the latest **two versions** of all major web browsers:

*   **Google Chrome** (and Chromium-based browsers like Edge, Brave, Opera)
*   **Mozilla Firefox**
*   **Apple Safari** (macOS & iOS)

> [!IMPORTANT]
> Make sure WebGL is enabled in your browser settings to render the 3D globe properly.

---

## 🎹 Keyboard Shortcuts

You can control the dashboard quickly using the following keyboard hotkeys:

*   `/` — Focus Search Bar
*   `a` — Switch to Conjunction Alerts View
*   `g` — Switch to Globe View
*   `f` — Toggle following/locking camera to the selected satellite
*   `d` — Toggle Demo Mode
*   `Escape` — Close any open overlays or panels
*   `?` — Open Keyboard Shortcuts Help Modal
