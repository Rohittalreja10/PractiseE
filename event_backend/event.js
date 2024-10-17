const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  eventDate: {
    type: Date,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ["Workshop", "Conference", "Meetup", "Webinar"],
    required: true,
  },
  organizerName: {
    type: String,
    required: true,
  },
  organizerContact: {
    type: String,
    required: true,
  },
  eventImage: {
    type: String, 
    required: false,
  },
});

const Event = mongoose.model('Event', eventSchema, 'events');

module.exports = Event;
