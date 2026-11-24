export function param(req: { params: Record<string, string | string[] | undefined> }, name = "id") {
  const value = req.params[name];
  if (typeof value === "string" && value.length) return value;
  if (Array.isArray(value) && value[0]) return value[0];
  throw Object.assign(new Error("Missing route parameter"), { status: 400 });
}
