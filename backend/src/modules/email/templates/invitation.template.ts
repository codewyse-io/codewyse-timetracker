export function invitationTemplate(
  firstName: string,
  inviteUrl: string,
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to PulseTrack</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f7fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <tr>
      <td style="background-color: #2563eb; padding: 32px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">PulseTrack</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 40px 32px;">
        <h2 style="color: #1e293b; margin: 0 0 16px;">Hello ${firstName},</h2>
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          You have been invited to join <strong>PulseTrack</strong>. Click the button below to set your password and activate your account.
        </p>
        <table cellpadding="0" cellspacing="0" style="margin: 0 auto 24px;">
          <tr>
            <td style="background-color: #2563eb; border-radius: 6px;">
              <a href="${inviteUrl}" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600;">
                Accept Invitation
              </a>
            </td>
          </tr>
        </table>
        <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${inviteUrl}" style="color: #2563eb; word-break: break-all;">${inviteUrl}</a>
        </p>
        <p style="color: #94a3b8; font-size: 14px; margin: 24px 0 0;">
          This invitation will expire in 72 hours.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} PulseTrack. All rights reserved.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
