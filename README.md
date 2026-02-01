# Online Pong

Two-player online Pong built with Node.js and WebSockets. Share the URL with a friend and play directly in your browsers.

## Getting Started

```bash
npm install
npm start
```

Then open `http://localhost:3000` in two different browsers or devices on the same network.

## Deploying to Vercel

Vercel Serverless Functions do not keep long-lived WebSocket connections alive. You can still deploy the static client on Vercel, but you must point it at a separate WebSocket host (Render/Fly/Railway/your own server).

You can set the WebSocket URL by adding a `?ws=wss://your-ws-host` query string to the page URL or by defining `window.PONG_WS_URL` before loading `client.js`.

To run locally with Vercel:

```bash
npm install
npx vercel dev
```

The app will be available at the URL printed by the Vercel CLI.

## Controls

- Player 1 (left paddle): **W / S**
- Player 2 (right paddle): **Arrow Up / Arrow Down**

## Gameplay

- First to 7 points wins the round.
- Ball speed increases after each paddle hit.
- A short countdown plays before each serve and after a win.
