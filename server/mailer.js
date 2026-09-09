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

We have created your account and you should receive a separate email with your login credentials. For security, you will be asked to set your own password the first time you sign in.

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

export async function sendInviteEmail({ to, studentId, schoolName, courseName, roomName }) {
  const subject = 'Your school invited you to OJT Connect 🎓'
  const text = `Hello,

${schoolName || 'Your school'} has invited you to track your OJT on OJT Connect.

So we can link your student account:
• Register or sign in at ${process.env.CLIENT_URL || 'http://localhost:5173'}
• Enter your Student ID: ${studentId}
• Use this email: ${to}

Once you're signed in, an invitation from your school will appear on your dashboard — please ACCEPT it. After you accept, your school (or adviser) will assign you to your specific course and room.

Thank you,
The OJT Connect Team`
  if (transport) {
    try {
      await transport.sendMail({
        from: `"${FROM_NAME}" <${FROM}>`,
        to,
        subject,
        text
      })
      console.log(`[MAIL] Invite sent to ${to}`)
    } catch (err) {
      console.error(`[MAIL] Failed to send invite to ${to}:`, err.message)
    }
    return true
  }
  console.log('── [MAIL DEV] no SMTP configured, invite email not actually sent ──')
  console.log(`  To:      ${to}`)
  console.log(`  Subject: ${subject}`)
  return false
}

export async function sendAccountCredentials({ to, name, login, password, role, orgName }) {
  const roleLabel = role === 'school' ? 'school' : 'company'
  const subject = `Your OJT Connect ${roleLabel} account is ready 🎉`
  const text = `Hello ${name},

Your ${roleLabel} account (${orgName || 'your organization'}) has been created on OJT Connect by our administrator.

Here are your login credentials:

  Login:    ${login}
  Password: ${password}

IMPORTANT:
• This is a temporary password. For your security, you will be required to change it the first time you sign in.
• Keep these credentials private — never share your password.

Sign in here: ${process.env.CLIENT_URL || 'http://localhost:5173'}/login

Thank you,
The OJT Connect Team`
  if (transport) {
    try {
      await transport.sendMail({
        from: `"${FROM_NAME}" <${FROM}>`,
        to,
        subject,
        text
      })
      console.log(`[MAIL] Credentials sent to ${to}`)
    } catch (err) {
      console.error(`[MAIL] Failed to send credentials to ${to}:`, err.message)
    }
    return true
  }
  console.log('── [MAIL DEV] no SMTP configured, credentials email not actually sent ──')
  console.log(`  To:      ${to}`)
  console.log(`  Subject: ${subject}`)
  console.log(`  Login:   ${login}`)
  console.log(`  Password: ${password}`)
  return false
}