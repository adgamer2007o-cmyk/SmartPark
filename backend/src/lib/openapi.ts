export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "SmartPark API",
    version: "1.0.0",
    description: "Parking management REST API for students, faculty, and visitors.",
  },
  servers: [{ url: "/api" }],
  paths: {
    "/auth/register": { post: { summary: "Register", tags: ["Auth"] } },
    "/auth/login": { post: { summary: "Login", tags: ["Auth"] } },
    "/auth/google": { post: { summary: "Google OAuth", tags: ["Auth"] } },
    "/auth/logout": { post: { summary: "Logout", tags: ["Auth"] } },
    "/auth/refresh": { post: { summary: "Refresh tokens", tags: ["Auth"] } },
    "/auth/me": { get: { summary: "Current user", tags: ["Auth"] }, put: { summary: "Update profile", tags: ["Auth"] } },
    "/grounds": { get: { summary: "List grounds", tags: ["Grounds"] }, post: { summary: "Create ground", tags: ["Grounds"] } },
    "/grounds/{id}": {
      get: { summary: "Ground details", tags: ["Grounds"] },
      put: { summary: "Update ground", tags: ["Grounds"] },
      delete: { summary: "Delete ground", tags: ["Grounds"] },
    },
    "/assign-spot": { post: { summary: "Assign optimal spot", tags: ["Assignment"] } },
    "/scan": { post: { summary: "Process scanned QR", tags: ["Assignment"] } },
    "/bookings": { get: { summary: "User bookings", tags: ["Bookings"] }, post: { summary: "Create booking", tags: ["Bookings"] } },
    "/payments/create-intent": { post: { summary: "Create Stripe intent", tags: ["Payments"] } },
    "/admin/stats": { get: { summary: "Admin KPIs", tags: ["Admin"] } },
    "/admin/reports/export": { get: { summary: "Export CSV", tags: ["Admin"] } },
  },
};
