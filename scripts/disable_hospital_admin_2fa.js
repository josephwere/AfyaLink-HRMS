import mongoose from 'mongoose';
import '../backend/config/loadEnv.js';
import User from '../backend/models/User.js';

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/afyalink');
    const user = await User.findOneAndUpdate(
      { email: 'hospital.admin+auto@afyalink.demo' },
      { $set: { twoFactorEnabled: false, twoFactorMethod: 'OTP' } },
      { new: true }
    );
    console.log(JSON.stringify({ email: user?.email, twoFactorEnabled: user?.twoFactorEnabled, role: user?.role, hospital: user?.hospital }, null, 2));
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})();