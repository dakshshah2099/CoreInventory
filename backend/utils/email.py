import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from dotenv import load_dotenv

# Configure logging to print OTPs if SMTP is missing
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def send_otp_email(to_email: str, otp: str, purpose: str = "Verification"):
    load_dotenv(override=True)
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT", 587)
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from_email = os.getenv("SMTP_FROM_EMAIL", "noreply@coreinventory.com")

    # If no SMTP configuring exists, fallback to printing to console for local testing
    if not smtp_server or not smtp_username or not smtp_password:
        logger.info("=" * 50)
        logger.info(f"MOCK EMAIL DISPATCHED TO: {to_email}")
        logger.info(f"PURPOSE: {purpose}")
        logger.info(f"YOUR OTP IS: {otp}")
        logger.info("=" * 50)
        return True

    try:
        msg = MIMEMultipart()
        msg['From'] = smtp_from_email
        msg['To'] = to_email
        msg['Subject'] = f"{purpose} OTP - CoreInventory"

        body = f"""
        Hello,
        
        Your One-Time Password (OTP) for {purpose} is: {otp}
        
        This OTP is valid for 10 minutes. Please do not share this with anyone.
        
        Regards,
        CoreInventory Team
        """
        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP(smtp_server, int(smtp_port))
        server.starttls()
        server.login(smtp_username, smtp_password)
        text = msg.as_string()
        server.sendmail(smtp_from_email, to_email, text)
        server.quit()
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        # Even if it fails, for the sake of development returning False might block user testing
        # But we should log it.
        return False
