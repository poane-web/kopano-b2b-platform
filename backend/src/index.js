const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const multer = require('multer');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage() });

process.on('uncaughtException', (err) => console.warn('Caught background exception:', err.message));
process.on('unhandledRejection', (reason) => console.warn('Caught unhandled rejection:', reason?.message || reason));

app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(morgan('dev'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/kopano',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 1000
});

pool.on('error', (err) => console.warn('PostgreSQL pool error:', err.message));

// Wholesaler Bulk CSV Upload Pipeline
app.post('/api/wholesaler/bulk-upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = req.file.buffer.toString('utf8');
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    const itemsProcessed = [];

    // Simple CSV parser ignoring header row
    for (let i = 1; i < lines.length; i++) {
      const [title, rrp, groupPrice, targetUnits] = lines[i].split(',').map(s => s?.trim());
      if (title && rrp && groupPrice) {
        const rrpNum = parseFloat(rrp.replace(/[^0-9.]/g, '')) || 0;
        const groupNum = parseFloat(groupPrice.replace(/[^0-9.]/g, '')) || 0;
        const savingsPct = rrpNum > 0 ? Math.round(((rrpNum - groupNum) / rrpNum) * 100) : 0;

        itemsProcessed.push({
          id: Date.now() + i,
          title,
          rrp: `P ${rrpNum}`,
          groupPrice: `P ${groupNum}`,
          targetUnits: parseInt(targetUnits) || 50,
          currentUnits: 0,
          savingsPct: `${savingsPct}%`
        });
      }
    }

    res.json({
      success: true,
      message: `Parsed ${itemsProcessed.length} stock items from CSV successfully.`,
      items: itemsProcessed
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Orders & Tracking Endpoint
app.get('/api/orders/my-orders', (req, res) => {
  res.json([
    {
      id: 'KPN-4081',
      title: '50kg Cooking Oil Drums (x2)',
      supplier: 'Kalahari Wholesalers',
      totalCost: 'P 1,700',
      statusStep: 3, // 1: Order Placed, 2: Pool Filled, 3: Dispatched, 4: Sorting Hub, 5: Delivered
      statusLabel: 'Wholesaler Dispatched',
      eta: 'Tomorrow, 11:00 AM'
    },
    {
      id: 'KPN-3902',
      title: 'Grade A Maize Meal 25kg (x5)',
      supplier: 'Gaborone Milling',
      totalCost: 'P 3,550',
      statusStep: 5,
      statusLabel: 'Delivered',
      eta: 'Completed 12 Aug'
    }
  ]);
});

// Deals Data with RRP Savings Baseline
app.get('/api/deals', (req, res) => {
  res.json([
    { id: 1, title: '50kg Cooking Oil Drums', supplier: 'Kalahari Wholesalers', rrpPrice: 'P 1,200', groupPrice: 'P 850', savingsPct: 29, targetUnits: 100, currentUnits: 68, daysLeft: 3, movThreshold: 'P 2,000' },
    { id: 2, title: 'Grade A Maize Meal 25kg (x10)', supplier: 'Gaborone Milling', rrpPrice: 'P 950', groupPrice: 'P 710', savingsPct: 25, targetUnits: 50, currentUnits: 42, daysLeft: 2, movThreshold: 'P 1,500' },
    { id: 3, title: 'Commercial Cleaning Detergent 20L', supplier: 'BotChem Supplies', rrpPrice: 'P 450', groupPrice: 'P 320', savingsPct: 28, targetUnits: 30, currentUnits: 15, daysLeft: 5, movThreshold: 'P 800' }
  ]);
});

app.listen(PORT, () => console.log(`Backend upgraded with CSV & Tracking active on http://localhost:${PORT}`));
