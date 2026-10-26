// Site-wide settings. Loaded first on every page.
//
// API_URL: base URL of the backend REST API. Leave it empty to run the site in
// demo mode, where js/demo-api.js answers every request with sample data that is
// kept in the browser, so the whole site can be tried without a server.
window.API_URL = "";

window.DEMO_MODE = !window.API_URL;
if (window.DEMO_MODE) window.API_URL = "https://demo.api.local";

// Absolute URL of the site root, so redirects work from any folder and when the
// site is hosted under a sub-path (for example GitHub Pages).
window.SITE_ROOT = new URL("..", document.currentScript.src).href;
