# Doubtdoor: start here

You do not need coding experience. Follow the parts in order. Part 1 takes about 10 minutes.

**What you have:** a white-and-green web app where a student asks a doubt (text or photo), gets an instant AI answer, and if still stuck gets matched with a local tutor: online (with a free video room and chat), a home visit (a parent confirms with a link), or a 2-hour group slot. It also has a weekly plan (5 online days + 1 home visit, 10% off), session extension for extra payment, demo payments with receipts, AI session summaries, reviews that change tutor ratings, a progress page with weak topics, a tutor dashboard with earnings, tutor applications, and an admin page that approves new tutors.

It works **right away without any AI key** (demo mode). Adding a key makes the AI answer any question and read photos.

---

## Part 1: Run it on your laptop

1. Install **Node.js** (the "LTS" version) from https://nodejs.org. Click next through the installer.
2. Unzip the `doubtdoor` folder somewhere easy, like your Desktop.
3. Open a terminal **inside that folder**:
   - **Windows:** open the folder, click the address bar, type `cmd`, press Enter.
   - **Mac:** right-click the folder and choose "New Terminal at Folder".
4. Type these two commands, one at a time (press Enter after each):
   ```
   npm install
   npm start
   ```
5. Open your browser at **http://localhost:3000**. You should see Doubtdoor.

Try it: click **Try the demo student**, ask `How do I solve x^2 - 5x + 6 = 0?`, then click **Not yet, find me a tutor**, book a tutor, and open **My sessions**.

Other logins (top right, **Log in**): the **Tutor** tab lets you pick a demo tutor such as Ravi Teja; the **Admin** tab uses the passcode `doubtdoor-admin` (change it with `ADMIN_PASSCODE` in `.env` or on Render). Use **Become a tutor** to send an application, then approve it as admin.

New in this version: students sign up with name, age, school or college, class, one of three areas (Hanamkonda, Warangal, Kazipet) and a full address, with a Google Maps check and a "Pin my location" button (no Google key needed). Home visits need a tick box confirming a parent or guardian will be at home (compulsory under 18) on a page before payment. Payment can be UPI, card, net banking or **cash after class**; for cash, the student sees a compulsory-payment warning and the tutor confirms the cash on their dashboard.

Honest limits to tell the judges: payments are a demo (no real money), login has no passwords, and the "strict action" for unpaid cash is a warning in the app (there is no automatic blocking yet), and video calls use the free Jitsi service.

To stop the app, press `Ctrl + C` in the terminal.

---

## Part 2: Turn on the real AI (free key)

An **API key** is like a password that lets your app talk to an AI model.

1. Go to https://aistudio.google.com/apikey and sign in with a Google account.
2. Create an API key and copy it.
3. In the `doubtdoor` folder, find the file `.env.example`. Make a copy and name it exactly `.env`.
4. Open `.env` in Notepad and replace `paste-your-key-here` with your key. Save.
5. Stop the app (`Ctrl + C`) and run `npm start` again.

The footer will change from **AI is in demo mode** to **AI answers are live**.

Notes:
- Google's free plan has usage limits, so avoid spamming it right before your demo.
- Never share your key, and never upload the `.env` file to GitHub. (The included `.gitignore` already protects it.)
- If the AI ever fails during the demo (no internet, limit reached), the app quietly falls back to demo mode, so it will not crash.
- Using Claude instead? Put your Anthropic key in `.env` and add the line `AI_PROVIDER=anthropic`.

---

## Part 3: Put it online (live link for the judges)

This uses **GitHub** (stores your code) and **Render** (runs it online for free).

1. Make a free account at https://github.com. Click **New repository**, name it `doubtdoor`, and create it.
2. On the repository page click **uploading an existing file**. Drag in **everything inside the `doubtdoor` folder** (do not include a `node_modules` folder if you have one). Click **Commit changes**.
3. Make a free account at https://render.com and sign in with GitHub.
4. Click **New > Web Service**, choose your `doubtdoor` repository, and fill in:
   - **Language:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free
5. Under **Advanced > Environment Variables**, add `AI_API_KEY` with your key as the value.
6. Click **Create Web Service**. After a few minutes you get a link ending in `.onrender.com`. That is your live link.

Important about the free plan:
- The app **goes to sleep after 15 minutes** with no visitors, and the first visit afterwards takes about a minute to wake up. **Open your link a few minutes before you present.**
- Bookings you make are **forgotten when it sleeps or redeploys**, and the demo data comes back. That is fine for a demo.

---

## Part 4: What to pick in the Tech Stack form

| Section | Pick |
|---|---|
| Frontend | HTML/CSS/JS |
| Backend | Node.js, Express |
| Database | Other (a simple JSON file, no database software) |
| Auth | Other (simple demo login) |

The AI part is the Gemini API (or Claude if you chose that). Mention it in your description.

---

## Part 5: A 3-minute demo script

1. **(30 sec) Problem.** "Students get stuck at night, tuition is expensive, and local tutors lack steady income."
2. **(60 sec) AI first.** Log in with **Try the demo student**. Ask a doubt (type it, or upload a photo if the AI key is on). Show the instant answer and the topic tag.
3. **(60 sec) Human help.** Click **Not yet, find me a tutor**. Show the ranked tutors and why each matched. Switch to **Group** and book a 2-hour slot. Open **My sessions** and click **+30 min** to show extension and the updated price.
4. **(30 sec) Smart plan.** Open **My progress**. Show the weak topics and start the **weekly plan** (5 online + 1 home visit).
5. **Bonus.** Log out, log in as the tutor you booked, and show earnings and the AI session summary.

---

## Part 6: Be honest about what is real and what is a prototype

Judges respect honesty. Here is the truth, so you can answer questions confidently.

**Real in this app:** the AI doubt solver and topic tagging, the tutor ranking (subject, rating, language, distance, price), booking with clash protection, group pricing and extension, tutor earnings with a 15% platform fee, AI session summaries, weak-topic detection and the weekly plan.

**Prototype / mocked:** login has no passwords, and the "strict action" for unpaid cash is a warning in the app (there is no automatic blocking yet), payments are not charged, video calls are not built in (the tutor shares a link), tutor verification, parent confirmation and the SOS button are described in the deck but are not coded, and the tutors and the demo student are made-up examples.

**If asked "what next?":** real login (phone OTP), payment gateway, in-app video, ID and background verification for tutors, a parent app, and pilot launch in one neighbourhood.

---

## Part 7: Where things are (if you want to change something)

```
doubtdoor/
  server.js          the server and all the API routes
  lib/ai.js          the AI part (real AI + demo mode)
  lib/matching.js    tutor ranking, time slots, pricing
  lib/seed.js        the demo tutors and demo student (edit names, subjects, prices here)
  lib/store.js       saves data to data/db.json
  public/            what the user sees
    index.html, style.css (colours at the top), app.js (all the screens)
  START_HERE.md      this guide
```

Reset all data: stop the app and delete `data/db.json`. It is rebuilt with the demo data on the next start.

---

## Troubleshooting

- **`npm` is not recognized:** Node.js is not installed, or you must close and reopen the terminal after installing it.
- **Port already in use:** another copy is running. Close that terminal, or run with a different port (`PORT=3001 npm start`; on Windows PowerShell: `$env:PORT=3001; npm start`).
- **The footer still says AI is in demo mode:** check the file is named exactly `.env` (not `.env.txt`), contains `AI_API_KEY=` followed by your key with no spaces or quotes, and that you restarted the app.
- **Photo doubts say demo mode cannot read photos:** photos need the AI key (Part 2).
- **Render says deploy failed:** open the **Logs** tab and copy the last red lines to me, and I'll fix it.
