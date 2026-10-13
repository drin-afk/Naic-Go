const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const env = require('./config/env');
const { ping } = require('./config/db');
const routes = require('./routes');
const { originCheck, rateLimiters, notFound, errorHandler } = require('./middleware/common');

const app = express();
app.disable('x-powered-by');
if (env.trustProxy) app.set('trust proxy', 1);

app.use(helmet({
  // The API only serves JSON and private file downloads; the React app sets its own CSP.
  crossOriginResourcePolicy: { policy: 'same-site' },
}));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || env.clientOrigin.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(cookieParser());
if (env.nodeEnv !== 'test') app.use(morgan(env.isProd ? 'combined' : 'dev'));

app.get('/api/health', async (req, res) => {
  try {
    await ping();
    res.json({ success: true, data: { api: 'ok', database: 'ok', time: new Date().toISOString() } });
  } catch (err) {
    res.status(503).json({ success: false, message: 'Database unavailable', data: { api: 'ok', database: 'unavailable' } });
  }
});

app.use('/api', rateLimiters.api, originCheck, routes);
app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
