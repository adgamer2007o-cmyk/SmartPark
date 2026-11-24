import { app, expireStale } from "./app.js";

const port = Number(process.env.PORT || 4000);

setInterval(() => {
  expireStale().catch((e) => console.warn("expire job", e));
}, 60_000);

app.listen(port, () => {
  console.log(`SmartPark API listening on http://localhost:${port}`);
  console.log(`API docs: http://localhost:${port}/api/docs`);
});
