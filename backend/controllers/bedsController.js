import mongoose from 'mongoose';
// Simple in-memory model fallback if Bed model not present
let Bed;
try { Bed = mongoose.model('Bed'); } catch(e) {
  const BedSchema = new mongoose.Schema({ ward:String, number:String, occupied:Boolean, patient: mongoose.Schema.Types.ObjectId }, { timestamps:true });
  Bed = mongoose.model('Bed', BedSchema);
}

export async function listBeds(req,res){
  const beds = await Bed.find().lean();
  res.json({ data: beds });
}

export async function updateBed(req,res){
  const { id } = req.params;
  const { occupied, patient } = req.body;
  const bed = await Bed.findById(id);
  if(!bed) return res.status(404).json({error:'Bed not found'});
  bed.occupied = occupied;
  bed.patient = patient || null;
  await bed.save();
  res.json({ data: bed });
}

export async function createBed(req,res){
  const { ward, number } = req.body;
  const b = await Bed.create({ ward, number, occupied:false });
  res.json({ data: b });
}
