#!/usr/bin/env node
/**
 * Script d'envoi de notification push à un utilisateur spécifique.
 * Usage: node scripts/send-notification.mjs <display_name> <title> <body>
 * Utilise l'API REST Supabase et l'API Expo Push directement (fetch natif).
 */

const SUPABASE_URL = 'https://svhrpzlhqauyarcffpii.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2aHJwemxocWF1eWFyY2ZmcGlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4OTUwMTcsImV4cCI6MjA4NTQ3MTAxN30.XqKUpriPey1lhIpsmjF4Zcgjfeml2DtjGHlL7N-Jfqk';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const SUPABASE_HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
};

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: SUPABASE_HEADERS,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error ${res.status}: ${text}`);
  }
  return res.json();
}

async function sendNotification(displayName, title, body) {
  console.log(`🔍 Recherche de l'utilisateur "${displayName}"...`);

  // Find user by display_name (case-insensitive, partial match)
  const users = await supabaseGet(
    `users?select=id,display_name&display_name=ilike.*${encodeURIComponent(displayName)}*`
  );

  if (!users || users.length === 0) {
    console.error(`❌ Aucun utilisateur trouvé avec le nom "${displayName}"`);
    process.exit(1);
  }

  console.log(`✅ Utilisateur(s) trouvé(s): ${users.map(u => u.display_name).join(', ')}`);

  const userIds = users.map(u => u.id);
  const inFilter = userIds.map(id => `"${id}"`).join(',');

  // Get push tokens for found users
  const tokenRows = await supabaseGet(
    `user_push_tokens?select=expo_push_token,user_id&user_id=in.(${encodeURIComponent(userIds.join(','))})`
  );

  if (!tokenRows || tokenRows.length === 0) {
    console.error(`❌ Aucun token push trouvé pour "${displayName}" — l'utilisateur a peut-être désactivé les notifications`);
    process.exit(1);
  }

  console.log(`📱 ${tokenRows.length} token(s) trouvé(s), envoi en cours...`);
  console.log(`   Titre : ${title}`);
  console.log(`   Corps : ${body}`);

  // Send push notification to each token
  const messages = tokenRows.map(({ expo_push_token }) => ({
    to: expo_push_token,
    sound: 'default',
    title,
    body,
  }));

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('❌ Erreur Expo push API:', response.status, text);
    process.exit(1);
  }

  const result = await response.json();
  console.log('✅ Notification(s) envoyée(s) avec succès !');
  console.log('📊 Résultat:', JSON.stringify(result, null, 2));
}

// Parse CLI args or use defaults for this specific notification
const [, , nameArg, titleArg, bodyArg] = process.argv;

const displayName = nameArg || 'Ja';
const title = titleArg || 'ça m\'est apparu ce matin 🫣';
const body = bodyArg || 'tu me manques... 😘';

sendNotification(displayName, title, body).catch(err => {
  console.error('❌ Erreur inattendue:', err);
  process.exit(1);
});
