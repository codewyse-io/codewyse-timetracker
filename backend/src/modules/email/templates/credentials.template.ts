export function credentialsTemplate(
  firstName: string,
  email: string,
  password: string,
  branding: { appName: string; logoUrl?: string; primaryColor: string } = {
    appName: 'PulseTrack',
    primaryColor: '#6366f1',
  },
): string {
  const { appName, logoUrl, primaryColor } = branding;
  const initial = appName.charAt(0).toUpperCase();

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${appName}" style="width: 40px; height: 40px; border-radius: 12px; display: inline-block;" />`
    : `<div style="width: 40px; height: 40px; background: linear-gradient(135deg, ${primaryColor}, #8b5cf6); border-radius: 12px; display: inline-block; text-align: center; line-height: 40px; color: #fff; font-weight: 800; font-size: 18px;">${initial}</div>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ${appName} Credentials</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f2f5; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <div style="display: inline-flex; align-items: center; gap: 10px;">
                ${logoHtml}
                <span style="font-size: 22px; font-weight: 700; color: #1e293b; letter-spacing: -0.3px;">${appName}</span>
              </div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); overflow: hidden;">

              <!-- Header accent -->
              <div style="height: 4px; background: linear-gradient(90deg, ${primaryColor}, #8b5cf6, #a78bfa);"></div>

              <!-- Content -->
              <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 36px 36px;">
                <tr>
                  <td>
                    <!-- Greeting -->
                    <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #1e293b;">
                      Welcome aboard, ${firstName}!
                    </h2>
                    <p style="margin: 0 0 28px; font-size: 15px; color: #64748b; line-height: 1.6;">
                      Your ${appName} account has been created. Use the credentials below to sign in to the desktop app.
                    </p>

                    <!-- Credentials Box -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 28px;">
                      <tr>
                        <td style="padding: 20px 24px;">

                          <!-- Email row -->
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
                                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; margin-bottom: 6px;">Email</div>
                                <div style="font-size: 16px; font-weight: 600; color: #1e293b; font-family: 'SF Mono', SFMono-Regular, Consolas, monospace;">${email}</div>
                              </td>
                            </tr>
                          </table>

                          <!-- Password row -->
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding-top: 16px;">
                                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; margin-bottom: 6px;">Password</div>
                                <div style="font-size: 16px; font-weight: 600; color: #1e293b; font-family: 'SF Mono', SFMono-Regular, Consolas, monospace; background: #fff; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px 14px; letter-spacing: 1px;">${password}</div>
                              </td>
                            </tr>
                          </table>

                        </td>
                      </tr>
                    </table>

                    <!-- Security notice -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: #fefce8; border: 1px solid #fde68a; border-radius: 10px; margin-bottom: 28px;">
                      <tr>
                        <td style="padding: 14px 18px;">
                          <p style="margin: 0; font-size: 13px; color: #854d0e; line-height: 1.5;">
                            <strong>Security tip:</strong> We recommend changing your password after your first login for better security.
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <div style="height: 1px; background: #e2e8f0; margin-bottom: 24px;"></div>

                    <!-- Help text -->
                    <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.6;">
                      If you have any questions, reach out to your administrator. This is an automated message — please do not reply.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 28px 0 0;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} ${appName} &middot; Powered by CodeWyse
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
