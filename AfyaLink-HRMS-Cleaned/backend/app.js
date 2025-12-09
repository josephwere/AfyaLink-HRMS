const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

const corsOptions = {
  origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL || 'https://your-frontend.com' : 'http://localhost:3000',
  credentials: true,
};
app.use(cors(corsOptions));

app.use('/api', routes);

// health
app.get('/health', (req, res) => res.json({ ok: true }));

app.use(errorHandler);

module.exports = app;
