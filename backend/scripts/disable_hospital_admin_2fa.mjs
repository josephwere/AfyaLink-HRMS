import mongoose from 'mongoose';
import '../config/loadEnv.js';
import User from '../models/User.js';

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/afyalink';

try {
  await mongoose.connect(uri);
  const user = await User.findOneAndUpdate(
    { email: 'hospital.admin+auto@afyalink.demo' },
    { $set: { twoFactorEnabled: false, twoFactorMethod: 'OTP' } },
    { new: true }
  );
  console.log(JSON.stringify({ email: user?.email, twoFactorEnabled: user?.twoFactorEnabled, role: user?.role, hospital: user?.hospital }, null, 2));
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
