# CodeRush

Easy real-time multiplayer logic game.

## Run
1. Install Node.js 18+.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

## Test two devices on the same Wi-Fi
1. Run `ipconfig` on Windows and find your IPv4 address.
2. On the second device open `http://YOUR-IP:3000`.
3. Create a room on one device and join with the code on the other.

## Deploy
Upload this folder to GitHub, create a Render Web Service, set Build Command to `npm install`, and Start Command to `npm start`.

Rooms are stored in memory and reset when the server restarts. Test the public URL after deployment.
