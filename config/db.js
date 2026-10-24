const mongoose = require('mongoose');
const logger = console;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.error('MONGODB_URI not defined in environment');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    const dbName = mongoose.connection.name;
    logger.info('MongoDB connected to database:', dbName);
    const EXPECTED_DATABASE = 'inventory_management';
    if (dbName !== EXPECTED_DATABASE) {
      logger.error(`Connected to unexpected database '${dbName}'. Expected '${EXPECTED_DATABASE}'. Aborting.`);
      process.exit(1);
    }
  } catch (err) {
    logger.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
