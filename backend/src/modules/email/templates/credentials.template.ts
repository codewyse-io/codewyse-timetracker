export function credentialsTemplate(
  firstName: string,
  email: string,
  password: string,
  branding: { appName: string; logoUrl?: string; primaryColor: string; emailFromName?: string } = {
    appName: 'PulseTrack',
    primaryColor: '#6366f1',
  },
): string {
  const { appName, logoUrl, primaryColor } = branding;
  const initial = appName.charAt(0).toUpperCase();

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${appName}" style="width: 44px; height: 44px; border-radius: 12px; display: block;" />`
    : `<div style="width: 44px; height: 44px; background: linear-gradient(135deg, ${primaryColor}, #818cf8); border-radius: 12px; text-align: center; line-height: 44px; color: #fff; font-weight: 800; font-size: 20px; display: inline-block;">${initial}</div>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ${appName} Credentials</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f6fb; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 48px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 540px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 12px;">${logoHtml}</td>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 24px; font-weight: 800; color: #1e293b; letter-spacing: -0.5px;">${appName}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background: #ffffff; border-radius: 20px; box-shadow: 0 8px 40px rgba(0,0,0,0.06); overflow: hidden;">

              <!-- Gradient header banner -->
              <div style="height: 120px; background: linear-gradient(135deg, ${primaryColor} 0%, #818cf8 50%, #a78bfa 100%); position: relative; text-align: center; padding-top: 32px;">
                <div style="font-size: 36px; line-height: 1;">👋</div>
                <div style="font-size: 18px; font-weight: 700; color: rgba(255,255,255,0.95); margin-top: 8px;">Welcome to ${appName}</div>
              </div>

              <!-- Content -->
              <table width="100%" cellpadding="0" cellspacing="0" style="padding: 36px 40px 32px;">
                <tr>
                  <td>
                    <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #1e293b;">
                      Hi ${firstName},
                    </h2>
                    <p style="margin: 0 0 24px; font-size: 15px; color: #64748b; line-height: 1.7;">
                      Your account is ready! Use these credentials to sign in to the ${appName} desktop app.
                    </p>

                    <!-- Credentials Box -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 24px 28px;">
                          <!-- Email -->
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding-bottom: 18px; border-bottom: 1px solid #e2e8f0;">
                                <table cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="vertical-align: top; padding-right: 12px;">
                                      <div style="width: 32px; height: 32px; border-radius: 8px; background: ${primaryColor}15; text-align: center; line-height: 32px; font-size: 14px;">📧</div>
                                    </td>
                                    <td>
                                      <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 4px;">Email Address</div>
                                      <div style="font-size: 15px; font-weight: 600; color: #1e293b; font-family: 'SF Mono', SFMono-Regular, Consolas, monospace;">${email}</div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                          <!-- Password -->
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding-top: 18px;">
                                <table cellpadding="0" cellspacing="0">
                                  <tr>
                                    <td style="vertical-align: top; padding-right: 12px;">
                                      <div style="width: 32px; height: 32px; border-radius: 8px; background: ${primaryColor}15; text-align: center; line-height: 32px; font-size: 14px;">🔑</div>
                                    </td>
                                    <td>
                                      <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 4px;">Temporary Password</div>
                                      <div style="font-size: 15px; font-weight: 700; color: ${primaryColor}; font-family: 'SF Mono', SFMono-Regular, Consolas, monospace; background: #fff; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px 14px; letter-spacing: 1.5px; display: inline-block;">${password}</div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Security tip -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; margin-bottom: 24px;">
                      <tr>
                        <td style="padding: 14px 18px;">
                          <table cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="vertical-align: top; padding-right: 10px; font-size: 16px;">🔒</td>
                              <td>
                                <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.6;">
                                  <strong>Security tip:</strong> Please change your password after your first login to keep your account secure.
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <div style="height: 1px; background: linear-gradient(90deg, transparent, #e2e8f0, transparent); margin-bottom: 20px;"></div>

                    <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.6; text-align: center;">
                      Need help? Contact your administrator.<br>This is an automated message — please do not reply.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 28px 0 0;">
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} ${appName} &middot; Powered by <span style="color: ${primaryColor}; font-weight: 600;">CodeWyse</span>
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
