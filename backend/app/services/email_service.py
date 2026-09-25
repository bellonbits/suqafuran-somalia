import secrets
import json
import redis
from typing import Optional, List
from app.core.config import settings
from sqlmodel import Session
from app.db.session import engine
from app.models.email_log import EmailLog



MAX_OTP_ATTEMPTS = 5

class EmailService:
    def __init__(self):
        self.redis = None
        self._connect()

    def _connect(self):
        try:
            from app.utils.redis import from_url_safe
            client = from_url_safe(settings.REDIS_URL, decode_responses=True)
            client.ping()
            self.redis = client
            print("[Email] Redis connected OK")
        except Exception as e:
            print(f"[Email] Redis unavailable: {e}")
            self.redis = None

    def _ensure_redis(self):
        """Reconnect if the connection was lost or never established."""
        if self.redis is not None:
            try:
                self.redis.ping()
                return
            except Exception:
                self.redis = None
        self._connect()

    def _redis_get(self, key: str) -> Optional[str]:
        self._ensure_redis()
        if not self.redis:
            return None
        try:
            return self.redis.get(key)
        except Exception as e:
            print(f"[Email] Redis GET error: {e}")
            self.redis = None
            return None

    def _redis_set(self, key: str, value: str, ex: int) -> bool:
        self._ensure_redis()
        if not self.redis:
            return False
        try:
            self.redis.set(key, value, ex=ex)
            return True
        except Exception as e:
            print(f"[Email] Redis SET error: {e}")
            self.redis = None
            return False

    def _redis_delete(self, key: str):
        self._ensure_redis()
        if not self.redis:
            return
        try:
            self.redis.delete(key)
        except Exception as e:
            print(f"[Email] Redis DELETE error: {e}")
            self.redis = None

    def _redis_incr(self, key: str, ex: int):
        self._ensure_redis()
        if not self.redis:
            return
        try:
            self.redis.incr(key)
            self.redis.expire(key, ex)
        except Exception as e:
            print(f"[Email] Redis INCR error: {e}")
            self.redis = None

    def _get_base_template(self, title: str, subtitle: str, content: str) -> str:
        """Professional Suqafuran email wrapper."""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f9fc; padding: 40px 0; margin: 0;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
            <!-- Header -->
            <div style="background: #ffffff; padding: 40px 20px 32px; text-align: center; border-bottom: 1px solid #e2e8f0;">
              <img src="https://suqafuran.so/icon1.png" alt="Suqafuran" style="height: 40px; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;">
              <p style="margin: 0; color: #64748b; font-size: 14px; font-weight: 600;">The Trusted Marketplace of Somalia</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 48px 40px; color: #334155; line-height: 1.6;">
              <h2 style="margin-top: 0; color: #1e293b; font-size: 22px; font-weight: 800; letter-spacing: -0.3px;">{title}</h2>
              <p style="font-size: 16px; margin-bottom: 32px;">{subtitle}</p>
              {content}
              <p style="margin-top: 32px; font-size: 14px; color: #94a3b8; font-style: italic;">
                Thank you,<br>
                <strong>The Suqafuran Team</strong>
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background: #f8fafc; padding: 48px 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="font-size: 14px; font-weight: 700; color: #64748b; margin-bottom: 24px;">Connect with us</p>
              <div style="margin-bottom: 32px;">
                <a href="https://www.instagram.com/suqafuran/" style="margin: 0 10px; text-decoration: none; display: inline-block;">
                  <img src="https://suqafuran.so/icons/instagram.png" alt="Instagram" width="24" height="24">
                </a>
                <a href="https://x.com/suqafuran" style="margin: 0 10px; text-decoration: none; display: inline-block;">
                  <img src="https://suqafuran.so/icons/twitter.png" alt="X" width="24" height="24">
                </a>
                <a href="https://www.tiktok.com/@suqafuran_" style="margin: 0 10px; text-decoration: none; display: inline-block;">
                  <img src="https://suqafuran.so/icons/tiktok.png" alt="TikTok" width="24" height="24">
                </a>
              </div>
              
              <div style="font-size: 12px; color: #94a3b8; line-height: 1.8;">
                <p style="margin: 0; font-weight: 600; color: #64748b;">Suqafuran Limited</p>
                <p style="margin: 4px 0 0 0;">Mogadishu, Somalia</p>
                <p style="margin: 4px 0 0 0;">&copy; 2026 Suqafuran. All rights reserved.</p>
              </div>
              
              <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #eef2f6;">
                <a href="mailto:support@suqafuran.so" style="color: #f97316; font-weight: 800; text-decoration: none; font-size: 13px;">support@suqafuran.so</a>
              </div>
            </div>
          </div>
        </body>
        </html>
        """

    def generate_otp(self) -> str:
        return str(secrets.randbelow(900000) + 100000)

    def check_rate_limit(self, email: str) -> bool:
        email = email.strip().lower()
        self._ensure_redis()
        if not self.redis:
            return True  # allow if Redis is down
        attempts = self._redis_get(f"otp_attempts:{email}")
        if attempts and int(attempts) >= 3:
            return False
        return True

    def increment_rate_limit(self, email: str):
        email = email.strip().lower()
        self._redis_incr(f"otp_attempts:{email}", ex=300)

    def send_verification_code(self, email: str, is_resend: bool = False) -> bool:
        from app.services.otp_log_service import otp_log
        email = email.strip().lower()
        if not self.check_rate_limit(email):
            print(f"[Email] Rate limit exceeded for {email}")
            otp_log.record("failed", identifier=email, channel="email",
                           meta={"reason": "rate_limit_exceeded"})
            return False

        code = self.generate_otp()
        print(f"[Email] Generated OTP for {email}")

        self._ensure_redis()
        if self.redis:
            ok = self._redis_set(f"otp:{email}", code, ex=300)
            if not ok and settings.ENVIRONMENT == "production":
                otp_log.record("failed", identifier=email, channel="email",
                               meta={"reason": "redis_set_failed"})
                return False
        else:
            if settings.ENVIRONMENT == "production":
                print(f"[Email] Redis unavailable in production — cannot store OTP for {email}")
                otp_log.record("failed", identifier=email, channel="email",
                               meta={"reason": "redis_unavailable"})
                return False
            code = "000000"
        self.increment_rate_limit(email)
        otp_content = f"""
        <div style="background: #fff7ed; border-radius: 12px; padding: 32px; text-align: center; margin: 32px 0; border: 1px solid #ffedd5;">
          <span style="font-size: 42px; font-weight: 900; letter-spacing: 10px; color: #ea580c; font-family: monospace;">{code}</span>
        </div>
        <p style="color: #64748b; font-size: 13px; text-align: center;">This code will expire in 5 minutes. If you did not request this verification code, you can safely ignore this email.</p>
        """

        html_body = self._get_base_template(
            title="Verify your account",
            subtitle="Welcome to Suqafuran! Please use the verification code below to complete your registration.",
            content=otp_content
        )

        _event = "resent" if is_resend else "sent"

        # Try Resend first
        if settings.RESEND_API_KEY:
            try:
                import resend
                resend.api_key = settings.RESEND_API_KEY
                resend.Emails.send({
                    "from": f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>",
                    "to": [email],
                    "subject": "Suqafuran Verification Code",
                    "html": html_body,
                })
                print(f"[Email] OTP sent via Resend to {email}")
                otp_log.record(_event, identifier=email, channel="email",
                                expires_in=300, meta={"provider": "resend"})
                return True
            except Exception as e:
                print(f"[Email] Resend failed ({e}), trying SMTP fallback...")
                otp_log.record("failed", identifier=email, channel="email",
                                meta={"provider": "resend", "reason": str(e)[:200]})

        # SMTP fallback
        if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
            try:
                import smtplib
                from email.mime.multipart import MIMEMultipart
                from email.mime.text import MIMEText
                msg = MIMEMultipart("alternative")
                msg["Subject"] = "Suqafuran Verification Code"
                msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.SMTP_USER}>"
                msg["To"] = email
                msg.attach(MIMEText(html_body, "html"))
                if settings.SMTP_SSL:
                    with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                        server.sendmail(settings.SMTP_USER, email, msg.as_string())
                else:
                    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                        if settings.SMTP_TLS:
                            server.starttls()
                        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                        server.sendmail(settings.SMTP_USER, email, msg.as_string())
                print(f"[Email] OTP sent via SMTP to {email}")
                otp_log.record(_event, identifier=email, channel="email",
                                expires_in=300, meta={"provider": "smtp"})
                return True
            except Exception as e:
                print(f"[Email] SMTP failed: {e}")
                otp_log.record("failed", identifier=email, channel="email",
                                meta={"provider": "smtp", "reason": str(e)[:200]})

        if settings.ENVIRONMENT != "production":
            print(f"[Email] Dev fallback OTP for {email}: {code}")
            otp_log.record(_event, identifier=email, channel="email",
                            expires_in=300, meta={"mode": "development"})
            return True

        otp_log.record("failed", identifier=email, channel="email",
                        meta={"reason": "no_provider_configured"})
        return False

    def send_reset_code(self, email: str, code: str) -> bool:
        print(f"[Email] Generated Reset Code for {email}: {code}")
        reset_content = f"""
        <div style="background: #fff7ed; border-radius: 12px; padding: 32px; text-align: center; margin: 32px 0; border: 1px solid #ffedd5;">
          <span style="font-size: 42px; font-weight: 900; letter-spacing: 10px; color: #ea580c; font-family: monospace;">{code}</span>
        </div>
        <p style="color: #64748b; font-size: 13px; text-align: center;">This code will expire in 1 hour. If you did not request a password reset, please ensure your account is secure.</p>
        """

        html_body = self._get_base_template(
            title="Reset your password",
            subtitle="We received a request to reset your password on Suqafuran. Use the code below to proceed.",
            content=reset_content
        )

        if settings.RESEND_API_KEY:
            try:
                import resend
                resend.api_key = settings.RESEND_API_KEY
                resend.Emails.send({
                    "from": f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>",
                    "to": [email],
                    "subject": "Reset your Suqafuran Password",
                    "html": html_body,
                })
                print(f"[Email] Reset code sent via Resend to {email}")
                return True
            except Exception as e:
                print(f"[Email] Resend failed for reset code ({e})")

        if settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
            try:
                import smtplib
                from email.mime.multipart import MIMEMultipart
                from email.mime.text import MIMEText
                msg = MIMEMultipart("alternative")
                msg["Subject"] = "Reset your Suqafuran Password"
                msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.SMTP_USER}>"
                msg["To"] = email
                msg.attach(MIMEText(html_body, "html"))
                if settings.SMTP_SSL:
                    with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                        server.sendmail(settings.SMTP_USER, email, msg.as_string())
                else:
                    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                        if settings.SMTP_TLS:
                            server.starttls()
                        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                        server.sendmail(settings.SMTP_USER, email, msg.as_string())
                print(f"[Email] Reset code sent via SMTP to {email}")
                return True
            except Exception as e:
                print(f"[Email] SMTP failed for reset code: {e}")

        print(f"[Email] No email provider available for reset code to {email}")
        return False

    def _send_and_log(
        self,
        email: str,
        subject: str,
        html_body: str,
        email_type: str,
        user_id: Optional[int] = None,
        campaign_id: Optional[str] = None,
        metadata: Optional[dict] = None,
        preferred_provider: str = "resend"
    ) -> bool:
        import json
        import re
        from urllib.parse import quote
        
        meta_str = json.dumps(metadata) if metadata else None
        
        log_entry = EmailLog(
            user_id=user_id,
            email=email,
            email_type=email_type,
            subject=subject,
            status="queued",
            campaign_id=campaign_id,
            metadata_json=meta_str
        )
        
        # Outbound link rewriting for high-fidelity CTR (Click-Through Rate) analytics
        def rewrite_link(match):
            url = match.group(1)
            if "track-click" in url or "mailto:" in url or url.startswith("#"):
                return match.group(0)
            tracked_url = f"{settings.BACKEND_URL}/api/v1/content/email/track-click?token={log_entry.tracking_token}&redirect_url={quote(url)}"
            return f'href="{tracked_url}"'

        html_body_tracked = re.sub(r'href=["\'](https?://[^"\']+)["\']', rewrite_link, html_body)

        # Inject transparent 1x1 tracking pixel
        tracking_pixel = f'<img src="{settings.BACKEND_URL}/api/v1/content/email/track-open?token={log_entry.tracking_token}" alt="" width="1" height="1" style="display:none;" />'
        if "</body>" in html_body_tracked:
            html_body_tracked = html_body_tracked.replace("</body>", f"{tracking_pixel}</body>")
        else:
            html_body_tracked += tracking_pixel
            
        success = False
        provider = None
        failed_reason = None

        # Marketing/promotional sends prefer Brevo; everything else prefers
        # Resend. Whichever isn't preferred still acts as a fallback below.
        if preferred_provider == "brevo" and settings.BREVO_API_KEY:
            try:
                import requests

                resp = requests.post(
                    "https://api.brevo.com/v3/smtp/email",
                    headers={
                        "api-key": settings.BREVO_API_KEY,
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                    json={
                        "sender": {"name": settings.BREVO_FROM_NAME, "email": settings.BREVO_FROM_EMAIL},
                        "to": [{"email": email}],
                        "subject": subject,
                        "htmlContent": html_body_tracked,
                    },
                    timeout=15,
                )
                resp.raise_for_status()
                print(f"[Email] {email_type} sent via Brevo to {email}")
                success = True
                provider = "Brevo"
            except Exception as e:
                failed_reason = f"Brevo failed: {str(e)}"
                print(f"[Email] Brevo failed ({e}), trying Resend fallback...")

        # Primary Resend API Delivery -- skipped entirely when Brevo was the
        # preferred provider (marketing/promotional sends): those should
        # never fall back to Resend, only to SMTP/dev-bypass beyond Brevo.
        if not success and settings.RESEND_API_KEY and preferred_provider != "brevo":
            try:
                import resend

                resend.api_key = settings.RESEND_API_KEY

                resend.Emails.send({
                    "from": f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM}>",
                    "to": [email],
                    "subject": subject,
                    "html": html_body_tracked,
                })
                print(f"[Email] {email_type} sent via Resend to {email}")
                success = True
                provider = "Resend"
            except Exception as e:
                failed_reason = (failed_reason + " | " if failed_reason else "") + f"Resend failed: {str(e)}"
                print(f"[Email] Resend failed ({e}), trying SMTP fallback...")

        # Secondary: SMTP Fallback Delivery Chain
        if not success and settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
            try:
                import smtplib
                from email.mime.multipart import MIMEMultipart
                from email.mime.text import MIMEText

                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.SMTP_USER}>"
                msg["To"] = email
                msg.attach(MIMEText(html_body_tracked, "html"))

                # Check for SSL vs TLS vs standard connection
                if settings.SMTP_SSL:
                    with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                        server.sendmail(settings.SMTP_USER, email, msg.as_string())
                else:
                    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                        if settings.SMTP_TLS:
                            server.starttls()
                        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                        server.sendmail(settings.SMTP_USER, email, msg.as_string())
                print(f"[Email] {email_type} sent via SMTP to {email}")
                success = True
                provider = "SMTP"
            except Exception as e:
                failed_reason = (failed_reason + " | " if failed_reason else "") + f"SMTP failed: {str(e)}"
                print(f"[Email] SMTP failed: {e}")

        # Local Dev Bypass fallback
        if not success:
            if settings.ENVIRONMENT != "production":
                print(f"[Email] Dev bypass logged for {email} ({email_type})")
                success = True
                provider = "DevFallback"
                log_entry.status = "sent"
            else:
                log_entry.status = "failed"
                log_entry.failed_reason = failed_reason
        else:
            log_entry.status = "sent"
            log_entry.provider_used = provider

        try:
            with Session(engine) as session:
                session.add(log_entry)
                session.commit()
        except Exception as db_err:
            print(f"[Email] Failed to write email log: {db_err}")

        return success

    def send_email(self, to: str, subject: str, html_content: str, user_id: Optional[int] = None) -> bool:
        """Generic send for callers with their own pre-built HTML (admin
        notifications, marketing campaigns with their own tracking, etc).
        Reuses the same Resend/SMTP/dev-fallback delivery chain and logging
        as every templated send_*_email method."""
        return self._send_and_log(to, subject, html_content, "generic", user_id)

    # A. Onboarding / Activation Emails
    def send_welcome_email(self, email: str, name: str, user_id: Optional[int] = None) -> bool:
        welcome_content = f"""
        <p style="font-size: 15px; margin-bottom: 24px; color: #475569;">
          Hello {name},<br><br>
          We're absolutely thrilled to welcome you to <strong>Suqafuran</strong>! Africa's most trusted, premium, and lightning-fast marketplace.
        </p>
        <div style="background: #f0f9ff; border-radius: 16px; padding: 24px; margin: 32px 0; border: 1px solid #e0f2fe;">
          <h4 style="margin: 0 0 12px 0; color: #0369a1; font-weight: 800;">Here's how to kickstart your journey:</h4>
          <ul style="margin: 0; padding-left: 20px; color: #334155; font-size: 14px; line-height: 1.8;">
            <li>⚡ <strong>Post in seconds:</strong> Snap a photo, add details, and start selling.</li>
            <li><strong>Find amazing deals:</strong> Search by location, category, or trending status.</li>
            <li>🛡️ <strong>Verified protection:</strong> Chat securely with verified buyers & sellers.</li>
          </ul>
        </div>
        <div style="text-align: center; margin-bottom: 12px;">
          <a href="{settings.FRONTEND_URL}/post" style="display: inline-block; background: #0ea5e9; color: white; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 14px;">
            Get Started Now
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="Welcome to Suqafuran!",
            subtitle="Let's find or sell your next great deal today.",
            content=welcome_content
        )
        return self._send_and_log(email, "Welcome to Suqafuran", html_body, "onboarding_welcome", user_id)

    def send_subscription_ended_email(self, email: str, name: str, plan_name: str, is_trial: bool, user_id: Optional[int] = None) -> bool:
        noun = "free trial" if is_trial else "subscription"
        content = f"""
        <p style="font-size: 15px; margin-bottom: 24px; color: #475569;">
          Hello {name},<br><br>
          Your <strong>{plan_name}</strong> {noun} has ended, so your shop has been moved back to the Free plan.
          Premium features like {"analytics, priority ranking, and the verified badge" if is_trial else "your priority ranking, analytics, and other Pro features"} are no longer active on your account.
        </p>
        <div style="background: #fff7ed; border-radius: 16px; padding: 24px; margin: 32px 0; border: 1px solid #fed7aa;">
          <h4 style="margin: 0 0 12px 0; color: #c2410c; font-weight: 800;">Renew to keep growing your shop:</h4>
          <ul style="margin: 0; padding-left: 20px; color: #334155; font-size: 14px; line-height: 1.8;">
            <li>📈 <strong>Priority ranking:</strong> Show up first in shop listings.</li>
            <li>📊 <strong>Analytics:</strong> See what's working and what isn't.</li>
            <li>✅ <strong>Verified badge:</strong> Build instant buyer trust.</li>
          </ul>
        </div>
        <div style="text-align: center; margin-bottom: 12px;">
          <a href="{settings.FRONTEND_URL}/seller-dashboard/subscription" style="display: inline-block; background: #ea580c; color: white; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 14px;">
            Renew My Plan
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title=f"Your {plan_name} {noun} has ended",
            subtitle="Renew now to keep your shop's premium features active.",
            content=content
        )
        return self._send_and_log(email, f"Your {plan_name} {noun} has ended — renew to keep growing", html_body, "subscription_ended", user_id)

    def send_complete_profile_email(self, email: str, name: str, user_id: Optional[int] = None) -> bool:
        content = f"""
        <p style="font-size: 15px; margin-bottom: 24px; color: #475569;">
          Hello {name},<br><br>
          Did you know that users with fully completed and verified profiles get up to <strong>5x more messages and trust</strong> from the community?
        </p>
        <div style="background: #fdf2f8; border-radius: 16px; padding: 24px; margin: 32px 0; border: 1px solid #fce7f3;">
          <h4 style="margin: 0 0 12px 0; color: #be185d; font-weight: 800;">Complete these three quick steps:</h4>
          <ul style="margin: 0; padding-left: 20px; color: #334155; font-size: 14px; line-height: 1.8;">
            <li>🔒 <strong>Verify your account:</strong> Complete verification to unlock gold badges.</li>
            <li>📸 <strong>Set avatar picture:</strong> Put a friendly face to your store.</li>
            <li>📍 <strong>Set location:</strong> Helps local buyers find your items faster.</li>
          </ul>
        </div>
        <div style="text-align: center; margin-bottom: 12px;">
          <a href="{settings.FRONTEND_URL}/settings" style="display: inline-block; background: #db2777; color: white; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 14px;">
            Complete My Profile
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="Unlock 5x More Trust",
            subtitle="Complete your profile to build instant buyer confidence.",
            content=content
        )
        return self._send_and_log(email, "Build instant trust on Suqafuran", html_body, "onboarding_complete_profile", user_id)

    def send_first_action_prompt_email(self, email: str, name: str, user_type: str, user_id: Optional[int] = None) -> bool:
        if user_type == "seller":
            title = "Ready to make your first sale?"
            subtitle = "Sellers who post within 24 hours of joining are 3x more successful."
            action_text = "Post Your First Listing"
            action_url = f"{settings.FRONTEND_URL}/post"
            detail = "List any electronics, fashion items, cars, or home appliances in less than 10 seconds!"
        elif user_type == "freelancer":
            title = "Find clients near you today"
            subtitle = "Nairobi's top businesses are looking for freelance talent right now."
            action_text = "Create Service Listing"
            action_url = f"{settings.FRONTEND_URL}/post?type=service"
            detail = "Showcase your skills, set your rates, and get hired by verified local clients."
        else:
            title = "Explore deals near you today"
            subtitle = "Over 1,000+ new items listed in your neighborhood this morning."
            action_text = "Find Deals Near Me"
            action_url = f"{settings.FRONTEND_URL}/search"
            detail = "Browse verified listings, make offers, and get absolute value for your money."

        content = f"""
        <p style="font-size: 15px; margin-bottom: 24px; color: #475569;">
          Hello {name},<br><br>
          Your next big milestone on Suqafuran is waiting for you! {detail}
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="{action_url}" style="display: inline-block; background: #0ea5e9; color: white; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 14px;">
            {action_text}
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title=title,
            subtitle=subtitle,
            content=content
        )
        return self._send_and_log(email, title, html_body, "onboarding_first_action", user_id)

    def send_promotional_email(self, email: str, name: str, user_id: Optional[int] = None) -> bool:
        """General re-engagement/promotional email for existing customers."""
        site_url = "https://suqafuran.so"
        content = f"""
        <p style="font-size: 15px; margin-bottom: 24px; color: #475569;">
          Hello {name},<br><br>
          It's been a while! Suqafuran has hundreds of verified shops and fresh deals waiting for you —
          here's what you've been missing.
        </p>
        <div style="background: #f0f9ff; border-radius: 16px; padding: 24px; margin: 32px 0; border: 1px solid #e0f2fe;">
          <h4 style="margin: 0 0 12px 0; color: #0369a1; font-weight: 800;">Why come back today:</h4>
          <ul style="margin: 0; padding-left: 20px; color: #334155; font-size: 14px; line-height: 1.8;">
            <li>🛍️ <strong>New arrivals daily:</strong> Fresh listings from verified local shops.</li>
            <li>💬 <strong>Chat instantly:</strong> Message sellers directly, no middlemen.</li>
            <li>🛡️ <strong>Shop with confidence:</strong> Verified badges and trusted reviews.</li>
          </ul>
        </div>
        <div style="text-align: center; margin-bottom: 12px;">
          <a href="{site_url}" style="display: inline-block; background: #0ea5e9; color: white; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 14px;">
            Explore Suqafuran Now
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="We miss you at Suqafuran!",
            subtitle="Verified shops and fresh deals are waiting for you.",
            content=content
        )
        return self._send_and_log(email, "We miss you — see what's new on Suqafuran", html_body, "promotional_reengagement", user_id)

    # B. Marketplace Activity / Core Growth Emails
    def send_new_listing_alert(
        self,
        email: str,
        name: str,
        listing_title: str,
        price: str,
        location: str,
        category: str,
        listing_id: int,
        image_url: Optional[str] = None,
        user_id: Optional[int] = None
    ) -> bool:
        img_tag = f'<img src="{image_url}" alt="{listing_title}" style="width:100%; max-height:240px; object-fit:cover; border-radius:12px; margin-bottom:16px;" />' if image_url else ''
        content = f"""
        {img_tag}
        <h3 style="margin-top:0; color:#1e293b; font-weight:800; font-size:18px;">{listing_title}</h3>
        <p style="font-size:16px; color:#ea580c; font-weight:900; margin:4px 0 16px 0;">KES {price}</p>
        <div style="background:#f8fafc; padding:16px; border-radius:12px; margin-bottom:24px; font-size:13px; color:#475569;">
          📍 <strong>Location:</strong> {location}<br>
          📁 <strong>Category:</strong> {category}
        </div>
        <div style="text-align: center;">
          <a href="{settings.FRONTEND_URL}/listing/{listing_id}" style="display: inline-block; background: #0ea5e9; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px;">
            View Full Listing
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="New Item Listed Nearby!",
            subtitle="A brand-new matching item was just listed near your location.",
            content=content
        )
        return self._send_and_log(email, f"New listing: {listing_title} near you", html_body, "activity_new_listing", user_id)

    def send_saved_search_alert(
        self,
        email: str,
        name: str,
        search_query: str,
        matched_listings: List[dict],
        user_id: Optional[int] = None
    ) -> bool:
        items_html = ""
        for item in matched_listings[:3]:
            img_html = f'<td style="width:80px; padding-right:12px;"><img src="{item.get("image_url")}" style="width:80px; height:80px; object-fit:cover; border-radius:8px;" /></td>' if item.get("image_url") else ''
            items_html += f"""
            <tr style="border-bottom:1px solid #f1f5f9;">
              {img_html}
              <td style="padding:12px 0; vertical-align:top;">
                <h4 style="margin:0; font-size:14px; font-weight:800; color:#1e293b;">{item.get("title")}</h4>
                <p style="margin:4px 0 0 0; font-size:13px; color:#ea580c; font-weight:700;">KES {item.get("price")}</p>
                <p style="margin:2px 0 0 0; font-size:11px; color:#94a3b8;">{item.get("location")}</p>
              </td>
              <td style="text-align:right; width:90px;">
                <a href="{settings.FRONTEND_URL}/listing/{item.get("id")}" style="display:inline-block; background:#0ea5e9; color:white; font-size:11px; padding:6px 12px; border-radius:6px; text-decoration:none; font-weight:800;">View</a>
              </td>
            </tr>
            """
        content = f"""
        <table style="width:100%; border-collapse:collapse; margin-top:16px;">
          {items_html}
        </table>
        """
        html_body = self._get_base_template(
            title=f'Matches for "{search_query}"',
            subtitle="We found new items matching your saved search criteria.",
            content=content
        )
        return self._send_and_log(email, f"New matches for '{search_query}'", html_body, "activity_saved_search", user_id, preferred_provider="brevo")

    def send_price_drop_alert(
        self,
        email: str,
        name: str,
        listing_title: str,
        old_price: str,
        new_price: str,
        listing_id: int,
        image_url: Optional[str] = None,
        user_id: Optional[int] = None
    ) -> bool:
        img_tag = f'<img src="{image_url}" alt="{listing_title}" style="width:100%; max-height:220px; object-fit:cover; border-radius:12px; margin-bottom:16px;" />' if image_url else ''
        content = f"""
        {img_tag}
        <h3 style="margin-top:0; color:#1e293b; font-weight:800; font-size:16px;">{listing_title}</h3>
        <div style="margin: 16px 0; background:#fff7ed; border:1px solid #ffedd5; padding:16px; border-radius:12px; text-align:center;">
          <span style="text-decoration:line-through; color:#94a3b8; font-size:14px; margin-right:8px;">KES {old_price}</span>
          <span style="color:#ea580c; font-weight:900; font-size:22px;">KES {new_price}</span>
        </div>
        <div style="text-align: center;">
          <a href="{settings.FRONTEND_URL}/listing/{listing_id}" style="display: inline-block; background: #0ea5e9; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px;">
            Buy Now
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="Price Dropped!",
            subtitle="An item on your watch-list just got cheaper. Act fast before it's gone!",
            content=content
        )
        return self._send_and_log(email, f"🔥 Price dropped for '{listing_title}'!", html_body, "activity_price_drop", user_id)

    def send_trending_items_email(self, email: str, name: str, location: str, listings: List[dict], user_id: Optional[int] = None) -> bool:
        items_html = ""
        for idx, item in enumerate(listings[:4]):
            img_html = f'<img src="{item.get("image_url")}" style="width:100%; height:120px; object-fit:cover; border-radius:8px; margin-bottom:8px;" />' if item.get("image_url") else ''
            items_html += f"""
            <div style="width:48%; display:inline-block; box-sizing:border-box; padding:6px; margin-bottom:12px; vertical-align:top;">
              <div style="background:#f8fafc; border:1px solid #f1f5f9; padding:8px; border-radius:12px;">
                {img_html}
                <h4 style="margin:0; font-size:12px; font-weight:800; color:#1e293b; height:32px; overflow:hidden;">{item.get("title")}</h4>
                <p style="margin:4px 0 0 0; font-size:13px; color:#ea580c; font-weight:700;">KES {item.get("price")}</p>
                <a href="{settings.FRONTEND_URL}/listing/{item.get("id")}" style="display:block; text-align:center; background:#0ea5e9; color:white; font-size:11px; padding:6px; border-radius:6px; text-decoration:none; margin-top:8px; font-weight:800;">View Deal</a>
              </div>
            </div>
            """
        content = f"""
        <div style="width:100%;">
          {items_html}
        </div>
        """
        html_body = self._get_base_template(
            title=f"Trending in {location} Today",
            subtitle="Here are the hottest, most-viewed items in your neighborhood right now.",
            content=content
        )
        return self._send_and_log(email, f"Top trending items in {location} today", html_body, "activity_trending", user_id, preferred_provider="brevo")

    # C. Transaction / Trust Layer
    def send_message_notification(
        self,
        email: str,
        name: str,
        sender_name: str,
        message_excerpt: str,
        chat_url: str,
        user_id: Optional[int] = None
    ) -> bool:
        content = f"""
        <p style="font-size: 15px; margin-bottom: 24px; color: #475569;">
          Hello {name},<br><br>
          You have received a new message regarding your active marketplace listing from <strong>{sender_name}</strong>:
        </p>
        <div style="background: #f8fafc; border-left: 4px solid #0ea5e9; border-radius: 8px; padding: 16px; margin: 24px 0; font-style: italic; color: #334155; font-size: 14px;">
          "{message_excerpt}"
        </div>
        <div style="text-align: center; margin-top: 24px;">
          <a href="{chat_url}" style="display: inline-block; background: #0ea5e9; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px;">
            Reply to Message
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="New Message Received",
            subtitle="A potential client is waiting for your reply.",
            content=content
        )
        return self._send_and_log(email, f"New message from {sender_name}", html_body, "transaction_message", user_id)

    def send_offer_received(
        self,
        email: str,
        name: str,
        item_title: str,
        offer_amount: str,
        offer_url: str,
        user_id: Optional[int] = None
    ) -> bool:
        content = f"""
        <p style="font-size: 15px; margin-bottom: 24px; color: #475569;">
          Hello {name},<br><br>
          Excellent news! A prospective buyer has submitted a formal offer for <strong>{item_title}</strong>:
        </p>
        <div style="background: #fff7ed; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; border: 1px solid #ffedd5;">
          <span style="font-size: 14px; color: #64748b;">Offer Amount</span><br>
          <span style="font-size: 28px; font-weight: 900; color: #ea580c;">KES {offer_amount}</span>
        </div>
        <div style="text-align: center;">
          <a href="{offer_url}" style="display: inline-block; background: #ea580c; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px;">
            Respond to Offer
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="New Offer Received!",
            subtitle="Review your offer to complete the transaction.",
            content=content
        )
        return self._send_and_log(email, f"New offer for your item: {item_title}", html_body, "transaction_offer", user_id)

    def send_deal_update(self, email: str, name: str, item_title: str, status: str, user_id: Optional[int] = None) -> bool:
        content = f"""
        <p style="font-size: 15px; color: #475569;">
          Hello {name},<br><br>
          The deal status for <strong>{item_title}</strong> has been successfully updated to <strong>{status}</strong>.
        </p>
        """
        html_body = self._get_base_template(
            title="Deal Status Updated",
            subtitle="Your transaction details have been updated.",
            content=content
        )
        return self._send_and_log(email, f"Deal status update: {item_title}", html_body, "transaction_deal_update", user_id)

    # D. Trust & Safety Emails
    def send_suspicious_activity_alert(
        self,
        email: str,
        name: str,
        ip: str,
        device: str,
        timestamp: str,
        user_id: Optional[int] = None
    ) -> bool:
        content = f"""
        <div style="background: #fef2f2; border-radius: 12px; padding: 16px; border: 1px solid #fecaca; margin-bottom: 24px; color: #b91c1c; font-size: 14px; font-weight: 700;">
          ⚠️ Warning: Suspicious Login Detected
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:14px; color:#475569; margin-bottom:24px;">
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0;">IP Address</td><td style="padding:8px 0; text-align:right; font-weight:800;">{ip}</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0;">Device/Browser</td><td style="padding:8px 0; text-align:right; font-weight:800;">{device}</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0;">Timestamp</td><td style="padding:8px 0; text-align:right; font-weight:800;">{timestamp}</td></tr>
        </table>
        <p style="font-size:13px; color:#64748b; line-height:1.6;">
          If this wasn't you, please reset your password immediately and verify your login history to secure your account assets.
        </p>
        <div style="text-align: center; margin-top:24px;">
          <a href="{settings.FRONTEND_URL}/reset-password" style="display: inline-block; background: #dc2626; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px;">
            Secure My Account
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="Suspicious Login Detected",
            subtitle="We blocked or flagged an unusual login attempt on your account.",
            content=content
        )
        return self._send_and_log(email, "⚠️ Security Alert: Unusual login attempt", html_body, "safety_suspicious_login", user_id)

    def send_scam_warning_alert(self, email: str, name: str, reason: str, user_id: Optional[int] = None) -> bool:
        content = f"""
        <div style="background: #fffbeb; border-radius: 12px; padding: 24px; border: 1px solid #fef3c7; color: #b45309; margin-bottom: 24px;">
          <h4 style="margin:0 0 12px 0; font-weight:800; font-size:16px;">⚠️ Marketplace Safety Warning</h4>
          <p style="margin:0; font-size:14px; line-height:1.6;">{reason}</p>
        </div>
        <div style="background:#f8fafc; padding:20px; border-radius:12px; font-size:13px; color:#475569;">
          <h5 style="margin:0 0 8px 0; font-weight:800; color:#1e293b;">Safe Trading Checklist:</h5>
          <ul style="margin:0; padding-left:20px; line-height:1.7;">
            <li>Meet in high-density, public, well-lit places (e.g. malls, restaurants).</li>
            <li>Never send deposits before physically inspecting the product.</li>
            <li>Use the official platform chat to retain safety guarantees.</li>
          </ul>
        </div>
        """
        html_body = self._get_base_template(
            title="Marketplace Safety Reminder",
            subtitle="We want you to have a secure and scam-free experience.",
            content=content
        )
        return self._send_and_log(email, "🔒 Important: Safety alert regarding your marketplace actions", html_body, "safety_scam_warning", user_id)

    def send_account_protection_alert(self, email: str, name: str, action: str, user_id: Optional[int] = None) -> bool:
        content = f"""
        <p style="font-size:15px; color:#475569; line-height:1.6;">
          Hello {name},<br><br>
          This is an automated confirmation that a security profile update occurred: <strong>{action}</strong>.
        </p>
        <p style="font-size:13px; color:#94a3b8; font-style:italic; margin-top:24px;">
          If you did not perform this action, please reach out to our platform administration support team instantly.
        </p>
        """
        html_body = self._get_base_template(
            title="Account Security Notification",
            subtitle="Security configurations updated on your profile.",
            content=content
        )
        return self._send_and_log(email, f"Security Alert: {action}", html_body, "safety_protection", user_id)

    # E. Engagement / Retention Emails
    def send_weekly_digest(
        self,
        email: str,
        name: str,
        location: str,
        items: List[dict],
        categories: List[dict],
        user_id: Optional[int] = None
    ) -> bool:
        items_html = ""
        for item in items[:3]:
            img_html = f'<td style="width:70px; padding-right:12px;"><img src="{item.get("image_url")}" style="width:70px; height:70px; object-fit:cover; border-radius:8px;" /></td>' if item.get("image_url") else ''
            items_html += f"""
            <tr style="border-bottom:1px solid #f1f5f9;">
              {img_html}
              <td style="padding:10px 0; vertical-align:top;">
                <h4 style="margin:0; font-size:13px; font-weight:800; color:#1e293b;">{item.get("title")}</h4>
                <p style="margin:4px 0 0 0; font-size:12px; color:#ea580c; font-weight:700;">KES {item.get("price")}</p>
              </td>
              <td style="text-align:right;">
                <a href="{settings.FRONTEND_URL}/listing/{item.get("id")}" style="display:inline-block; background:#0ea5e9; color:white; font-size:11px; padding:4px 10px; border-radius:6px; text-decoration:none; font-weight:800;">View</a>
              </td>
            </tr>
            """
        
        cats_html = ""
        for cat in categories[:4]:
            cats_html += f'<span style="display:inline-block; background:#f1f5f9; color:#475569; font-size:12px; font-weight:700; padding:6px 12px; border-radius:20px; margin:4px;">{cat.get("name")}</span>'
            
        content = f"""
        <h3 style="margin-top:0; font-size:15px; color:#1e293b; font-weight:800;">🔥 Fresh Deals in {location}:</h3>
        <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
          {items_html}
        </table>
        
        <h3 style="font-size:15px; color:#1e293b; font-weight:800; margin-bottom:12px;">Explore Popular Categories:</h3>
        <div style="margin-bottom:24px;">
          {cats_html}
        </div>
        """
        html_body = self._get_base_template(
            title="Your Weekly Suqafuran Digest",
            subtitle="Hand-picked deals and trending items matching your profile.",
            content=content
        )
        return self._send_and_log(email, f"Weekly Deals Digest in {location}", html_body, "retention_weekly_digest", user_id, preferred_provider="brevo")

    def send_reengagement_email(self, email: str, name: str, reason: str, featured_items: List[dict], user_id: Optional[int] = None) -> bool:
        items_html = ""
        for item in featured_items[:2]:
            img_html = f'<img src="{item.get("image_url")}" style="width:100%; height:110px; object-fit:cover; border-radius:8px; margin-bottom:8px;" />' if item.get("image_url") else ''
            items_html += f"""
            <div style="width:48%; display:inline-block; box-sizing:border-box; padding:4px; vertical-align:top;">
              <div style="background:#f8fafc; border:1px solid #f1f5f9; padding:8px; border-radius:12px;">
                {img_html}
                <h4 style="margin:0; font-size:12px; font-weight:800; color:#1e293b; height:32px; overflow:hidden;">{item.get("title")}</h4>
                <p style="margin:4px 0 0 0; font-size:12px; color:#ea580c; font-weight:700;">KES {item.get("price")}</p>
              </div>
            </div>
            """
        content = f"""
        <p style="font-size:15px; color:#475569; margin-bottom:24px;">
          Hello {name},<br><br>
          We've missed you! There are so many newly uploaded deals matching your search patterns that we just couldn't keep them from you.
        </p>
        <div style="margin-bottom:24px;">
          {items_html}
        </div>
        <div style="text-align: center;">
          <a href="{settings.FRONTEND_URL}/search" style="display: inline-block; background: #0ea5e9; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px;">
            Come Back & Explore
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="We Miss You!",
            subtitle=reason,
            content=content
        )
        return self._send_and_log(email, "We miss you — new deals waiting", html_body, "retention_reengagement", user_id, preferred_provider="brevo")

    def send_abandoned_action_email(self, email: str, name: str, action: str, user_id: Optional[int] = None) -> bool:
        if action == "listing":
            title = "Finish posting your listing"
            subtitle = "You were just a few clicks away from getting cash for your item."
            action_text = "Resume Listing"
            action_url = f"{settings.FRONTEND_URL}/post"
            detail = "Your draft listing was saved. Resume now and list it in front of thousands of active buyers."
        else:
            title = "Complete your registration"
            subtitle = "Finish signing up to unlock premium local trading features."
            action_text = "Finish Signup"
            action_url = f"{settings.FRONTEND_URL}/signup"
            detail = "Unlock instant messaging, deal negotiation tools, and verified gold profile badges."

        content = f"""
        <p style="font-size:15px; color:#475569; margin-bottom:24px;">
          Hello {name},<br><br>
          {detail}
        </p>
        <div style="text-align: center; margin:32px 0;">
          <a href="{action_url}" style="display: inline-block; background: #ea580c; color: white; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 14px;">
            {action_text}
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title=title,
            subtitle=subtitle,
            content=content
        )
        return self._send_and_log(email, title, html_body, "retention_abandoned_action", user_id)

    # F. Seller Growth Emails
    def send_seller_tips(self, email: str, name: str, user_id: Optional[int] = None) -> bool:
        content = f"""
        <div style="background:#f0fdf4; border-radius:16px; padding:24px; border:1px solid #bbf7d0; margin-bottom:24px;">
          <h4 style="margin:0 0 12px 0; color:#16a34a; font-weight:800;">🚀 How to Sell 5x Faster:</h4>
          <ul style="margin:0; padding-left:20px; color:#334155; font-size:14px; line-height:1.8;">
            <li>📸 <strong>Take bright, clear photos:</strong> Buyers ignore dark or blurry pictures.</li>
            <li>🏷️ <strong>Price it right:</strong> Check similar items nearby and price competitively.</li>
            <li>💬 <strong>Respond instantly:</strong> Quick response times increase sales conversion by 80%.</li>
          </ul>
        </div>
        <div style="text-align: center;">
          <a href="{settings.FRONTEND_URL}/post" style="display: inline-block; background: #16a34a; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px;">
            Create New Listing
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="Pro Seller Tips",
            subtitle="Learn how to close deals faster and make more money.",
            content=content
        )
        return self._send_and_log(email, "How to sell faster on Suqafuran", html_body, "seller_growth_tips", user_id)

    def send_boost_listing_suggestion(
        self,
        email: str,
        name: str,
        listing_title: str,
        listing_id: int,
        views: int,
        user_id: Optional[int] = None
    ) -> bool:
        content = f"""
        <p style="font-size:15px; color:#475569; line-height:1.6;">
          Hello {name},<br><br>
          Your listing <strong>{listing_title}</strong> has received <strong>{views} organic views</strong>. Excellent work!
        </p>
        <div style="background:#fff7ed; border:1px solid #ffedd5; padding:20px; border-radius:12px; margin:24px 0; text-align:center;">
          <h4 style="margin:0 0 8px 0; color:#c2410c; font-weight:800;">Get up to 10x More Views!</h4>
          <p style="margin:0 0 16px 0; font-size:13px; color:#475569;">Promoting your item pushes it back to the top and features it prominently across Nairobi.</p>
          <a href="{settings.FRONTEND_URL}/promote/{listing_id}" style="display: inline-block; background: #ea580c; color: white; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 800; font-size: 12px;">
            Boost Listing Now
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="Promote Your Listing",
            subtitle="Unlock massive visibility and close the deal today.",
            content=content
        )
        return self._send_and_log(email, f"Boost '{listing_title}' to get more views", html_body, "seller_growth_boost", user_id)

    def send_performance_insights(self, email: str, name: str, views: int, clicks: int, messages: int, user_id: Optional[int] = None) -> bool:
        content = f"""
        <div style="background:#f8fafc; border-radius:16px; padding:24px; border:1px solid #e2e8f0; margin-bottom:24px;">
          <table style="width: 100%; text-align: center; border-collapse: collapse;">
            <tr>
              <td style="width:33.3%; padding:12px 0; border-right:1px solid #e2e8f0;">
                <span style="font-size: 24px; font-weight: 900; color: #0ea5e9;">{views}</span><br>
                <span style="font-size: 12px; color: #64748b;">Views</span>
              </td>
              <td style="width:33.3%; padding:12px 0; border-right:1px solid #e2e8f0;">
                <span style="font-size: 24px; font-weight: 900; color: #10b981;">{clicks}</span><br>
                <span style="font-size: 12px; color: #64748b;">Clicks</span>
              </td>
              <td style="width:33.3%; padding:12px 0;">
                <span style="font-size: 24px; font-weight: 900; color: #ea580c;">{messages}</span><br>
                <span style="font-size: 12px; color: #64748b;">Messages</span>
              </td>
            </tr>
          </table>
        </div>
        """
        html_body = self._get_base_template(
            title="Your Weekly Performance Insights",
            subtitle="Here is how your listings performed on Suqafuran over the last 7 days.",
            content=content
        )
        return self._send_and_log(email, "Your weekly performance insights on Suqafuran", html_body, "seller_growth_insights", user_id)

    # G. Buyer Behavior Emails
    def send_recommendations_email(self, email: str, name: str, recommendations: List[dict], user_id: Optional[int] = None) -> bool:
        items_html = ""
        for item in recommendations[:3]:
            img_html = f'<td style="width:70px; padding-right:12px;"><img src="{item.get("image_url")}" style="width:70px; height:70px; object-fit:cover; border-radius:8px;" /></td>' if item.get("image_url") else ''
            items_html += f"""
            <tr style="border-bottom:1px solid #f1f5f9;">
              {img_html}
              <td style="padding:10px 0; vertical-align:top;">
                <h4 style="margin:0; font-size:13px; font-weight:800; color:#1e293b;">{item.get("title")}</h4>
                <p style="margin:4px 0 0 0; font-size:12px; color:#ea580c; font-weight:700;">KES {item.get("price")}</p>
              </td>
              <td style="text-align:right;">
                <a href="{settings.FRONTEND_URL}/listing/{item.get("id")}" style="display:inline-block; background:#0ea5e9; color:white; font-size:11px; padding:4px 10px; border-radius:6px; text-decoration:none; font-weight:800;">View</a>
              </td>
            </tr>
            """
        content = f"""
        <table style="width:100%; border-collapse:collapse;">
          {items_html}
        </table>
        """
        html_body = self._get_base_template(
            title="Recommendations for You",
            subtitle="Based on your recent browsing activity on the platform.",
            content=content
        )
        return self._send_and_log(email, "Recommended deals based on your browsing", html_body, "buyer_behavior_recommendations", user_id)

    def send_similar_items_email(self, email: str, name: str, source_item_title: str, items: List[dict], user_id: Optional[int] = None) -> bool:
        items_html = ""
        for item in items[:2]:
            img_html = f'<img src="{item.get("image_url")}" style="width:100%; height:110px; object-fit:cover; border-radius:8px; margin-bottom:8px;" />' if item.get("image_url") else ''
            items_html += f"""
            <div style="width:48%; display:inline-block; box-sizing:border-box; padding:4px; vertical-align:top;">
              <div style="background:#f8fafc; border:1px solid #f1f5f9; padding:8px; border-radius:12px;">
                {img_html}
                <h4 style="margin:0; font-size:12px; font-weight:800; color:#1e293b; height:32px; overflow:hidden;">{item.get("title")}</h4>
                <p style="margin:4px 0 0 0; font-size:12px; color:#ea580c; font-weight:700;">KES {item.get("price")}</p>
              </div>
            </div>
            """
        content = f"""
        <div style="margin-bottom:24px;">
          {items_html}
        </div>
        """
        html_body = self._get_base_template(
            title="Similar Items Available",
            subtitle=f"Check out these listings similar to the '{source_item_title}' you recently viewed.",
            content=content
        )
        return self._send_and_log(email, f"Similar items to '{source_item_title}'", html_body, "buyer_behavior_similar", user_id)

    # H. Admin / Platform Emails
    # H. Admin / Platform Emails
    def send_system_alert(self, email: str, subject: str, body: str, user_id: Optional[int] = None) -> bool:
        content = f"""
        <div style="background:#f8fafc; border-radius:12px; padding:20px; border:1px solid #e2e8f0; font-size:14px; line-height:1.6; color:#334155;">
          {body}
        </div>
        """
        html_body = self._get_base_template(
            title="System / Admin Notice",
            subtitle="Important administrative notification regarding your account or activities.",
            content=content
        )
        return self._send_and_log(email, subject, html_body, "admin_system_alert", user_id)

    # 1. Additional Transactional Emails
    def send_offer_response(
        self,
        email: str,
        name: str,
        item_title: str,
        response_status: str,
        response_amount: Optional[str] = None,
        user_id: Optional[int] = None
    ) -> bool:
        amount_details = ""
        if response_amount:
            amount_details = f"""
            <div style="background: #fff7ed; border-radius: 12px; padding: 16px; text-align: center; margin: 16px 0; border: 1px solid #ffedd5;">
              <span style="font-size: 13px; color: #64748b;">Counter Offer Price</span><br>
              <span style="font-size: 24px; font-weight: 900; color: #ea580c;">KES {response_amount}</span>
            </div>
            """
        content = f"""
        <p style="font-size: 15px; color: #475569;">
          Hello {name},<br><br>
          We've received an update on your offer for <strong>{item_title}</strong>. The seller has marked the request as:
          <strong style="color: #ea580c; text-transform: uppercase;">{response_status}</strong>.
        </p>
        {amount_details}
        <div style="text-align: center; margin-top: 24px;">
          <a href="{settings.FRONTEND_URL}/offers" style="display: inline-block; background: #0ea5e9; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px;">
            View My Offers
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="Offer Status Update",
            subtitle="A seller has responded to your marketplace offer.",
            content=content
        )
        return self._send_and_log(email, f"Update on your offer: '{item_title}'", html_body, "transaction_offer_response", user_id)

    # 2. Additional Trust & Safety Emails
    def send_password_change_alert(
        self,
        email: str,
        name: str,
        timestamp: str,
        ip: str,
        user_id: Optional[int] = None
    ) -> bool:
        content = f"""
        <div style="background: #fef2f2; border-radius: 12px; padding: 16px; border: 1px solid #fecaca; color: #b91c1c; font-size: 14px; font-weight: 700; margin-bottom: 20px;">
          ⚠️ Notice: Your password was changed
        </div>
        <p style="font-size: 14px; color: #475569; line-height: 1.6;">
          Hello {name},<br><br>
          This is an automated security notification that the password linked to your Suqafuran account was updated on <strong>{timestamp}</strong> from IP address <strong>{ip}</strong>.
        </p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 12px; margin: 24px 0; font-size: 13px; color: #64748b;">
          <strong>If this was you:</strong> You can safely ignore this warning notice.<br><br>
          <strong>If this wasn't you:</strong> Contact platform safety moderators immediately.
        </div>
        <div style="text-align: center;">
          <a href="{settings.FRONTEND_URL}/support" style="display: inline-block; background: #dc2626; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px;">
            Contact Support
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="Password Changed",
            subtitle="Security configurations updated on your profile.",
            content=content
        )
        return self._send_and_log(email, "⚠️ Security Notice: Password changed on Suqafuran", html_body, "safety_password_change", user_id)

    def send_new_device_login_alert(
        self,
        email: str,
        name: str,
        device: str,
        location: str,
        timestamp: str,
        ip: str,
        user_id: Optional[int] = None
    ) -> bool:
        content = f"""
        <div style="background: #fffbeb; border-radius: 12px; padding: 16px; border: 1px solid #fef3c7; color: #b45309; font-size: 14px; font-weight: 700; margin-bottom: 20px;">
          ⚠️ Unrecognized login attempt detected
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:13px; color:#475569; margin:16px 0;">
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; font-weight:700;">Device Model</td><td style="padding:8px 0; text-align:right;">{device}</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; font-weight:700;">Approximated Location</td><td style="padding:8px 0; text-align:right;">{location}</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; font-weight:700;">IP Address</td><td style="padding:8px 0; text-align:right;">{ip}</td></tr>
          <tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:8px 0; font-weight:700;">Time Recorded</td><td style="padding:8px 0; text-align:right;">{timestamp}</td></tr>
        </table>
        <div style="text-align: center; margin-top:24px;">
          <a href="{settings.FRONTEND_URL}/security-logs" style="display: inline-block; background: #b45309; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px;">
            Review Login Activity
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="Unrecognized Login Detected",
            subtitle="We flagged an unusual sign-in fingerprint on your profile.",
            content=content
        )
        return self._send_and_log(email, "⚠️ Security Alert: Login on new device detected", html_body, "safety_new_device", user_id)

    def send_profile_updated_email(
        self,
        email: str,
        name: str,
        changed_fields: List[str],
        timestamp: str,
        user_id: Optional[int] = None
    ) -> bool:
        fields_list = " and ".join(changed_fields) if len(changed_fields) <= 2 else ", ".join(changed_fields[:-1]) + f", and {changed_fields[-1]}"
        content = f"""
        <div style="background: #fffbeb; border-radius: 12px; padding: 16px; border: 1px solid #fef3c7; color: #b45309; font-size: 14px; font-weight: 700; margin-bottom: 20px;">
          ⚠️ Notice: Your account details were updated
        </div>
        <p style="font-size: 14px; color: #475569; line-height: 1.6;">
          Hello {name},<br><br>
          This is an automated security notification that your <strong>{fields_list}</strong> was changed on <strong>{timestamp}</strong>.
        </p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 12px; margin: 24px 0; font-size: 13px; color: #64748b;">
          <strong>If this was you:</strong> You can safely ignore this notice.<br><br>
          <strong>If this wasn't you:</strong> Contact platform safety moderators immediately.
        </div>
        <div style="text-align: center;">
          <a href="{settings.FRONTEND_URL}/support" style="display: inline-block; background: #b45309; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px;">
            Contact Support
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="Account Details Updated",
            subtitle="Security configurations updated on your profile.",
            content=content
        )
        return self._send_and_log(email, "⚠️ Security Notice: Account details changed on Suqafuran", html_body, "safety_profile_updated", user_id)

    def send_account_deleted_email(self, email: str, name: str, user_id: Optional[int] = None) -> bool:
        content = f"""
        <p style="font-size: 15px; color: #475569; line-height: 1.6;">
          Hello {name},<br><br>
          This confirms that your Suqafuran account and all associated data (listings, messages, favorites, and account history) have been permanently deleted, as you requested.
        </p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 12px; margin: 24px 0; font-size: 13px; color: #64748b;">
          If you didn't request this, or changed your mind, contact support right away — this action cannot be undone once complete.
        </div>
        <div style="text-align: center;">
          <a href="mailto:support@suqafuran.so" style="display: inline-block; background: #64748b; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px;">
            Contact Support
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="Your Account Has Been Deleted",
            subtitle="Confirming your Suqafuran account was permanently removed.",
            content=content
        )
        return self._send_and_log(email, "Your Suqafuran account has been deleted", html_body, "account_deleted", user_id)

    def send_account_deactivated_email(self, email: str, name: str, reason: Optional[str] = None, user_id: Optional[int] = None) -> bool:
        reason_html = f'<p style="margin-top:12px; font-size:13px; color:#64748b;"><strong>Reason:</strong> {reason}</p>' if reason else ""
        content = f"""
        <div style="background: #fef2f2; border-radius: 12px; padding: 16px; border: 1px solid #fecaca; color: #b91c1c; font-size: 14px; font-weight: 700; margin-bottom: 20px;">
          ⚠️ Your account has been temporarily locked
        </div>
        <p style="font-size: 14px; color: #475569; line-height: 1.6;">
          Hello {name},<br><br>
          Your Suqafuran account has been temporarily locked by our platform safety team, and you won't be able to sign in until it's reviewed.
        </p>
        {reason_html}
        <div style="text-align: center; margin-top:24px;">
          <a href="{settings.FRONTEND_URL}/support" style="display: inline-block; background: #dc2626; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px;">
            Contact Support
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="Account Temporarily Locked",
            subtitle="Your account access has been restricted pending review.",
            content=content
        )
        return self._send_and_log(email, "⚠️ Your Suqafuran account has been temporarily locked", html_body, "safety_account_locked", user_id)

    def send_new_follower_email(self, email: str, name: str, follower_name: str, follower_profile_url: str, user_id: Optional[int] = None) -> bool:
        content = f"""
        <p style="font-size: 15px; color: #475569; line-height: 1.6;">
          Hello {name},<br><br>
          <strong>{follower_name}</strong> just started following your shop on Suqafuran and will get notified whenever you post new listings.
        </p>
        <div style="text-align: center; margin-top: 24px;">
          <a href="{follower_profile_url}" style="display: inline-block; background: #ea580c; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px;">
            View Your Shop
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="You Have a New Follower!",
            subtitle="Someone's keeping an eye on your listings.",
            content=content
        )
        return self._send_and_log(email, f"{follower_name} started following your shop on Suqafuran", html_body, "activity_new_follower", user_id)

    def send_listing_removed_email(self, email: str, name: str, listing_title: str, removal_reason: str, user_id: Optional[int] = None) -> bool:
        content = f"""
        <div style="background: #fef2f2; border-radius: 12px; padding: 16px; border: 1px solid #fecaca; color: #b91c1c; font-size: 14px; font-weight: 700; margin-bottom: 20px;">
          Your listing has been taken down
        </div>
        <p style="font-size: 14px; color: #475569; line-height: 1.6;">
          Hello {name},<br><br>
          Your listing <strong>{listing_title}</strong> was live on Suqafuran but has since been removed.
        </p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 12px; margin: 24px 0; font-size: 13px; color: #64748b;">
          <strong>Reason:</strong> {removal_reason}
        </div>
        <div style="text-align: center;">
          <a href="{settings.FRONTEND_URL}/support" style="display: inline-block; background: #64748b; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px;">
            Contact Support
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="Listing Removed",
            subtitle="One of your live listings was taken down.",
            content=content
        )
        return self._send_and_log(email, f"Your listing '{listing_title}' has been removed", html_body, "seller_listing_removed", user_id)

    # 3. Additional Engagement & Retention Emails
    def send_recommended_items_email(
        self,
        email: str,
        name: str,
        items: List[dict],
        user_id: Optional[int] = None
    ) -> bool:
        items_html = ""
        for item in items[:4]:
            img_html = f'<td style="width:70px; padding-right:12px;"><img src="{item.get("image_url")}" style="width:70px; height:70px; object-fit:cover; border-radius:8px;" /></td>' if item.get("image_url") else ''
            items_html += f"""
            <tr style="border-bottom:1px solid #f1f5f9;">
              {img_html}
              <td style="padding:10px 0; vertical-align:top;">
                <h4 style="margin:0; font-size:13px; font-weight:800; color:#1e293b;">{item.get("title")}</h4>
                <p style="margin:4px 0 0 0; font-size:12px; color:#ea580c; font-weight:700;">KES {item.get("price")}</p>
                <p style="margin:2px 0 0 0; font-size:11px; color:#94a3b8;">{item.get("location")}</p>
              </td>
              <td style="text-align:right;">
                <a href="{settings.FRONTEND_URL}/listing/{item.get("id")}" style="display:inline-block; background:#0ea5e9; color:white; font-size:11px; padding:4px 10px; border-radius:6px; text-decoration:none; font-weight:800;">View Deal</a>
              </td>
            </tr>
            """
        content = f"""
        <table style="width:100%; border-collapse:collapse; margin-top:16px;">
          {items_html}
        </table>
        """
        html_body = self._get_base_template(
            title="Handpicked Recommended Items",
            subtitle="Based on your search history and recent interactions on the platform.",
            content=content
        )
        return self._send_and_log(email, "Recommended Deals specifically selected for you", html_body, "retention_recommendations", user_id, preferred_provider="brevo")

    def send_category_interest_email(
        self,
        email: str,
        name: str,
        category_name: str,
        items: List[dict],
        user_id: Optional[int] = None
    ) -> bool:
        items_html = ""
        for item in items[:4]:
            img_html = f'<img src="{item.get("image_url")}" style="width:100%; height:110px; object-fit:cover; border-radius:8px; margin-bottom:8px;" />' if item.get("image_url") else ''
            items_html += f"""
            <div style="width:48%; display:inline-block; box-sizing:border-box; padding:4px; vertical-align:top; margin-bottom: 12px;">
              <div style="background:#f8fafc; border:1px solid #f1f5f9; padding:8px; border-radius:12px;">
                {img_html}
                <h4 style="margin:0; font-size:12px; font-weight:800; color:#1e293b; height:32px; overflow:hidden;">{item.get("title")}</h4>
                <p style="margin:4px 0 0 0; font-size:12px; color:#ea580c; font-weight:700;">KES {item.get("price")}</p>
                <a href="{settings.FRONTEND_URL}/listing/{item.get("id")}" style="display:block; text-align:center; background:#0ea5e9; color:white; font-size:10px; padding:4px; border-radius:4px; text-decoration:none; margin-top:8px; font-weight:800;">Details</a>
              </div>
            </div>
            """
        content = f"""
        <p style="font-size: 15px; color: #475569; margin-bottom: 20px;">
          Hello {name},<br><br>
          It looks like you've been searching for items in the <strong>{category_name}</strong> category. We gathered the absolute best trending ads just for you:
        </p>
        <div style="width:100%;">
          {items_html}
        </div>
        """
        html_body = self._get_base_template(
            title=f"Hottest deals in {category_name}",
            subtitle=f"Check out what's fresh in your favorite marketplace section today.",
            content=content
        )
        return self._send_and_log(email, f"Fresh deals in '{category_name}' matching your interests", html_body, "retention_category_interest", user_id, preferred_provider="brevo")

    def send_viewed_no_contact_reminder(
        self,
        email: str,
        name: str,
        listing_title: str,
        listing_price: str,
        listing_image: Optional[str],
        listing_url: str,
        user_id: Optional[int] = None
    ) -> bool:
        """Sent when someone views a listing but never messages the seller about
        it (see app/tasks/email_tasks.py:send_viewed_no_contact_reminders_task).
        One nudge per (user, listing), ever -- the point is a gentle reminder
        the item is still there, not a repeated push."""
        img_html = f'<img src="{listing_image}" style="width:100%; max-height:220px; object-fit:cover; border-radius:12px; margin-bottom:16px;" />' if listing_image else ''
        content = f"""
        <p style="font-size: 15px; color: #475569; margin-bottom: 20px; line-height: 1.6;">
          Hello {name},<br><br>
          You looked at this one but never got around to asking the seller anything. Good news -- it's still up for grabs:
        </p>
        <div style="background:#f8fafc; border:1px solid #f1f5f9; border-radius:16px; padding:16px; margin-bottom:20px;">
          {img_html}
          <h3 style="margin:0; font-size:16px; font-weight:800; color:#1e293b;">{listing_title}</h3>
          <p style="margin:6px 0 16px 0; font-size:20px; color:#ea580c; font-weight:900;">{listing_price}</p>
          <a href="{listing_url}" style="display:block; text-align:center; background:#00a082; color:white; font-size:14px; padding:12px; border-radius:10px; text-decoration:none; font-weight:800;">
            Ask the seller a question
          </a>
        </div>
        <p style="font-size: 13px; color: #94a3b8;">
          A quick "Is this still available?" is usually all it takes to get things moving.
        </p>
        """
        html_body = self._get_base_template(
            title="Still thinking about it?",
            subtitle="The item you checked out is still available.",
            content=content
        )
        return self._send_and_log(email, f'Still interested in "{listing_title}"?', html_body, "retention_viewed_no_contact", user_id, preferred_provider="brevo")

    def send_market_summary_email(
        self,
        email: str,
        name: str,
        location: str,
        average_price_change: str,
        popular_keywords: List[str],
        user_id: Optional[int] = None
    ) -> bool:
        keyword_chips = ""
        for kw in popular_keywords:
            keyword_chips += f'<span style="display:inline-block; background:#fff7ed; color:#c2410c; border:1px solid #ffedd5; font-size:11px; font-weight:700; padding:6px 12px; border-radius:20px; margin:4px;">#{kw}</span>'
        content = f"""
        <p style="font-size: 15px; color: #475569; line-height: 1.6;">
          Hello {name},<br><br>
          Here is your localized market valuation digest for <strong>{location}</strong>:
        </p>
        <div style="background: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; margin-bottom: 24px;">
          <h4 style="margin:0 0 12px 0; color:#1e293b; font-size:14px;">Market Velocity Indicators:</h4>
          <ul style="margin:0; padding-left:20px; font-size:13px; color:#475569; line-height:1.7;">
            <li>📈 Average Listing Price Change: <strong>{average_price_change}</strong></li>
            <li>⚡ Demand Velocity Index: <strong>High</strong></li>
          </ul>
        </div>
        <h4 style="margin:0 0 12px 0; font-size:13px; color:#1e293b;">Trending Keywords in {location}:</h4>
        <div style="margin-bottom:24px;">
          {keyword_chips}
        </div>
        """
        html_body = self._get_base_template(
            title="Local Market Summary",
            subtitle="Keep track of market conditions and popular search trends in your region.",
            content=content
        )
        return self._send_and_log(email, f"Suqafuran Market Report: Trending in {location}", html_body, "retention_market_summary", user_id)

    # 4. Additional Seller Growth Emails
    def send_listing_performance_email(
        self,
        email: str,
        name: str,
        listing_title: str,
        views: int,
        clicks: int,
        inquiries: int,
        user_id: Optional[int] = None
    ) -> bool:
        ctr = f"{(clicks / views * 100):.1f}%" if views > 0 else "0.0%"
        content = f"""
        <p style="font-size:15px; color:#475569;">
          Hello {name},<br><br>
          Here is the dynamic catalog diagnostic report for your listing <strong>{listing_title}</strong>:
        </p>
        <div style="background:#f8fafc; border-radius:16px; padding:20px; border:1px solid #e2e8f0; margin:24px 0;">
          <table style="width: 100%; text-align: center; border-collapse: collapse;">
            <tr>
              <td style="width:25%; padding:10px 0; border-right:1px solid #e2e8f0;">
                <span style="font-size: 20px; font-weight: 900; color: #0ea5e9;">{views}</span><br>
                <span style="font-size: 11px; color: #64748b;">Views</span>
              </td>
              <td style="width:25%; padding:10px 0; border-right:1px solid #e2e8f0;">
                <span style="font-size: 20px; font-weight: 900; color: #10b981;">{clicks}</span><br>
                <span style="font-size: 11px; color: #64748b;">Clicks</span>
              </td>
              <td style="width:25%; padding:10px 0; border-right:1px solid #e2e8f0;">
                <span style="font-size: 20px; font-weight: 900; color: #f59e0b;">{ctr}</span><br>
                <span style="font-size: 11px; color: #64748b;">CTR</span>
              </td>
              <td style="width:25%; padding:10px 0;">
                <span style="font-size: 20px; font-weight: 900; color: #ea580c;">{inquiries}</span><br>
                <span style="font-size: 11px; color: #64748b;">Inquiries</span>
              </td>
            </tr>
          </table>
        </div>
        """
        html_body = self._get_base_template(
            title="Listing Performance Report",
            subtitle="Track client interaction data to optimize catalog metrics.",
            content=content
        )
        return self._send_and_log(email, f"Monthly performance report: '{listing_title}'", html_body, "seller_growth_listing_performance", user_id)

    def send_boost_listing_email(
        self,
        email: str,
        name: str,
        listing_title: str,
        listing_id: int,
        current_views: int,
        boost_multiplier: int = 10,
        user_id: Optional[int] = None
    ) -> bool:
        content = f"""
        <p style="font-size: 15px; color: #475569; line-height: 1.6;">
          Hello {name},<br><br>
          Your listing <strong>{listing_title}</strong> has received <strong>{current_views} views</strong>. Unlock premium visibility upgrades to sell up to {boost_multiplier}x faster!
        </p>
        <div style="background: #fff7ed; border: 1px solid #ffedd5; padding: 20px; border-radius: 12px; text-align: center; margin: 24px 0;">
          <h4 style="margin:0 0 8px 0; color:#ea580c; font-weight:800;">Get up to {boost_multiplier}x More Leads!</h4>
          <p style="margin:0 0 16px 0; font-size:13px; color:#475569;">Pushes your ad back to the top of category pages and features it prominently across regional feeds.</p>
          <a href="{settings.FRONTEND_URL}/promote/{listing_id}" style="display: inline-block; background: #ea580c; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px;">
            Promote My Listing Now
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="Boost Active Listing",
            subtitle="Sellers who utilize promo options close deals in less than 48 hours.",
            content=content
        )
        return self._send_and_log(email, f"⚡ Promoted ad booster suggestion: '{listing_title}'", html_body, "seller_growth_boost_listing", user_id)

    def send_ai_pricing_suggestion_email(
        self,
        email: str,
        name: str,
        listing_title: str,
        current_price: str,
        suggested_price: str,
        price_difference: str,
        confidence_score: float,
        user_id: Optional[int] = None
    ) -> bool:
        conf_pct = f"{(confidence_score * 100):.0f}%"
        content = f"""
        <p style="font-size: 15px; color: #475569;">
          Hello {name},<br><br>
          Our regional marketplace AI demand models scanned nearby catalog pricing and supply indicators for <strong>{listing_title}</strong>:
        </p>
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr style="border-bottom:1px solid #bbf7d050;"><td style="padding:8px 0; color:#334155;">Current Price</td><td style="padding:8px 0; text-align:right; font-weight:700;">KES {current_price}</td></tr>
            <tr style="border-bottom:1px solid #bbf7d050;"><td style="padding:8px 0; color:#16a34a; font-weight:700;">Suggested Price</td><td style="padding:8px 0; text-align:right; font-weight:900; color:#16a34a;">KES {suggested_price}</td></tr>
            <tr style="border-bottom:1px solid #bbf7d050;"><td style="padding:8px 0; color:#334155;">Difference</td><td style="padding:8px 0; text-align:right; font-weight:700; color:#dc2626;">KES {price_difference}</td></tr>
            <tr><td style="padding:8px 0; color:#334155;">Model Confidence</td><td style="padding:8px 0; text-align:right; font-weight:700; color:#16a34a;">{conf_pct}</td></tr>
          </table>
        </div>
        """
        html_body = self._get_base_template(
            title="AI Smart Pricing Suggestion",
            subtitle="Adjusting pricing metrics based on supply trends increases lead conversion by 65%.",
            content=content
        )
        return self._send_and_log(email, f"🤖 AI Pricing optimization suggestion for '{listing_title}'", html_body, "seller_growth_ai_pricing", user_id)

    def send_seller_milestone_email(
        self,
        email: str,
        name: str,
        milestone_type: str,
        badge_earned: str,
        reward_detail: str,
        user_id: Optional[int] = None
    ) -> bool:
        content = f"""
        <p style="font-size:15px; color:#475569; line-height: 1.6;">
          Hello {name},<br><br>
          Congratulations! Your seller profile completed a critical milestone threshold: <strong>{milestone_type}</strong>!
        </p>
        <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 24px; border-radius: 16px; text-align: center; margin: 24px 0;">
          <span style="font-size: 48px;">🏆</span><br>
          <h4 style="margin:8px 0 4px 0; color:#d97706; font-size:18px; font-weight:800;">Badge Earned: {badge_earned}</h4>
          <p style="margin:0; font-size:13px; color:#475569;">{reward_detail}</p>
        </div>
        """
        html_body = self._get_base_template(
            title="Seller Achievement Unlocked!",
            subtitle="Thank you for being a premium, top-performing seller on Suqafuran.",
            content=content
        )
        return self._send_and_log(email, f"🎉 Achievement unlocked: {badge_earned} badge earned!", html_body, "seller_growth_milestone", user_id)

    # 5. Additional Admin & Platform Emails
    def system_status_email(
        self,
        email: str,
        component: str,
        status: str,
        details: str,
        user_id: Optional[int] = None
    ) -> bool:
        color = "#16a34a" if status.lower() == "operational" else "#dc2626"
        content = f"""
        <div style="background: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
          <h4 style="margin:0 0 8px 0; color:#1e293b;">Platform Core Component Diagnostic Report:</h4>
          <p style="font-size:13px; color:#475569; margin:4px 0;">💻 <strong>Component:</strong> {component}</p>
          <p style="font-size:13px; color:{color}; margin:4px 0;">⚡ <strong>Status:</strong> {status.upper()}</p>
          <p style="font-size:13px; color:#475569; margin:4px 0;"><strong>Details:</strong> {details}</p>
        </div>
        """
        html_body = self._get_base_template(
            title="System Operational Status Alert",
            subtitle="Platform technical operations and service status update notifications.",
            content=content
        )
        return self._send_and_log(email, f"[System Status] {component} is {status}", html_body, "admin_system_status", user_id)

    def fraud_report_summary(
        self,
        email: str,
        report_count: int,
        pending_reviews: int,
        active_suspensions: int,
        user_id: Optional[int] = None
    ) -> bool:
        content = f"""
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
          <h4 style="margin: 0 0 12px 0; color: #b91c1c;">Moderate Queue Warning</h4>
          <table style="width: 100%; font-size: 13px; color: #334155;">
            <tr style="border-bottom:1px solid #fecaca50;"><td style="padding:6px 0;">Flagged Ads Reported</td><td style="padding:6px 0; text-align:right; font-weight:700; color:#b91c1c;">{report_count}</td></tr>
            <tr style="border-bottom:1px solid #fecaca50;"><td style="padding:6px 0;">Pending Review Queue</td><td style="padding:6px 0; text-align:right; font-weight:700;">{pending_reviews}</td></tr>
            <tr><td style="padding:6px 0;">Active Profile Suspensions</td><td style="padding:6px 0; text-align:right; font-weight:700;">{active_suspensions}</td></tr>
          </table>
        </div>
        """
        html_body = self._get_base_template(
            title="Safety & Fraud Queue Report",
            subtitle="Summary digest of flagged catalog items and pending mod reviews.",
            content=content
        )
        return self._send_and_log(email, f"[Moderation Alert] {report_count} pending fraud flags", html_body, "admin_fraud_report", user_id)

    def moderation_alert_email(
        self,
        email: str,
        name: str,
        listing_title: str,
        violation_reason: str,
        listing_id: int,
        user_id: Optional[int] = None
    ) -> bool:
        content = f"""
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin-bottom: 20px; color: #b91c1c; font-weight: bold; font-size: 14px;">
          ⚠️ Listing Hidden Due to Guideline Violation
        </div>
        <p style="font-size: 14px; color: #475569; line-height: 1.6;">
          Hello {name},<br><br>
          Our platform catalog filters or moderator team flag indicators identified structural issues with your active ad <strong>{listing_title}</strong>:
        </p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; color: #475569; margin: 16px 0;">
          🚫 <strong>Reason for Violation:</strong> {violation_reason}
        </div>
        <p style="font-size: 13px; color: #64748b;">
          Please edit your listing configuration details to align with the marketplace guidelines.
        </p>
        <div style="text-align: center; margin-top:24px;">
          <a href="{settings.FRONTEND_URL}/edit/{listing_id}" style="display: inline-block; background: #ea580c; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px;">
            Edit & Re-Submit Ad
          </a>
        </div>
        """
        html_body = self._get_base_template(
            title="Marketplace Listing Moderated",
            subtitle="Your listing has been hidden temporarily until guidelines are resolved.",
            content=content
        )
        return self._send_and_log(email, f"⚠️ Marketplace Notice: Guideline action taken on '{listing_title}'", html_body, "admin_moderation_alert", user_id)

    def analytics_summary_email(
        self,
        email: str,
        active_users: int,
        listings_created: int,
        transactions_completed: int,
        open_rate: float,
        user_id: Optional[int] = None
    ) -> bool:
        rate_pct = f"{(open_rate * 100):.1f}%"
        content = f"""
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #334155;">
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px 0; font-weight:700;">Weekly Active Users</td><td style="padding:10px 0; text-align:right; font-weight:800; color:#0ea5e9;">{active_users}</td></tr>
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px 0; font-weight:700;">New Listings Created</td><td style="padding:10px 0; text-align:right; font-weight:800; color:#10b981;">{listings_created}</td></tr>
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px 0; font-weight:700;">Transactions Completed</td><td style="padding:10px 0; text-align:right; font-weight:800; color:#f59e0b;">{transactions_completed}</td></tr>
            <tr><td style="padding:10px 0; font-weight:700;">Email Open Rate (KPI)</td><td style="padding:10px 0; text-align:right; font-weight:800; color:#ea580c;">{rate_pct}</td></tr>
          </table>
        </div>
        """
        html_body = self._get_base_template(
            title="Weekly KPI Analytics Digest",
            subtitle="Administrative overview of Suqafuran conversion metrics and engagement cohorts.",
            content=content
        )
    def send_custom_manual_email(
        self,
        email: str,
        subject: str,
        title: str,
        subtitle: Optional[str],
        content_html: str,
        action_text: Optional[str] = None,
        action_url: Optional[str] = None,
        campaign_id: Optional[str] = None,
        user_id: Optional[int] = None
    ) -> bool:
        # Resolve target user details + a real recent listing, so any
        # {{item_title}}/{{offer_amount}}/{{listing_id}}-style placeholder in
        # an admin-authored template (Send Test / Broadcast) renders real
        # data instead of shipping the literal "{{...}}" to the recipient.
        user_name = "Customer"
        user_email = email
        user_phone = "None"
        user_location = "None"

        from sqlmodel import Session, select
        from app.db.session import engine
        from app.models.user import User
        from app.models.listing import Listing, Category

        sample_ctx: dict = {}
        try:
            with Session(engine) as session:
                u = None
                if user_id:
                    u = session.get(User, int(user_id))
                else:
                    u = session.exec(select(User).where(User.email == email)).first()
                if u:
                    user_name = u.full_name or "Customer"
                    user_email = u.email or email
                    user_phone = u.phone or "None"
                    user_location = u.location or user_location
                    if not user_id:
                        user_id = u.id

                listing_row = session.exec(
                    select(Listing, Category)
                    .join(Category, Listing.category_id == Category.id)
                    .where(Listing.status == "active")
                    .order_by(Listing.id.desc())
                ).first()
                if listing_row:
                    listing, category = listing_row
                    price_str = f"{listing.price:,.0f}"
                    sample_ctx.update({
                        "item_title": listing.title_en, "listing_title": listing.title_en,
                        "item_price": price_str, "price": price_str, "current_price": price_str,
                        "offer_amount": price_str, "amount": price_str, "total_amount": price_str,
                        "response_amount": price_str, "suggested_price": price_str,
                        "old_price": price_str, "new_price": price_str,
                        "listing_id": str(listing.id), "order_id": str(listing.id),
                        "category": category.name_en, "category_name": category.name_en,
                        "offer_url": f"https://suqafuran.so/listing/{listing.id}",
                        "search_query": listing.title_en,
                        "current_views": str(listing.views),
                        "price_difference": "500",
                    })
        except Exception as e:
            print(f"[Email CRM] Error resolving user/listing metadata: {e}")

        import datetime
        now = datetime.datetime.utcnow()
        current_date_str = now.strftime("%B %d, %Y")

        sample_ctx.setdefault("location", user_location if user_location != "None" else "Mogadishu")
        sample_ctx.update({
            "name": user_name, "email": user_email, "phone": user_phone, "date": current_date_str,
            "timestamp": now.strftime("%B %d, %Y at %H:%M"),
            "tx_ref": f"SQF-{now.strftime('%Y%m%d')}-{user_id or 1000}",
            "chat_url": "https://suqafuran.so/messages",
            "seller_name": "the seller", "sender_name": "a buyer",
            "status": "accepted", "response_status": "accepted",
            "ip": "102.68.79.14", "device": "Chrome on Android",
            "reason": "unusual login activity", "action": "review your recent activity",
            "delivery_estimate": "2-3 business days", "violation_reason": "policy review",
            "milestone_type": "Top Seller", "badge_earned": "Top Seller",
            "reward_detail": "a featured listing credit", "payment_method": "M-Pesa",
            "message_excerpt": "Hi, is this still available?",
            "keyword_1": "iPhone", "keyword_2": "Sofa set", "average_price_change": "+3%",
            "subject": "Platform Update", "body": "", "component": "Payments",
            "details": "All systems operational",
        })
        sample_ctx.setdefault("item_title", "your item")
        sample_ctx.setdefault("listing_title", "your item")
        sample_ctx.setdefault("category", "General")
        sample_ctx.setdefault("category_name", "General")
        for k in ("price", "item_price", "current_price", "offer_amount", "amount",
                  "total_amount", "response_amount", "suggested_price", "old_price",
                  "new_price", "price_difference"):
            sample_ctx.setdefault(k, "1,500")
        sample_ctx.setdefault("listing_id", "0")
        sample_ctx.setdefault("order_id", "0")
        sample_ctx.setdefault("offer_url", "https://suqafuran.so/messages")
        sample_ctx.setdefault("search_query", "your saved search")
        sample_ctx.setdefault("current_views", "0")

        from jinja2 import Template as JinjaTemplate

        def apply_replacements(text: Optional[str]) -> Optional[str]:
            if not text:
                return text
            try:
                return JinjaTemplate(text).render(**sample_ctx)
            except Exception as e:
                print(f"[Email CRM] Jinja render failed, falling back to raw text: {e}")
                return text

        # Dynamically interpolate placeholders
        subject = apply_replacements(subject)
        title = apply_replacements(title)
        subtitle = apply_replacements(subtitle)
        content_html = apply_replacements(content_html)
        action_text = apply_replacements(action_text)
        action_url = apply_replacements(action_url)

        cta_button = ""
        if action_text and action_url:
            cta_button = f"""
            <div style="text-align: center; margin-top: 24px;">
              <a href="{action_url}" style="display: inline-block; background: #ea580c; color: white; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 800; font-size: 13px;">
                {action_text}
              </a>
            </div>
            """

        # An admin template's html_content is often already a full, self-wrapped
        # document (see seed_email_templates.py / the real automatic-dispatch
        # path in email_tasks.py, which sends EmailTemplate.html_content as-is).
        # Wrapping that again in _get_base_template produces a duplicated
        # logo/header/title nested inside itself. Only wrap bare fragments.
        already_wrapped = "<!doctype html" in content_html.strip().lower()[:200] or "<html" in content_html.lower()[:500]
        if already_wrapped:
            html_body = content_html
            if cta_button and cta_button not in html_body:
                html_body = html_body.replace("</body>", f"{cta_button}</body>") if "</body>" in html_body else html_body + cta_button
        else:
            content = f"""
            <div style="font-size: 15px; color: #475569; line-height: 1.6;">
              {content_html}
            </div>
            {cta_button}
            """
            html_body = self._get_base_template(
                title=title,
                subtitle=subtitle or "Direct communication from Suqafuran Support",
                content=content
            )
        return self._send_and_log(email, subject, html_body, f"crm_manual_{campaign_id or 'custom'}", user_id, campaign_id=campaign_id, preferred_provider="brevo")

    def check_verification_code(self, email: str, code: str) -> bool:
        from app.services.otp_log_service import otp_log
        email = email.strip().lower()
        self._ensure_redis()
        if not self.redis:
            if settings.ENVIRONMENT != "production":
                if code == "000000":
                    otp_log.record("verified", identifier=email, channel="email",
                                   meta={"mode": "development"})
                    return True
                otp_log.record("attempt_failed", identifier=email, channel="email",
                               meta={"mode": "development"})
                return False
            return False

        # Track attempt count
        attempt_key = f"otp_verify_attempts:{email}"
        attempt_count = int(self.redis.incr(attempt_key) if self.redis else 1)
        if self.redis:
            self.redis.expire(attempt_key, 600)

        # Burn the code after too many wrong guesses (see africastalking_service)
        if attempt_count > MAX_OTP_ATTEMPTS:
            if self.redis:
                self.redis.delete(f"otp:{email}")
            otp_log.record("attempt_failed", identifier=email, channel="email",
                           status="failed", attempt_count=attempt_count,
                           meta={"reason": "too_many_attempts"})
            return False

        stored = self._redis_get(f"otp:{email}")
        if stored and stored == code:
            self._redis_delete(f"otp:{email}")
            if self.redis:
                self.redis.delete(attempt_key)
            otp_log.record("verified", identifier=email, channel="email",
                           attempt_count=attempt_count)
            return True

        otp_log.record(
            "expired" if not stored else "attempt_failed",
            identifier=email,
            channel="email",
            status="failed",
            attempt_count=attempt_count,
        )
        return False

    def store_pending_signup(self, email: str, signup_data: dict) -> bool:
        email = email.strip().lower()
        if not self.redis:
            if settings.ENVIRONMENT != "production":
                # In dev without Redis, skip storage (OTP is 000000 anyway)
                return True
            return False
        return self._redis_set(f"signup:{email}", json.dumps(signup_data), ex=600)

    def get_pending_signup(self, email: str) -> Optional[dict]:
        email = email.strip().lower()
        data = self._redis_get(f"signup:{email}")
        return json.loads(data) if data else None

    def delete_pending_signup(self, email: str):
        email = email.strip().lower()
        self._redis_delete(f"signup:{email}")


email_service = EmailService()
