import express from 'express';
import nodemailer from 'nodemailer';
import { logger } from '../services/LoggerService';
import { validateContactForm } from '../middleware/auth';

const router = express.Router();

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Send contact form email
router.post('/', validateContactForm, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    const transporter = createTransporter();

    // Email content
    const mailOptions = {
      from: process.env.MAIL_FROM,
      to: process.env.MAIL_TO,
      subject: `8BP Rewards - ${subject || 'Contact Form'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
            8 Ball Pool Rewards - Contact Form Submission
          </h2>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #495057; margin-top: 0;">Contact Details</h3>
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Subject:</strong> ${subject || 'No subject provided'}</p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 20px; border: 1px solid #dee2e6; border-radius: 5px;">
            <h3 style="color: #495057; margin-top: 0;">Message</h3>
            <p style="line-height: 1.6; color: #333;">${message.replace(/\n/g, '<br>')}</p>
          </div>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 5px; font-size: 12px; color: #6c757d;">
            <p>This email was sent from the 8 Ball Pool Rewards contact form.</p>
            <p>Reply directly to this email to respond to ${name}.</p>
          </div>
        </div>
      `,
      text: `
        8 Ball Pool Rewards - Contact Form Submission
        
        Name: ${name}
        Email: ${email}
        Subject: ${subject || 'No subject provided'}
        Submitted: ${new Date().toLocaleString()}
        
        Message:
        ${message}
        
        ---
        This email was sent from the 8 Ball Pool Rewards contact form.
        Reply directly to this email to respond to ${name}.
      `
    };

    // Send email to admin
    const info = await transporter.sendMail(mailOptions);
    
    logger.info('Contact form email sent to admin', {
      action: 'contact_form_admin_email',
      name,
      email,
      messageId: info.messageId
    });

    // Send confirmation email to user
    const confirmationMailOptions = {
      from: process.env.MAIL_FROM,
      to: email,
      subject: '8BP Rewards - We Received Your Message',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
            Thank You for Contacting Us!
          </h2>
          
          <p style="color: #495057; line-height: 1.6;">
            Hi ${name},
          </p>
          
          <p style="color: #495057; line-height: 1.6;">
            We've received your message and will get back to you as soon as possible. 
            Our team typically responds within 24-48 hours.
          </p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #495057; margin-top: 0;">Subject</h3>
            <p style="line-height: 1.6; color: #333;"><strong>${subject || 'No subject'}</strong></p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #495057; margin-top: 0;">Your Message</h3>
            <p style="line-height: 1.6; color: #333;">${message.replace(/\n/g, '<br>')}</p>
          </div>
          
          <p style="color: #495057; line-height: 1.6;">
            If you have any urgent concerns, you can also reach us via Discord or our website.
          </p>
          
          <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 5px;">
            <p style="margin: 0; color: #6c757d; font-size: 14px;">
              <strong>8 Ball Pool Rewards System</strong><br>
              Website: <a href="${process.env.PUBLIC_URL || 'https://8bp.epildevconnect.uk/8bp-rewards'}">${process.env.PUBLIC_URL || 'https://8bp.epildevconnect.uk/8bp-rewards'}</a>
            </p>
          </div>
        </div>
      `,
      text: `
        Thank You for Contacting Us!
        
        Hi ${name},
        
        We've received your message and will get back to you as soon as possible.
        Our team typically responds within 24-48 hours.
        
        Subject:
        ${subject || 'No subject provided'}
        
        Your Message:
        ${message}
        
        ---
        8 Ball Pool Rewards System
        Website: ${process.env.PUBLIC_URL || 'https://8bp.epildevconnect.uk/8bp-rewards'}
      `
    };

    await transporter.sendMail(confirmationMailOptions);
    
    logger.logEmailSent(email, mailOptions.subject, true);
    logger.info('Contact form confirmation sent to user', {
      action: 'contact_form_confirmation',
      name,
      email
    });

    res.json({
      message: 'Thank you for your message! We will get back to you soon.',
      success: true
    });

  } catch (error) {
    logger.logEmailSent(req.body.email, 'Contact Form', false);
    logger.error('Contact form submission failed', {
      action: 'contact_form_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      name: req.body.name,
      email: req.body.email,
      ip: req.ip
    });

    res.status(500).json({
      error: 'Failed to send message. Please try again later.',
      success: false
    });
  }
});

// Test email configuration (admin only)
router.post('/test', async (req, res) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.MAIL_FROM,
      to: process.env.MAIL_TO,
      subject: '8BP Rewards - Email Configuration Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">✅ Email Configuration Test Successful</h2>
          <p>This is a test email to verify that the email configuration is working correctly.</p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
        </div>
      `,
      text: `
        Email Configuration Test Successful
        
        This is a test email to verify that the email configuration is working correctly.
        
        Timestamp: ${new Date().toLocaleString()}
        Environment: ${process.env.NODE_ENV || 'development'}
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    logger.info('Email configuration test successful', {
      action: 'email_test_success',
      messageId: info.messageId
    });

    res.json({
      message: 'Email configuration test successful',
      success: true,
      messageId: info.messageId
    });

  } catch (error) {
    logger.error('Email configuration test failed', {
      action: 'email_test_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      error: 'Email configuration test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      success: false
    });
  }
});

export default router;

