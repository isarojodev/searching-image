require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan'); // Para logging de requests

// Configuración inicial
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(morgan('dev')); // Logs de las peticiones

// Validar que la API key esté configurada
if (!process.env.UNSPLASH_ACCESS_KEY) {
  console.error('ERROR: No se encontró UNSPLASH_ACCESS_KEY en .env');
  process.exit(1);
}

// Ruta de prueba
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Ruta para verificar el entorno
app.get('/check-env', (req, res) => {
  res.json({
    status: 'OK',
    port: PORT,
    unsplash_key: process.env.UNSPLASH_ACCESS_KEY ? 'Configurada' : 'Falta'
  });
});

// Ruta principal de búsqueda
app.get('/search/images', async (req, res) => {
  try {
    // Validar parámetros
    const { query, page = 1 } = req.query;
    
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({ 
        error: 'Parámetro "query" inválido',
        example: '/search/images?query=nature&page=2'
      });
    }

    // Configuración de la petición a Unsplash
    const config = {
      params: {
        query: query.trim(),
        per_page: 20,
        page: parseInt(page) || 1
      },
      headers: {
        'Authorization': `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
        'Accept-Version': 'v1'
      },
      timeout: 10000 // 10 segundos timeout
    };

    // Hacer la petición
    const response = await axios.get('https://api.unsplash.com/search/photos', config);

    // Validar respuesta
    if (!response.data || !Array.isArray(response.data.results)) {
      throw new Error('Formato de respuesta inesperado de Unsplash');
    }

    // Formatear datos
    const formattedData = {
      total: response.data.total,
      total_pages: response.data.total_pages,
      current_page: parseInt(page) || 1,
      images: response.data.results.map(img => ({
        id: img.id,
        url: img.urls?.regular || img.urls?.full,
        description: img.description || img.alt_description || query,
        user: {
          name: img.user?.name || 'Anónimo',
          profile: img.user?.links?.html || '#'
        },
        color: img.color || '#cccccc'
      }))
    };

    // Enviar respuesta
    res.json(formattedData);

  } catch (error) {
    console.error('Error en /search/images:', error.message);

    // Manejo detallado de errores
    let status = 500;
    let message = 'Error al buscar imágenes';
    let details = null;

    if (error.response) {
      // Error de la API de Unsplash
      status = error.response.status;
      details = error.response.data?.errors?.[0] || error.response.data;
      
      if (status === 401) {
        message = 'Problema de autenticación - Verifica tu API Key';
      } else if (status === 403) {
        message = 'Límite de peticiones excedido';
      } else if (status === 404) {
        message = 'No se encontraron resultados';
      }
    } else if (error.request) {
      // No se recibió respuesta
      message = 'No se recibió respuesta de Unsplash API';
      details = 'Timeout o problema de red';
    } else {
      // Error en la configuración
      details = error.message;
    }

    res.status(status).json({ error: message, details });
  }
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error global:', err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
});