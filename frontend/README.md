# Frontend

This is the React frontend for the project.  
It runs inside Docker and connects to the Flask backend API.

---

## 🚀 How to run

Follow instructions under `docs/docker.md`. 

Then reach the application on localhost:3000. 

## 📂 Structure of frontend folder
````
frontend/
├── public/
│   └── index.html             # Root (only) HTML file, where React mounts from
└── src/
    ├── components/            # Reusable UI components
    ├── pages/                 # Full pages (aka a tab)
    ├── layouts/               # Page layouts (e.g. Navbar + Footer)
    ├── styles/                # CSS
    ├── utils/                 # Helper functions that we can reuse (API calls etc.)
    ├── App.js                 # Main app component
    ├── index.js               # Entry point
    └── routes.js              # Router configuration for React
````

## 🔗 Frontend ↔ Backend

The frontend fetches data from the backend using helper functions in src/utils/api.js.  
Example:
````
fetch("http://localhost:5000/hello")
  .then(res => res.json())
  .then(data => console.log(data.message));
````

## ⚡ Best prectices 
* Small, reusable UI = `components/`
* Full screens/tabs = `pages/`
* Common layouts = `layouts/`
* Shared helpers = `utils/`
* Never commit node_modules/
* Always commit package.json + package-lock.json