import QRCode from "qrcode";

export type QrKind = "ENTRANCE" | "EXIT" | "SPOT" | "TICKET";

export function qrPayload(kind: QrKind, id: string) {
  return JSON.stringify({ v: 1, kind, id });
}

export async function toDataUrl(data: string) {
  return QRCode.toDataURL(data, { margin: 1, width: 320, errorCorrectionLevel: "M" });
}

export async function toSvg(data: string) {
  return QRCode.toString(data, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
}
