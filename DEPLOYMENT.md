# Deployment Guide - Agent Voice Calls

## Quick Start for Futuro Team

### Prerequisites
- Cloudflare account with Workers/Pages enabled
- Twilio account with phone number provisioned
- Google Cloud account with Places API enabled
- Wrangler CLI installed (`npm install -g wrangler`)

---

## Step 1: Clone and Install

```bash
git clone https://github.com/fu7uro/agent-voice-calls.git
cd agent-voice-calls
npm install
```

---

## Step 2: Create Cloudflare D1 Database

```bash
# Authenticate with Cloudflare (if not already done)
npx wrangler login

# Create the production database
npx wrangler d1 create agent-voice-calls-db
```

**Output will look like:**
```
✅ Successfully created DB 'agent-voice-calls-db'!

[[d1_databases]]
binding = "DB"
database_name = "agent-voice-calls-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**IMPORTANT:** Copy the `database_id` value!

---

## Step 3: Update wrangler.jsonc

Open `wrangler.jsonc` and replace `"your-database-id"` with the actual database ID from Step 2:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "agent-voice-calls-db",
    "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  // ← Replace this
  }
]
```

---

## Step 4: Run Database Migrations

```bash
# Apply migrations to production database
npm run db:migrate:prod
```

You should see: `✅ Migrations applied successfully`

---

## Step 5: Build the Project

```bash
npm run build
```

This creates the `dist/` directory with compiled code.

---

## Step 6: Create Cloudflare Pages Project

```bash
npx wrangler pages project create agent-voice-calls --production-branch main
```

---

## Step 7: Add Production Secrets

**These are REQUIRED for production. Never commit these to git!**

### Twilio Credentials

```bash
# Twilio Account SID (looks like: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)
npx wrangler pages secret put TWILIO_ACCOUNT_SID --project-name agent-voice-calls

# Twilio Auth Token (looks like: your_auth_token_here)
npx wrangler pages secret put TWILIO_AUTH_TOKEN --project-name agent-voice-calls

# Twilio Phone Number (format: +15555550100)
npx wrangler pages secret put TWILIO_PHONE_NUMBER --project-name agent-voice-calls
```

### Google Places API Key

```bash
# Google Places API Key (looks like: AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX)
npx wrangler pages secret put GOOGLE_PLACES_API_KEY --project-name agent-voice-calls
```

---

## Step 8: Deploy to Production

```bash
npm run deploy
```

**Output will show:**
```
✨ Deployment complete! Take a peek over at
  https://agent-voice-calls.pages.dev
```

**Your API is now live!** 🎉

---

## Step 9: Test Production Deployment

```bash
# Test health check
curl https://agent-voice-calls.pages.dev/api/health

# Test API documentation
curl https://agent-voice-calls.pages.dev/api/docs
```

Expected response:
```json
{
  "status": "ok",
  "service": "agent-voice-calls",
  "version": "1.0.0",
  "environment": "production"
}
```

---

## Step 10: Configure 11Labs Tools

### Restaurant Booking Tool Configuration

In your 11Labs dashboard, create a new tool:

**Tool Name:** `book_restaurant_reservation`

**Description:** `Call a restaurant to make a reservation on behalf of the client`

**Endpoint:** `https://agent-voice-calls.pages.dev/api/call/book-restaurant`

**Method:** `POST`

**Parameters Schema:**
```json
{
  "caller_phone_number": "{{agent.phone_number}}",
  "restaurant_name": "{extracted from conversation}",
  "location": "{extracted from conversation}",
  "reservation": {
    "date": "{extracted from conversation}",
    "time": "{extracted from conversation}",
    "party_size": "{extracted from conversation}",
    "special_requests": "{extracted from conversation}"
  },
  "client": {
    "name": "{extracted from conversation}",
    "callback_number": "{extracted from conversation}"
  }
}
```

### Generic Call Tool Configuration

**Tool Name:** `make_outbound_call`

**Description:** `Make an outbound phone call to notify someone or deliver a message`

**Endpoint:** `https://agent-voice-calls.pages.dev/api/call/make-call`

**Method:** `POST`

**Parameters Schema:**
```json
{
  "caller_phone_number": "{{agent.phone_number}}",
  "recipient": {
    "name": "{extracted from conversation}",
    "phone_number": "{extracted from conversation}"
  },
  "call_purpose": "notify_client",
  "conversation_context": {
    "caller_name": "{extracted from conversation}",
    "company": "Futuro Corporation",
    "message": "{extracted from conversation}",
    "callback_number": "{extracted from conversation}"
  }
}
```

---

## Verification Checklist

- [ ] Database created and migrated
- [ ] wrangler.jsonc updated with correct database_id
- [ ] All secrets added (Twilio + Google)
- [ ] Project deployed successfully
- [ ] Health check returns 200 OK
- [ ] 11Labs tools configured with production URL
- [ ] Test call made successfully

---

## Updating the Code

When you make changes:

```bash
# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Build
npm run build

# Deploy
npm run deploy
```

---

## Monitoring & Logs

### View Deployment Logs
```bash
npx wrangler pages deployment tail --project-name agent-voice-calls
```

### Query Call Logs
```bash
# View recent calls
curl https://agent-voice-calls.pages.dev/api/calls/history?limit=10

# View analytics
curl https://agent-voice-calls.pages.dev/api/calls/analytics
```

### Check D1 Database
```bash
# Query database directly
npx wrangler d1 execute agent-voice-calls-db --command="SELECT * FROM call_logs ORDER BY created_at DESC LIMIT 10"
```

---

## Troubleshooting

### "Database not found" error
- Verify `database_id` in wrangler.jsonc is correct
- Check database exists: `npx wrangler d1 list`

### "Twilio authentication failed"
- Verify secrets are set: `npx wrangler pages secret list --project-name agent-voice-calls`
- Re-add secrets if needed

### "Cannot find restaurant"
- Verify Google Places API key is valid
- Check API is enabled in Google Cloud Console
- Ensure billing is enabled on Google Cloud account

### Call not initiating
- Check Twilio account balance
- Verify phone number is verified in Twilio (if on trial)
- Check phone number format is E.164 (+15555551234)

---

## Cost Estimates

**Monthly costs (based on 1,000 calls):**
- Cloudflare Workers: $0 (within free tier)
- Cloudflare D1: $0 (within free tier)
- Twilio calls: ~$60-150 (2-3 min avg @ $0.02-0.05/min)
- Google Places API: $0 (within free tier)

**Total: ~$60-150/month for 1,000 calls**

---

## Security Notes

✅ All API keys stored as encrypted Cloudflare secrets  
✅ No credentials in code or git repository  
✅ CORS properly configured  
✅ Phone number validation on all endpoints  
✅ Call logs stored in private D1 database  

---

## Support Contacts

**Technical Issues:** Futuro Corporation Dev Team  
**Cloudflare Support:** https://dash.cloudflare.com/  
**Twilio Support:** https://www.twilio.com/console  

---

**Last Updated:** December 2024  
**Version:** 1.0.0
