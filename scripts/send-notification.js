#!/usr/bin/env node
/**
 * Script pour envoyer une notification push directe à un utilisateur par son display_name.
 * Usage: node scripts/send-notification.js <display_name> <title> <body>
 */

const SUPABASE_URL = 'https://svhrpzlhqauyarcffpii.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2aHJwemxocWF1eWFyY2ZmcGlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4OTUwMTcsImV4cCI6MjA4NTQ3MTAxN30.XqKUpriPey1lhIpsmjF4Zcgjfeml2DtjGHlL7N-Jfqk';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const supabaseHeaders = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
};

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: supabaseHeaders,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error (${res.status}): ${err}`);
  }
  return res.json();
}

async function sendNotificationToUser(displayName, title, body) {
  // Find user by display_name (case-insensitive via ilike)
  const encodedName = encodeURIComponent(displayName);
  const users = await supabaseGet(
    `users?select=id,display_name&display_name=ilike.${encodedName}`
  );

  if (!users || users.length === 0) {
    console.error(`Aucun utilisateur trouvé avec le nom "${displayName}"`);
    process.exit(1);
  }

  if (users.length > 1) {
    console.log(`Plusieurs utilisateurs trouvés avec le nom "${displayName}":`);
    users.forEach(u => console.log(`  - ${u.id}: ${u.display_name}`));
    console.error('Précisez le nom exact.');
    process.exit(1);
  }

  const user = users[0];
  console.log(`Utilisateur trouvé : ${user.display_name} (${user.id})`);

  // Get push tokens for this user
  const tokens = await supabaseGet(
    `user_push_tokens?select=expo_push_token&user_id=eq.${user.id}`
  );

  if (!tokens || tokens.length === 0) {
    console.error(`Aucun token push enregistré pour ${user.display_name}`);
    process.exit(1);
  }

  console.log(`${tokens.length} token(s) push trouvé(s). Envoi en cours...`);

  // Send notification to each token via Expo Push API
  const messages = tokens.map(({ expo_push_token }) => ({
    to: expo_push_token,
    sound: 'default',
    title,
    body,
  }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error('Erreur API Expo:', result);
    process.exit(1);
  }

  console.log('Notification(s) envoyée(s) avec succès :');
  result.data.forEach((item, i) => {
    if (item.status === 'ok') {
      console.log(`  [${i + 1}] OK — id: ${item.id}`);
    } else {
      console.error(`  [${i + 1}] Erreur: ${item.message}`);
    }
  });
}

// Parse CLI args
const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: node scripts/send-notification.js <display_name> <title> <body>');
  console.error('Exemple: node scripts/send-notification.js "Paul" "Fläag" "j\'ai envie de dormir contre toi"');
  process.exit(1);
}

const [displayName, title, body] = args;
sendNotificationToUser(displayName, title, body).catch(err => {
  console.error('Erreur inattendue:', err);
  process.exit(1);
});
