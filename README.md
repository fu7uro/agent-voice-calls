# Agent Voice Calls

AI agent outbound calling platform for restaurant bookings and generic voice calls via Twilio integration.

## Overview

This tool enables your AI agents to make phone calls on behalf of clients for:
- **Restaurant reservations** - Call restaurants to book tables
- **Client notifications** - Notify clients about updates, changes, or new information
- **Colleague notifications** - Call colleagues with messages or reminders
- **Follow-ups** - Make follow-up calls after meetings or events
- **Custom calls** - Any generic outbound call with custom messaging

## Features

✅ **Restaurant Booking** - Automatically find restaurant phone numbers and make reservation calls  
✅ **Generic Outbound Calls** - Flexible calling for any purpose with custom messaging  
✅ **11Labs Integration** - Dynamic phone number variable support ({{agent.phone_number}})  
✅ **Call Tracking** - D1 database logging of all calls with status, transcripts, and outcomes  
✅ **Analytics** - Track call success rates, duration, and costs  
✅ **Demo Mode** - Test with dummy credentials before adding real API keys  

## Tech Stack

- **Framework**: Hono (lightweight, fast)
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Voice**: Twilio Programmable Voice
- **Places**: Google Places API
- **Language**: TypeScript

## Project Structure

```
agent-voice-calls/
├── src/
│   ├── index.ts              # Main Hono application
│   ├── routes/
│   │   ├── restaurant.ts     # Restaurant booking endpoint
│   │   ├── generic-call.ts   # Generic call endpoint
│   │   └── call-status.ts    # Twilio webhooks
│   ├── services/
│   │   ├── twilio.ts         # Twilio integration
│   │   └── places.ts         # Google Places API
│   ├── types/
│   │   └── index.ts          # TypeScript definitions
│   └── utils/
│       └── prompts.ts        # Conversation templates
├── migrations/
│   └── 0001_initial_schema.sql # Database schema
├── public/                    # Static assets (if needed)
├── .dev.vars                  # Local environment variables (gitignored)
├── wrangler.jsonc            # Cloudflare configuration
├── package.json
└── README.md
```

## Setup Instructions

### 1. Clone and Install

```bash
git clone https://github.com/fu7uro/agent-voice-calls.git
cd agent-voice-calls
npm install
```

### 2. Create Cloudflare D1 Database

```bash
# Create production database
npx wrangler d1 create agent-voice-calls-db

# Copy the database_id from output
# Update wrangler.jsonc with the actual database_id
```

Update `wrangler.jsonc`:
```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "agent-voice-calls-db",
    "database_id": "YOUR_DATABASE_ID_HERE"  // Replace this
  }
]
```

### 3. Run Database Migrations

```bash
# For local development
npm run db:migrate:local

# For production (after deploying)
npm run db:migrate:prod
```

### 4. Add API Keys and Secrets

**For Local Development (.dev.vars):**
```bash
# Edit .dev.vars file with your real credentials
TWILIO_ACCOUNT_SID=AC1234567890abcdef...
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+15555550100
GOOGLE_PLACES_API_KEY=AIza...
```

**For Production (Cloudflare Secrets):**
```bash
npx wrangler pages secret put TWILIO_ACCOUNT_SID --project-name agent-voice-calls
# Enter your Twilio Account SID when prompted

npx wrangler pages secret put TWILIO_AUTH_TOKEN --project-name agent-voice-calls
# Enter your Twilio Auth Token when prompted

npx wrangler pages secret put TWILIO_PHONE_NUMBER --project-name agent-voice-calls
# Enter your Twilio phone number (e.g., +15555550100)

npx wrangler pages secret put GOOGLE_PLACES_API_KEY --project-name agent-voice-calls
# Enter your Google Places API key
```

### 5. Build and Deploy

```bash
# Build the project
npm run build

# Deploy to Cloudflare Pages
npm run deploy
```

Your API will be available at: `https://agent-voice-calls.pages.dev`

## API Endpoints

### Health Check
```bash
GET /api/health
```

### API Documentation
```bash
GET /api/docs
```

### Book Restaurant Reservation
```bash
POST /api/call/book-restaurant

Body:
{
  "caller_phone_number": "{{agent.phone_number}}",  // From 11Labs
  "restaurant_name": "Carbone",
  "location": "New York, NY",
  "reservation": {
    "date": "2025-12-14",
    "time": "20:00",
    "party_size": 2,
    "special_requests": "Window seat if possible"
  },
  "client": {
    "name": "John Smith",
    "callback_number": "+15555551234"
  }
}

Response:
{
  "success": true,
  "data": {
    "call_sid": "CA1234567890abcdef",
    "status": "initiated",
    "estimated_completion": "2-5 minutes"
  },
  "message": "Call initiated to Carbone..."
}
```

### Get Call Status
```bash
GET /api/call/status/:call_sid

Response:
{
  "success": true,
  "data": {
    "call_sid": "CA1234567890abcdef",
    "status": "completed",
    "duration": 183,
    "transcript": "...",
    "outcome": { ... }
  }
}
```

### Make Generic Call
```bash
POST /api/call/make-call

Body:
{
  "caller_phone_number": "{{agent.phone_number}}",
  "recipient": {
    "name": "Jane Doe",
    "phone_number": "+15555555678"
  },
  "call_purpose": "notify_client",
  "conversation_context": {
    "caller_name": "John Smith",
    "company": "Futuro Corporation",
    "message": "Calling to confirm tomorrow's meeting at 2pm",
    "callback_number": "+15555551234"
  }
}
```

### Get Call History
```bash
GET /api/calls/history?limit=50&offset=0&call_purpose=restaurant_booking
```

### Get Analytics
```bash
GET /api/calls/analytics
```

## 11Labs Tool Configuration

### Restaurant Booking Tool

```json
{
  "tool_name": "book_restaurant_reservation",
  "description": "Call a restaurant to make a reservation on behalf of the client",
  "endpoint": "https://agent-voice-calls.pages.dev/api/call/book-restaurant",
  "method": "POST",
  "parameters": {
    "caller_phone_number": "{{agent.phone_number}}",
    "restaurant_name": "{user_input}",
    "location": "{user_input}",
    "reservation": {
      "date": "{user_input}",
      "time": "{user_input}",
      "party_size": "{user_input}",
      "special_requests": "{user_input}"
    },
    "client": {
      "name": "{user_input}",
      "callback_number": "{user_input}"
    }
  }
}
```

### Generic Call Tool

```json
{
  "tool_name": "make_outbound_call",
  "description": "Make an outbound phone call to notify someone or deliver a message",
  "endpoint": "https://agent-voice-calls.pages.dev/api/call/make-call",
  "method": "POST",
  "parameters": {
    "caller_phone_number": "{{agent.phone_number}}",
    "recipient": {
      "name": "{user_input}",
      "phone_number": "{user_input}"
    },
    "call_purpose": "{user_input}",
    "conversation_context": {
      "caller_name": "{user_input}",
      "company": "{user_input}",
      "message": "{user_input}",
      "callback_number": "{user_input}"
    }
  }
}
```

## Testing Locally

### In Sandbox Environment

```bash
# Build first
npm run build

# Start with PM2
fuser -k 3000/tcp 2>/dev/null || true
pm2 start ecosystem.config.cjs

# Test health check
curl http://localhost:3000/api/health

# View logs
pm2 logs --nostream

# Stop service
pm2 delete agent-voice-calls
```

### Test with Demo Credentials

The project includes dummy credentials in `.dev.vars` for testing the API flow without making real calls. Responses will be mocked but the entire flow will work.

## Database Schema

### call_logs Table
- `id` - Auto-increment primary key
- `call_sid` - Twilio call SID (unique)
- `caller_phone_number` - Agent's phone number
- `recipient_phone_number` - Who was called
- `recipient_name` - Name of recipient
- `call_purpose` - Purpose of call
- `status` - Call status (initiated, completed, etc.)
- `outcome_type` - Type of outcome
- `outcome_details` - JSON with detailed outcome
- `duration_seconds` - Call duration
- `transcript` - Call transcript
- `cost` - Cost of call
- `created_at` - Timestamp
- `completed_at` - Completion timestamp

### call_analytics View
Aggregated analytics by call purpose:
- Total calls
- Completed calls
- Successful calls
- Average duration
- Total cost

## Cost Estimates

**Per Call Costs (Approximate):**
- Twilio outbound call: $0.02-0.05/minute
- Google Places API: Free (up to certain limits)
- Cloudflare Workers: $0.00 (generous free tier)

**Average restaurant booking call:** 2-3 minutes = $0.06-0.15 per call

## Production Checklist

- [ ] Create Cloudflare D1 database
- [ ] Update `wrangler.jsonc` with database_id
- [ ] Add Twilio credentials via `wrangler pages secret put`
- [ ] Add Google Places API key via `wrangler pages secret put`
- [ ] Run production database migrations
- [ ] Deploy to Cloudflare Pages
- [ ] Test endpoints with real credentials
- [ ] Configure 11Labs tools with production URL
- [ ] Set up monitoring/alerting (optional)

## Security Notes

- ✅ All API keys stored as Cloudflare secrets (encrypted)
- ✅ `.dev.vars` is gitignored (never committed)
- ✅ Phone numbers validated before calling
- ✅ CORS configured for API endpoints
- ✅ No sensitive data in logs

## Troubleshooting

**Call not initiating:**
- Check Twilio credentials are correct
- Verify phone numbers are in E.164 format (+15555551234)
- Check Twilio account has sufficient balance

**Restaurant not found:**
- Verify Google Places API key is valid
- Check restaurant name and location are accurate
- Try providing phone_number directly instead

**Database errors:**
- Ensure migrations have been run
- Verify database_id in wrangler.jsonc is correct
- Check D1 database exists in Cloudflare dashboard

## Support

For issues or questions:
1. Check `/api/docs` endpoint for API documentation
2. Review call logs in D1 database
3. Check Cloudflare Workers logs in dashboard
4. Contact Futuro Corporation development team

## License

UNLICENSED - Private use only for Futuro Corporation

---

**Built with ❤️ for Futuro Corporation's AI Agent Platform**
