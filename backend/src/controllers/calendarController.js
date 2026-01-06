const { google } = require('googleapis');
const db = require('../config/database');

// Configurar OAuth2 client
const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

// Obtener URL de autorización de Google
const getAuthUrl = (req, res) => {
  try {
    const oauth2Client = getOAuth2Client();
    
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events.readonly',
      ],
      state: req.user.userId.toString(),
    });

    res.json({ authUrl: url });
  } catch (error) {
    console.error('Error al generar URL de autorización:', error);
    res.status(500).json({ error: 'Error al generar URL de autorización' });
  }
};

// Callback de Google OAuth
const handleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    const userId = parseInt(state);

    if (!code) {
      return res.status(400).send('Código de autorización no proporcionado');
    }

    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    
    // Guardar refresh token en la base de datos
    await db.query(
      'UPDATE users SET google_refresh_token = $1 WHERE id = $2',
      [tokens.refresh_token, userId]
    );

    res.send(`
      <html>
        <body>
          <h2>✅ Autorización exitosa!</h2>
          <p>Puedes cerrar esta ventana y volver a la aplicación.</p>
          <script>
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error en callback de Google:', error);
    res.status(500).send('Error al procesar autorización');
  }
};

// Sincronizar eventos del calendario
const syncCalendar = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Obtener refresh token del usuario
    const userResult = await db.query(
      'SELECT google_refresh_token FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows[0]?.google_refresh_token) {
      return res.status(400).json({ 
        error: 'Usuario no ha autorizado acceso a Google Calendar',
        needsAuth: true 
      });
    }

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: userResult.rows[0].google_refresh_token,
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Obtener eventos de los próximos 30 días
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + 30);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: futureDate.toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    // Guardar eventos en la base de datos
    for (const event of events) {
      const startTime = event.start.dateTime || event.start.date;
      const endTime = event.end.dateTime || event.end.date;

      await db.query(
        `INSERT INTO calendar_events 
         (google_event_id, user_id, summary, description, start_time, end_time, location, calendar_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (google_event_id) 
         DO UPDATE SET 
           summary = EXCLUDED.summary,
           description = EXCLUDED.description,
           start_time = EXCLUDED.start_time,
           end_time = EXCLUDED.end_time,
           location = EXCLUDED.location,
           synced_at = CURRENT_TIMESTAMP`,
        [
          event.id,
          userId,
          event.summary || 'Sin título',
          event.description || '',
          startTime,
          endTime,
          event.location || '',
          'primary',
        ]
      );
    }

    res.json({ 
      message: 'Calendario sincronizado exitosamente',
      eventCount: events.length 
    });
  } catch (error) {
    console.error('Error al sincronizar calendario:', error);
    
    if (error.code === 401 || error.code === 403) {
      return res.status(401).json({ 
        error: 'Autorización expirada o inválida',
        needsAuth: true 
      });
    }
    
    res.status(500).json({ error: 'Error al sincronizar calendario' });
  }
};

// Obtener eventos del calendario
const getEvents = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { startDate, endDate } = req.query;

    let query = `
      SELECT * FROM calendar_events 
      WHERE user_id = $1
    `;
    const params = [userId];

    if (startDate) {
      query += ` AND start_time >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND start_time <= $${params.length + 1}`;
      params.push(endDate);
    }

    query += ' ORDER BY start_time ASC';

    const result = await db.query(query, params);

    res.json({ events: result.rows });
  } catch (error) {
    console.error('Error al obtener eventos:', error);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
};

// Verificar estado de autorización
const getAuthStatus = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await db.query(
      'SELECT google_refresh_token IS NOT NULL as is_authorized FROM users WHERE id = $1',
      [userId]
    );

    res.json({ 
      isAuthorized: result.rows[0]?.is_authorized || false 
    });
  } catch (error) {
    console.error('Error al verificar estado de autorización:', error);
    res.status(500).json({ error: 'Error al verificar estado' });
  }
};

module.exports = {
  getAuthUrl,
  handleCallback,
  syncCalendar,
  getEvents,
  getAuthStatus,
};
