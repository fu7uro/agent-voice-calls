# Quick Start Guide - 20 Minutes to Production

## For Your Dev Team

This guide gets the Agent Voice Calls platform deployed and ready for 11Labs integration in 20 minutes.

---

## Prerequisites Checklist

Get these ready before starting:
- [ ] Cloudflare account (free tier works)
- [ ] Twilio Account SID
- [ ] Twilio Auth Token  
- [ ] Twilio Phone Number (e.g., +15555550100)
- [ ] Google Places API Key

**Don't have these? See DEPLOYMENT.md for how to get them.**

---

## Step-by-Step (20 minutes)

### 1. Clone Repository (1 min)
```bash
git clone https://github.com/fu7uro/agent-voice-calls.git
cd agent-voice-calls
npm install
```

### 2. Authenticate with Cloudflare (1 min)
```bash
npx wrangler login
```
Opens browser → Login to Cloudflare → Authorize

### 3. Create Database (2 min)
```bash
npx wrangler d1 create agent-voice-calls-db
```
**Copy the `database_id` from output!**

Edit `wrangler.jsonc`:
```jsonc
"database_id": "paste-your-id-here"
```

### 4. Run Migrations (1 min)
```bash
npm run db:migrate:prod
```

### 5. Build Project (2 min)
```bash
npm run build
```

### 6. Create Cloudflare Pages Project (1 min)
```bash
npx wrangler pages project create agent-voice-calls --production-branch main
```

### 7. Add Secrets (5 min)
```bash
# Twilio Account SID
npx wrangler pages secret put TWILIO_ACCOUNT_SID --project-name agent-voice-calls
# Paste: AC1234567890abcdef... [ENTER]

# Twilio Auth Token
npx wrangler pages secret put TWILIO_AUTH_TOKEN --project-name agent-voice-calls
# Paste: your_auth_token [ENTER]

# Twilio Phone Number
npx wrangler pages secret put TWILIO_PHONE_NUMBER --project-name agent-voice-calls
# Type: +15555550100 [ENTER]

# Google Places API Key
npx wrangler pages secret put GOOGLE_PLACES_API_KEY --project-name agent-voice-calls
# Paste: AIza... [ENTER]
```

### 8. Deploy (2 min)
```bash
npm run deploy
```

**Output shows your URL:**
```
✨ Deployment complete!
https://agent-voice-calls.pages.dev
```

### 9. Test Deployment (1 min)
```bash
curl https://agent-voice-calls.pages.dev/api/health
```

**Expected response:**
```json
{
  "status": "ok",
  "service": "agent-voice-calls",
  "version": "1.0.0"
}
```

✅ **API is live!**

### 10. Configure 11Labs (5 min)

Go to your 11Labs dashboard and add these tools:

#### Tool 1: Restaurant Booking
- **Name:** `book_restaurant_reservation`
- **URL:** `https://agent-voice-calls.pages.dev/api/call/book-restaurant`
- **Method:** POST
- **Use dynamic variable:** `{{agent.phone_number}}`

#### Tool 2: Generic Calls
- **Name:** `make_outbound_call`
- **URL:** `https://agent-voice-calls.pages.dev/api/call/make-call`
- **Method:** POST
- **Use dynamic variable:** `{{agent.phone_number}}`

See README.md for full parameter schemas.

---

## Test Your First Call

```bash
curl -X POST https://agent-voice-calls.pages.dev/api/call/book-restaurant \
  -H "Content-Type: application/json" \
  -d '{
    "caller_phone_number": "+15555550100",
    "restaurant_name": "Local Restaurant",
    "location": "Your City, State",
    "reservation": {
      "date": "2025-12-15",
      "time": "19:00",
      "party_size": 2
    },
    "client": {
      "name": "Test User",
      "callback_number": "+15555551234"
    }
  }'
```

**Response includes:**
```json
{
  "success": true,
  "data": {
    "call_sid": "CA...",
    "status": "initiated"
  }
}
```

Check status:
```bash
curl https://agent-voice-calls.pages.dev/api/call/status/CA...
```

---

## Common Issues

**"Database not found"**
→ Check `database_id` in wrangler.jsonc

**"Twilio authentication failed"**
→ Verify secrets: `npx wrangler pages secret list --project-name agent-voice-calls`

**"Cannot find restaurant"**
→ Try providing phone_number directly instead of using Google Places

**Call fails immediately**
→ Check Twilio account balance and phone number verification

---

## What's Next?

✅ API is deployed and running  
✅ Database is set up  
✅ Ready for 11Labs integration  

**Now your agents can make phone calls!**

Test with your personal assistant agents and see them:
- Book restaurant reservations
- Notify clients of changes
- Follow up on meetings
- Make any custom calls

---

## Need Help?

- **Full docs:** README.md
- **Detailed deployment:** DEPLOYMENT.md
- **API reference:** https://agent-voice-calls.pages.dev/api/docs
- **Call logs:** https://agent-voice-calls.pages.dev/api/calls/history
- **Analytics:** https://agent-voice-calls.pages.dev/api/calls/analytics

---

## Repository
https://github.com/fu7uro/agent-voice-calls

**You're all set! 🚀**
