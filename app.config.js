const appJson = require('./app.json');

module.exports = {
  ...appJson.expo,
  android: {
    ...appJson.expo.android,
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://svhrpzlhqauyarcffpii.supabase.co',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2aHJwemxocWF1eWFyY2ZmcGlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4OTUwMTcsImV4cCI6MjA4NTQ3MTAxN30.XqKUpriPey1lhIpsmjF4Zcgjfeml2DtjGHlL7N-Jfqk',
    eas: {
      projectId: 'c8cb48ce-1c64-4314-a6ad-ada1e82efca8',
    },
  },
};
