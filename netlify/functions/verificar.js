exports.handler = async function(event, context) {
  // 1. Recibimos el código desde la web
  const code = event.queryStringParameters.code;
  if (!code) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Falta el código' }) };
  }

  // 2. Cargamos tus datos secretos (los pondremos luego en la web de Netlify)
  const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
  const GUILD_ID = process.env.DISCORD_GUILD_ID;
  const ROLE_ID = process.env.DISCORD_ROLE_ID;
  const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
  const REDIRECT_URI = 'https://elpepestreamstv.netlify.app/?tab=directos';

  try {
    // --- FASE A: Intercambiar código por Token del Usuario ---
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return { statusCode: 401, body: JSON.stringify({ success: false, error: 'Código inválido' }) };

    // --- FASE B: Saber quién es el usuario ---
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();

    // --- FASE C: Buscar al usuario en tu servidor ---
    const memberRes = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${userData.id}`, {
      headers: { authorization: `Bot ${BOT_TOKEN}` } 
    });
    if (memberRes.status === 404) return { statusCode: 403, body: JSON.stringify({ success: false, error: 'No estás en el servidor' }) };
    const memberData = await memberRes.json();

    // --- FASE D: Comprobar el Rol ---
    if (!memberData.roles.includes(ROLE_ID)) {
       return { statusCode: 403, body: JSON.stringify({ success: false, error: 'No tienes el rol VIP necesario' }) };
    }

    // --- FASE E: Si tiene el rol, robar la contraseña del canal ---
    const msgRes = await fetch(`https://discord.com/api/channels/${CHANNEL_ID}/messages?limit=1`, {
      headers: { authorization: `Bot ${BOT_TOKEN}` }
    });
    const msgData = await msgRes.json();
    const password = msgData[0].content; // El último mensaje es la contraseña

    // Mandar contraseña a tu React
    return { statusCode: 200, body: JSON.stringify({ success: true, password: password }) };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ success: false, error: error.message }) };
  }
};