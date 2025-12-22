import jwt from 'jsonwebtoken';

export function issueToken(req, res){
  try{
    const user = req.user;
    if(!user) return res.status(401).json({ error:'unauthenticated' });
    const payload = { uid: user._id, hospitalId: user.hospitalId };
    const token = jwt.sign(payload, process.env.SIGNALING_JWT_SECRET || 'verysecret', { expiresIn: '15m' });
    res.json({ token });
  }catch(err){ res.status(500).json({ error: err.message }); }
}
