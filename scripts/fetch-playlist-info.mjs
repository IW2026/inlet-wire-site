/**
 * fetch-playlist-info.mjs
 * Fetches Spotify playlist names and descriptions for the Inlet Wire playlists page.
 *
 * Run from the site/ folder:
 *   node scripts/fetch-playlist-info.mjs
 */

const CLIENT_ID     = "dae92fe6ba1b4c5ab997ee7b35be663c";
const CLIENT_SECRET = "c7ea909a7508493ab59cae6b13cf060c";

const PLAYLISTS = [
  { id: "3o9Iy26RGOBBHNUxe8MXrO", label: "Featured playlist" },
  { id: "1De8QSqbYa15p5gXO78PDl", label: "All episodes playlist" },
];

const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
  method: "POST",
  headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials",
});
const { access_token } = await tokenRes.json();

for (const { id, label } of PLAYLISTS) {
  const res = await fetch(`https://api.spotify.com/v1/playlists/${id}?fields=name,description`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const data = await res.json();
  console.log(`\n── ${label} ──`);
  console.log(`Name:        ${data.name}`);
  console.log(`Description: ${data.description || "(none set)"}`);
}
