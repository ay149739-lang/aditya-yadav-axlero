let mongoose = null;
try {
  mongoose = require('mongoose');
} catch (e) {
  console.warn('Mongoose is not installed yet in server/node_modules. Running in-memory mode until "npm install mongoose" is executed.');
}

const connectDB = async () => {
  if (!mongoose) return;
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/syncspace';
    await mongoose.connect(connStr);
    console.log(`MongoDB Connected successfully`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
  }
};

module.exports = connectDB;
