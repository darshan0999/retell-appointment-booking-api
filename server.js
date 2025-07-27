const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS configuration for production
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true
}));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Cal.com API configuration
const CALCOM_BASE_URL = process.env.CALCOM_BASE_URL || 'https://api.cal.com/v2';
const CALCOM_API_KEY = process.env.CALCOM_API_KEY;

// Validate required environment variables
if (!CALCOM_API_KEY) {
    console.error('❌ CALCOM_API_KEY environment variable is required');
    process.exit(1);
}

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Retell Cal.com Booking API is running!',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Health check for load balancers
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Main webhook endpoint
app.post('/webhook/retell-function', async (req, res) => {
    try {
        console.log('Received function call:', JSON.stringify(req.body, null, 2));

        const data = req.body;

        if (!data) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request: data is required'
            }); 
        }

        const result = await bookCalcomAppointment(data);
        res.json({
            success: true,
            result: result
        });
    } catch (error) {
        console.error('Error processing function call:', error);
        res.status(500).json({
            success: false,
            // error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
            error: error.message
        });
    }
});

async function bookCalcomAppointment(params) {
    console.log('Booking appointment with params:', JSON.stringify(params, null, 2));

    // Validate required parameters
    const { start, name, phone } = params;
    
    // if (!start || !name || !phone) {
    //     throw new Error('Missing required parameters: start, name, and phone are required');
    // }

    if (!start) {
        throw new Error('Missing required parameters: start are required');
    }
    if (!name) {
        throw new Error('Missing required parameters: name are required');
    }
    if (!phone) {
        throw new Error('Missing required parameters: phone are required');
    }

    // Prepare booking data
    const bookingData = {
        start: start,
        attendee: {
            name: name,
            phoneNumber: phone,
            timeZone: process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
            language: 'en'
        },
        eventTypeId: parseInt(process.env.CALCOM_EVENT_TYPE_ID) || 2905891,
        eventTypeSlug: process.env.CALCOM_EVENT_TYPE_SLUG || 'setup'
    };

    try {
        console.log('Sending booking request to Cal.com:', JSON.stringify(bookingData, null, 2));

        const response = await axios.post(
            `${CALCOM_BASE_URL}/bookings`,
            bookingData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'cal-api-version': process.env.CALCOM_API_VERSION || '2024-08-13'
                },
                timeout: 30000 // 30 second timeout
            }
        );

        console.log('Cal.com booking successful:', JSON.stringify(response.data, null, 2));

        return {
            success: true,
            bookingId: response.data.id,
            message: `Appointment booked successfully for ${name} on ${start}`,
            bookingReference: response.data.uid
        };

    } catch (error) {
        console.error('Cal.com booking error:', error.response?.data || error.message);
        
        // Don't expose sensitive API errors in production
        // const errorMessage = process.env.NODE_ENV === 'production' 
        //     ? 'Booking failed. Please try again later.'
        //     : `Cal.com booking failed: ${error.response?.data?.message || error.message}`;
            
        const errorMessage = `Cal.com booking failed: ${error.response?.data?.message || error.message}`;
            
        throw new Error(errorMessage);
    }
}

// Handle 404 routes
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}`);
    console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/webhook/retell-function`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;