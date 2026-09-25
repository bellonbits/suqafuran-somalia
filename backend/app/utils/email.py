import logging
from pathlib import Path
from typing import Any, Dict
import emails
from emails.template import JinjaTemplate
from app.core.config import settings


def send_email(
    email_to: str,
    subject_template: str = "",
    html_template: str = "",
    data: Dict[str, Any] = None,
) -> None:
    assert settings.EMAILS_ENABLED, "no provided configuration for email variables"
    message = emails.Message(
        subject=JinjaTemplate(subject_template),
        html=JinjaTemplate(html_template),
        mail_from=(settings.EMAILS_FROM_NAME, settings.EMAILS_FROM_EMAIL),
    )
    smtp_options = {"host": settings.SMTP_HOST, "port": settings.SMTP_PORT}
    if settings.SMTP_TLS:
        smtp_options["tls"] = True
    if settings.SMTP_SSL:
        smtp_options["ssl"] = True
    if settings.SMTP_USER:
        smtp_options["user"] = settings.SMTP_USER
    if settings.SMTP_PASSWORD:
        smtp_options["password"] = settings.SMTP_PASSWORD
    try:
        response = message.send(to=email_to, render=data, smtp=smtp_options)
        logging.info(f"send email result: {response}")
        if response.status_code not in [250, 200]:
            logging.error(f"Failed to send email: {response.status_code} - {response.error}")
    except Exception as e:
        logging.error(f"Exception during email sending: {str(e)}")


def _base_email_template(title: str, preheader: str, body_html: str) -> str:
    """Shared branded email shell with logo, content, and social footer."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <!-- Preheader (hidden preview text) -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">{preheader}</span>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header with logo -->
          <tr>
            <td align="center" style="background-color:#0369a1;padding:28px 32px;">
              <img src="https://suqafuran.com/logo.png"
                   alt="Suqafuran"
                   width="140"
                   style="display:block;max-width:140px;height:auto;" />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 24px 36px;">
              {body_html}
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />
            </td>
          </tr>

          <!-- Social footer -->
          <tr>
            <td align="center" style="padding:24px 36px 32px 36px;">
              <p style="margin:0 0 16px 0;font-size:13px;color:#9ca3af;">Follow us</p>
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Facebook -->
                  <td style="padding:0 6px;">
                    <a href="https://www.facebook.com/suqafuran" target="_blank"
                       style="display:inline-block;width:36px;height:36px;background-color:#1877F2;border-radius:50%;text-align:center;line-height:36px;text-decoration:none;color:#ffffff;font-size:16px;font-weight:bold;">f</a>
                  </td>
                  <!-- X / Twitter -->
                  <td style="padding:0 6px;">
                    <a href="https://x.com/suqafuran" target="_blank"
                       style="display:inline-block;width:36px;height:36px;background-color:#000000;border-radius:50%;text-align:center;line-height:36px;text-decoration:none;color:#ffffff;font-size:14px;font-weight:bold;">𝕏</a>
                  </td>
                  <!-- Instagram -->
                  <td style="padding:0 6px;">
                    <a href="https://www.instagram.com/suqafuran" target="_blank"
                       style="display:inline-block;width:36px;height:36px;background:linear-gradient(135deg,#f59e0b,#ec4899,#8b5cf6);border-radius:50%;text-align:center;line-height:36px;text-decoration:none;color:#ffffff;font-size:16px;">&#9679;</a>
                  </td>
                  <!-- TikTok -->
                  <td style="padding:0 6px;">
                    <a href="https://www.tiktok.com/@suqafuran_" target="_blank"
                       style="display:inline-block;width:36px;height:36px;background-color:#000000;border-radius:50%;text-align:center;line-height:36px;text-decoration:none;color:#ffffff;font-size:13px;font-weight:bold;">TT</a>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0 0;font-size:12px;color:#9ca3af;">
                &copy; 2025 Suqafuran &mdash; The Modern Marketplace for Somalia<br />
                <a href="https://suqafuran.com" style="color:#0369a1;text-decoration:none;">suqafuran.com</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
</body>
</html>"""


def send_test_email(email_to: str) -> None:
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - Test email"
    with open(Path(settings.EMAIL_TEMPLATES_DIR) / "test_email.html") as f:
        template_str = f.read()
    send_email(
        email_to=email_to,
        subject_template=subject,
        html_template=template_str,
        data={"project_name": settings.PROJECT_NAME, "email": email_to},
    )


def send_verification_email(email_to: str, token: str) -> None:
    subject = "Verify your Suqafuran account"
    body = f"""
      <h2 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#111827;">Check your inbox</h2>
      <p style="margin:0 0 28px 0;font-size:15px;color:#6b7280;line-height:1.6;">
        Use the code below to verify your email address. It expires in
        <strong>{settings.EMAIL_VERIFICATION_EXPIRE_HOURS} hour(s)</strong>.
      </p>

      <!-- OTP box -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        <tr>
          <td align="center">
            <div style="display:inline-block;background-color:#f0f9ff;border:2px solid #bae6fd;border-radius:12px;padding:20px 40px;">
              <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#0369a1;font-family:monospace;">{token}</span>
            </div>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
        If you didn't create a Suqafuran account, you can safely ignore this email.
      </p>
    """
    html = _base_email_template(
        title="Verify your Suqafuran account",
        preheader=f"Your verification code is {token} — enter it in the app to continue.",
        body_html=body,
    )
    send_email(email_to=email_to, subject_template=subject, html_template=html)


def send_reset_password_email(email_to: str, token: str) -> None:
    subject = "Reset your Suqafuran password"
    body = f"""
      <h2 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#111827;">Password reset</h2>
      <p style="margin:0 0 28px 0;font-size:15px;color:#6b7280;line-height:1.6;">
        We received a request to reset your password. Use the code below — it expires in
        <strong>1 hour</strong>.
      </p>

      <!-- OTP box -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        <tr>
          <td align="center">
            <div style="display:inline-block;background-color:#fff7ed;border:2px solid #fed7aa;border-radius:12px;padding:20px 40px;">
              <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#c2410c;font-family:monospace;">{token}</span>
            </div>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
        If you didn't request a password reset, please ignore this email — your account is safe.
      </p>
    """
    html = _base_email_template(
        title="Reset your Suqafuran password",
        preheader=f"Your password reset code is {token} — valid for 1 hour.",
        body_html=body,
    )
    send_email(email_to=email_to, subject_template=subject, html_template=html)
