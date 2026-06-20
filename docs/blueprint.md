# **App Name**: NeuroTrade Command

## Core Features:

- AI Committee Consensus Tool: A real-time visual monitor showing the percentage of consensus among individual AI agents and their specific CALL/PUT recommendations using reasoning tools before execution.
- Hybrid Live Dashboard: Synchronized display of real-time balance, net profit, and win rate using server-side rendering for stability and client-side hydration for active Firestore streaming.
- Dynamic Equity Analytics: Interactive performance graphs using Tremor to visualize the account's historical profit/loss evolution based on daily records.
- Streaming Intelligence Console: A real-time log viewer streaming the latest 50 operations from the bot's internal reasoning process via Firebase Realtime Database.
- Hot-Config Remote Engine: Server Actions based control panel allowing immediate updates to trading parameters like stop-loss and martingale without rebooting the bot.
- Instant Panic Bridge: A global emergency 'Kill Switch' tool that triggers an ultra-fast server action to halt all trading activity in under 100 milliseconds.
- Authenticated Secure Gateway: Middleware-protected routing with Firebase Auth session verification to restrict dashboard access to authorized operators only.

## Style Guidelines:

- The palette is inspired by a high-stakes command center, using a dark theme to minimize eye strain during monitoring.
- Primary color: Electric Cobalt (#3B82F6) representing high-tech precision. Background: Deep Night Navy (#0F172A) providing depth and contrast.
- Accent color: Vibrant Sky Blue (#0EA5E9) for critical call-to-actions and highlighted metrics.
- A technical font pairing: 'Space Grotesk' for high-impact headlines and numbers, with 'Inter' for clean, readable secondary data.
- Monospaced font: 'Source Code Pro' used specifically for the real-time bot reasoning console logs.
- Minimalist line-art icons that change color (Green/Red) based on win/loss ratios or AI trade direction.
- Smooth 'pulse' animations on live counters and rapid sliding transitions for log entry updates.