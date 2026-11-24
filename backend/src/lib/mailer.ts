import nodemailer from "nodemailer";

const enabled = Boolean(process.env.SMTP_HOST);

const transporter = enabled
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  : null;

export async function sendMail(to: string, subject: string, html: string) {
  if (!enabled || !transporter) {
    console.info(`[mail:skipped] to=${to} subject=${subject}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    html,
  });
}

export async function bookingConfirmationEmail(
  to: string,
  details: { ground: string; spot: string; start: Date; end: Date; total: number }
) {
  await sendMail(
    to,
    "SmartPark booking confirmed",
    `<p>Your parking is confirmed at <strong>${details.ground}</strong>.</p>
     <p>Spot: <strong>${details.spot}</strong></p>
     <p>${details.start.toLocaleString()} – ${details.end.toLocaleString()}</p>
     <p>Total: $${details.total.toFixed(2)}</p>`
  );
}

export async function expiryWarningEmail(to: string, spot: string, end: Date) {
  await sendMail(
    to,
    "SmartPark session expiring soon",
    `<p>Your session at spot <strong>${spot}</strong> ends at ${end.toLocaleString()}.</p>
     <p>Extend now in the app to avoid extra charges.</p>`
  );
}

export async function receiptEmail(to: string, amount: number, ground: string) {
  await sendMail(
    to,
    "SmartPark payment receipt",
    `<p>Thank you. We received $${amount.toFixed(2)} for parking at ${ground}.</p>`
  );
}
