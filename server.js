const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Cal.com API configuration
const CALCOM_BASE_URL = 'https://api.cal.com/v2';

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Retell Cal.com Booking API is running!',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.post('/webhook/retell-function', async (req, res) => {
  try {
    console.log('Received function call:', req.body);
    
    const { function_call } = req.body;
    
    if (function_call.name === 'book_calcom_appointment_custom') {
      const result = await bookCalcomAppointment(function_call.arguments);
      
      res.json({
        success: true,
        result: result
      });
    } else {
      res.status(400).json({
        success: false,
        error: `Unknown function: ${function_call.name}`
      });
    }
  } catch (error) {
    console.error('Error processing function call:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

async function bookCalcomAppointment(params) {
  console.log('Booking appointment with params:', params);
  
  const {
    start,
    name,
    phone,
  } = params;

  // Prepare booking data matching your Cal.com event type requirements
  const bookingData = {
    start: start,
    attendee: {
      name: name,
      phoneNumber: phone,
      timeZone: 'Asia/Kolkata',
      language: 'en'
    },
    eventTypeId: 2905891,
    eventTypeSlug: advanced
  };

  try {
    console.log('Sending booking request to Cal.com:', bookingData);
    
    const response = await axios.post(
      `${CALCOM_BASE_URL}/bookings`,
      bookingData,
      {
        // headers: {
        //   'Authorization': `Bearer ${CALCOM_API_KEY}`,
        //   'Content-Type': 'application/json'
        // }
        headers: {
          'Content-Type': 'application/json',
          'cal-api-version': `2024-08-13`
        }
      }
    );

    console.log('Cal.com booking successful:', response.data);

    return {
      success: true,
      bookingId: response.data.id,
      message: `Appointment booked successfully for ${name} on ${start}`,
      bookingReference: response.data.uid
    };

  } catch (error) {
    console.error('Cal.com booking error:', error.response?.data || error.message);
    throw new Error(`Cal.com booking failed: ${error.response?.data?.message || error.message}`);
  }
}

// Start the server - THIS WAS MISSING!
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}`);
  console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/webhook/retell-function`);
});