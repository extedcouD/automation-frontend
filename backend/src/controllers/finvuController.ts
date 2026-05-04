import { Request, Response, RequestHandler } from 'express';
import axios from 'axios';
import { RedisService } from 'ondc-automation-cache-lib';
import logger from '@ondc/automation-logger';

const FINVU_SERVICE_URL = process.env.FINVU_SERVICE_URL;

/**
 * Proxy endpoint to verify consent with Finvu AA Service
 * Calls the automation-finvu-aa-service internally
 */
export const verifyConsent: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { sessionId, transactionId } = req.body;

    logger.info('Verify consent request received', {
      sessionId,
      transactionId
    });

    // Validate required parameters
    if (!transactionId && !sessionId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Either transactionId or sessionId is required'
      });
      return;
    }

    // Get session data from Redis to extract consent handler and customer ID
    const sessionKey = transactionId || sessionId;
    let sessionData = null;

    try {
      const rawSessionData = await RedisService.getKey(sessionKey);
      const sessionDataKey = await RedisService.getKey(sessionId)
      if (rawSessionData) {
        sessionData = JSON.parse(rawSessionData);
        logger.info('Session data retrieved for consent verification from transaction_id', {
          sessionKey,
          hasConsentHandler: !!sessionData?.consentHandler,
          hasCustomerId: !!sessionData?.customer_id,
          sessionData: sessionData
        });
      }

      if (sessionDataKey) {
        sessionData = JSON.parse(sessionDataKey);
        logger.info('Session data retrieved for session key', {
          sessionKey,
          hasConsentHandler: !!sessionData?.consentHandler,
          hasCustomerId: !!sessionData?.customer_id,
          sessionData: sessionData,
        });

        /**FETCH MOKE DATA USING SESSION ID Start*/
        const subUrl = sessionData?.subscriberUrl;
        logger.info('ubscriberUrl extracted from ui-session-data', { subUrl });

        if (subUrl) {
          const resolvedKey = `MOCK_DATA::${transactionId}::${subUrl}`;
          logger.info('Resolved composite Redis key', { resolvedKey });
          let mockSessionDataKey = await RedisService.getKey(resolvedKey);
          if (mockSessionDataKey) {
            const mockSessionData = JSON.parse(mockSessionDataKey);
            logger.info('Session data fetched', {
              resolvedKey,
              hasConsentHandler: !!sessionData?.consentHandler,
              hasCustomerId: !!sessionData?.customer_id,
              sessionData: mockSessionData,
            });
          }

        } else {
          logger.info('subscriberUrl not found — using bare transactionId');
        }
        /**FETCH MOKE DATA USING SESSION ID Start END*/
      }
    } catch (error: any) {
      logger.info('Failed to retrieve session data', {
        sessionKey,
        error: error.message
      });
    }

    // Call the Finvu AA Service
    try {
      logger.info('Calling Finvu AA Service', {
        url: `${FINVU_SERVICE_URL}/finvu-aa/consent/verify`,
        transactionId
      });

      const finvuResponse = await axios.post(
        `${FINVU_SERVICE_URL}/finvu-aa/consent/verify`,
        {
          transactionId,
          sessionId
        },
        {
          timeout: 15000, // 15 second timeout
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': req.correlationId || 'unknown'
          }
        }
      );

      logger.info('Finvu AA Service response received', {
        hasUrl: !!finvuResponse.data?.url,
        status: finvuResponse.status,
        url: finvuResponse.data?.url
      });

      // Return the Finvu URL to frontend
      res.status(200).json({
        success: true,
        url: finvuResponse.data.url,
        encryptedRequest: finvuResponse.data.encryptedRequest,
        requestDate: finvuResponse.data.requestDate,
        encryptedFiuId: finvuResponse.data.encryptedFiuId
      });

    } catch (finvuError: any) {
      logger.error('Finvu AA Service call failed', {
        error: finvuError.message,
        response: finvuError.response?.data,
        status: finvuError.response?.status
      });

      // Handle specific error scenarios
      if (finvuError.code === 'ECONNREFUSED') {
        res.status(503).json({
          error: 'Service Unavailable',
          message: 'Finvu AA Service is not available. Please try again later.',
          details: 'Could not connect to Finvu service'
        });
        return;
      }

      if (finvuError.code === 'ETIMEDOUT') {
        res.status(504).json({
          error: 'Gateway Timeout',
          message: 'Finvu AA Service request timed out. Please try again.',
          details: 'Request to Finvu service timed out'
        });
        return;
      }

      // Return the error from Finvu service
      res.status(finvuError.response?.status || 500).json({
        error: 'Finvu Verification Failed',
        message: finvuError.response?.data?.message || finvuError.message || 'Failed to verify consent with Finvu',
        details: finvuError.response?.data
      });
    }

  } catch (error: any) {
    logger.error('Unexpected error in verify consent', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while processing your request',
      details: error.message
    });
  }
};

/**
 * Generate consent handler with Finvu AA Service
 * Calls the automation-finvu-aa-service internally
 */
export const generateConsent: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { custId, templateName, fiTypes, consentDescription, redirectUrl } = req.body;

    logger.info('Generate consent request received', {
      custId,
      templateName
    });

    // Validate required parameters
    if (!custId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'custId is required'
      });
      return;
    }

    try {
      logger.info('Calling Finvu AA Service for consent generation', {
        url: `${FINVU_SERVICE_URL}/finvu-aa/consent/generate`,
        custId
      });

      const finvuResponse = await axios.post(
        `${FINVU_SERVICE_URL}/finvu-aa/consent/generate`,
        {
          custId,
          templateName,
          fiTypes,
          consentDescription,
          redirectUrl
        },
        {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': req.correlationId || 'unknown'
          }
        }
      );

      logger.info('Finvu consent generated successfully', {
        consentHandler: finvuResponse.data.consentHandler
      });

      res.status(200).json({
        success: true,
        ...finvuResponse.data
      });

    } catch (finvuError: any) {
      logger.error('Finvu AA Service consent generation failed', {
        error: finvuError.message,
        response: finvuError.response?.data
      });

      res.status(finvuError.response?.status || 500).json({
        error: 'Consent Generation Failed',
        message: finvuError.response?.data?.message || finvuError.message || 'Failed to generate consent',
        details: finvuError.response?.data
      });
    }

  } catch (error: any) {
    logger.error('Unexpected error in generate consent', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while processing your request',
      details: error.message
    });
  }
};

/**
 * Check Finvu AA Service health
 */
export const checkFinvuServiceHealth: RequestHandler = async (req: Request, res: Response) => {
  try {
    const healthResponse = await axios.get(
      `${FINVU_SERVICE_URL}/finvu-aa/health`,
      { timeout: 5000 }
    );

    res.status(200).json({
      finvuService: {
        status: 'OK',
        url: FINVU_SERVICE_URL,
        ...healthResponse.data
      }
    });
  } catch (error: any) {
    logger.error('Finvu service health check failed', { error: error.message });
    res.status(503).json({
      finvuService: {
        status: 'UNHEALTHY',
        url: FINVU_SERVICE_URL,
        error: error.message
      }
    });
  }
};

/**
 * Finvu redirects here when user completes the consent
 * This endpoint is called BY FINVU, not by your frontend
 */
export const handleFinvuCallback: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { session_id, transaction_id, ecreq, status } = req.query;

    logger.info('Finvu callback received', {
      session_id,
      transaction_id,
      hasEcreq: !!ecreq,
      status
    });

    if (!session_id || !transaction_id) {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #dc2626; }
          </style>
        </head>
        <body>
          <h1>Error</h1>
          <p>Missing session_id or transaction_id</p>
        </body>
        </html>
      `);
      return;
    }

    // Set completion flag in Redis (expires in 1 hour)
    const completionKey = `finvu_completed:${transaction_id}`;
    await RedisService.setKey(completionKey, JSON.stringify({
      completed: true,
      timestamp: new Date().toISOString(),
      ecreq: ecreq || null,
      status: status || 'success'
    }), 3600);

    logger.info('Finvu completion flag set in Redis', {
      transaction_id,
      key: completionKey
    });


    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Finvu Verification Complete</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            text-align: center;
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            max-width: 400px;
          }
          .success-icon {
            font-size: 60px;
            color: #10b981;
            margin-bottom: 20px;
            animation: scaleIn 0.5s ease-out;
          }
          @keyframes scaleIn {
            from { transform: scale(0); }
            to { transform: scale(1); }
          }
          h1 {
            color: #1f2937;
            margin-bottom: 10px;
            font-size: 24px;
          }
          p {
            color: #6b7280;
            margin-bottom: 20px;
            line-height: 1.5;
          }
          .close-info {
            color: #9ca3af;
            font-size: 14px;
          }
          .countdown {
            font-weight: bold;
            color: #667eea;
          }
        </style>
        <script>
          let countdown = 3;
          function updateCountdown() {
            const elem = document.getElementById('countdown');
            if (elem) {
              elem.textContent = countdown;
            }
            if (countdown > 0) {
              countdown--;
              setTimeout(updateCountdown, 1000);
            } else {
              window.close();
            }
          }
          window.onload = updateCountdown;
        </script>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✓</div>
          <h1>Verification Complete!</h1>
          <p>Your Account Aggregator consent has been successfully verified.</p>
          <p class="close-info">
            This window will close automatically in 
            <span class="countdown" id="countdown">3</span> seconds...
          </p>
        </div>
      </body>
      </html>
    `);

  } catch (error: any) {
    logger.error('Error in Finvu callback', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            background-color: #f3f4f6;
          }
          .error-container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            max-width: 400px;
            margin: 0 auto;
          }
          h1 { color: #dc2626; }
          p { color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>Error</h1>
          <p>Error processing verification: ${error.message}</p>
          <p>You can close this window.</p>
        </div>
      </body>
      </html>
    `);
  }
};

/**
 * Check if Finvu callback has been received
 * This endpoint is polled by the frontend
 */
export const checkFinvuCompletion: RequestHandler = async (req: Request, res: Response) => {
  try {
    const { session_id, transaction_id } = req.query;
    logger.info('Finvu completion check', {
      session_id,
      transaction_id
    });
    if (!session_id || !transaction_id) {
      res.status(400).json({
        error: 'session_id and transaction_id are required',
        completed: false
      });
      return;
    }

    // Check Redis for completion flag
    const completionKey = `finvu_completed:${transaction_id}`;
    const completionData = await RedisService.getKey(completionKey);

    if (completionData) {
      const data = JSON.parse(completionData);
      logger.info('Finvu completion check: COMPLETED', {
        transaction_id,
        timestamp: data.timestamp
      });

      res.json({
        completed: true,
        timestamp: data.timestamp,
        status: data.status
      });
      return;
    }

    logger.debug('Finvu completion check: PENDING', { transaction_id });
    res.json({
      completed: false
    });

  } catch (error: any) {
    logger.error('Error checking Finvu completion', error);
    res.status(500).json({
      error: 'Failed to check completion',
      message: error.message,
      completed: false
    });
  }
};

