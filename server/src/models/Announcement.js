import mongoose from 'mongoose';

// Single store-wide announcement banner, managed by admins.
const announcementSchema = new mongoose.Schema(
  {
    text: { type: String, trim: true, maxlength: 500, default: '' },
    link: { type: String, trim: true, maxlength: 500, default: '' },
    active: { type: Boolean, default: false },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export default mongoose.model('Announcement', announcementSchema);
