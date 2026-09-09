import nodemailer from 'nodemailer'

const HOST = process.env.SMTP_HOST
const PORT = Number(process.env.SMTP_PORT || 587)
const USER = process.env.SMTP_USER
const PASS = process.env.SMTP_PASS
const FROM = process.env.MAIL_FROM || 'no-reply@ojtconnect.com'
const FROM_NAME = process.env.MAIL_FROM_NAME || 'OJT Connect'

const transport = HOST
  ? nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: PORT === 465,
      auth: USER ? { user: USER, pass: PASS } : undefined
    })
  : null

function accountRequestEmail({ to, kind, orgName, status }) {
  const role = kind === 'school' ? 'school' : 'company'
  const who = orgName || (kind === 'school' ? 'your school' : 'your company')
  if (status === 'approved') {
    return {
      subject: 'Your OJT Connect account request was approved ✅',
      text: `Hello,

Good news! Your ${role} account request (${who}) has been APPROVED by our administrator.

We will contact you within 1-2 days with your login credentials and next steps so you can start using OJT Connect.

Thank you,
The OJT Connect Team`
    }
  }
  return {
    subject: 'Update on your OJT Connect account request',
    text: `Hello,

We're sorry, but your ${role} account request (${who}) was DECLINED by our administrator.

If you believe this is a mistake, or if you have any questions, please reach out to us through the "Chat with us" widget on the OJT Connect website and our support team will assist you. You may also submit a new request with updated documents.

Thank you,
The OJT Connect Team`
  }
}

export async function sendAccountRequestEmail(opts) {
  const { subject, text } = accountRequestEmail(opts)
  if (transport) {
    try {
      await transport.sendMail({
        from: `"${FROM_NAME}" <${FROM}>`,
        to: opts.to,
        subject,
        text
      })
      console.log(`[MAIL] Sent "${subject}" to ${opts.to}`)
    } catch (err) {
      console.error(`[MAIL] Failed to send to ${opts.to}:`, err.message)
    }
    return
  }
  console.log('── [MAIL DEV] no SMTP configured, email not actually sent ──')
  console.log(`  To:      ${opts.to}`)
  console.log(`  Subject: ${subject}`)
  console.log(`  Body:    ${text.split('\n')[0]}…`)
}