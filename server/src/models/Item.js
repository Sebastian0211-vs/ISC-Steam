import mongoose from 'mongoose';

// Example resource. Duplicate this file (and its route/controller)
// for each entity your app needs, then delete the demo.
const itemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    done: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model('Item', itemSchema);
