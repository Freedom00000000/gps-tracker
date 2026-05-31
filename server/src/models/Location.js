const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  speed: { type: Number, default: 0 },
  accuracy: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now }
});

// Geospatial index for proximity queries
LocationSchema.index({ coordinates: '2dsphere' });
LocationSchema.index({ deviceId: 1, timestamp: -1 });

module.exports = mongoose.model('Location', LocationSchema);
