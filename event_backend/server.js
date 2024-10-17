require('dotenv').config();


const express = require("express");
const app = express();
const mongoose = require("mongoose");
app.use(express.json());
const cors = require("cors");
app.use(cors());
app.use(express.static('../event_frontend/public')); 
const multer = require('multer');

const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const User = require('./user');

const otpStore = {};

const mongoUrl = "mongodb://localhost:27017/event";

mongoose
  .connect(mongoUrl)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((e) => console.log(e));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '../event_frontend/public/documents'); 
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now();
    cb(null, uniqueSuffix + file.originalname);
  }
});

const Event = require("./event.js");

const upload = multer({ storage: storage });

app.post("/upload-event", upload.single("image"), async (req, res) => {
  const { title, description, eventDate, location, category, organizerName, organizerContact } = req.body;
  const eventImage = req.file ? req.file.filename : null;

  try {
    const newEvent = new Event({
      title,
      description,
      eventDate: new Date(eventDate),
      location,
      category,
      organizerName,
      organizerContact,
      eventImage
    });

    await newEvent.save();
    res.json({ status: "ok", message: "Event created successfully!" });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ status: "error", message: "Failed to create event" });
  }
});





app.get("/fetch-event", async (req, res) => {
  try {
    console.log("Fetching files...");
    const data = await Event.find({}).exec();
    console.log("Files fetched:", data);
    res.json({ status: "ok", data });
  } catch (error) {
    console.error("Error fetching files:", error);
    res.status(500).json({ status: "error", message: "Failed to fetch files" });
  }
});


app.get("/fetch-event/:id", async (req, res) => {
  try {
    const eventId = req.params.id;
    const event = await Event.findById(eventId).exec();
    if (!event) {
      return res.status(404).json({ status: "error", message: "Event not found" });
    }
    res.send({ status: "ok", data: event });
  } catch (error) {
    console.error("Error fetching event details:", error);
    res.status(500).json({ status: "error", message: "Failed to fetch event details" });
  }
});




app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const newUser = new User({ name, email, password });
    await newUser.validate();

    const hashedPassword = await bcrypt.hash(newUser.password, 10);
    newUser.password = hashedPassword;

    await newUser.save();
    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ message: 'User registered successfully', token });
  } catch (error) {
    console.log('Validation error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Login error:', error); 
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/recover-password', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const otp = crypto.randomBytes(3).toString('hex');
  otpStore[email] = otp;  

  console.log('Generated OTP:', otp);

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Password Recovery OTP',
    text: `Your OTP for password recovery is: ${otp}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res.status(500).json({ error: 'Failed to send OTP' });
    }
    res.status(200).json({ message: 'OTP sent successfully' });
  });
});

app.post('/update-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP, and new password are required' });
  }

  const storedOtp = otpStore[email]; 

  if (!storedOtp) {
    return res.status(400).json({ error: 'OTP not found for this email' });
  }

  if (storedOtp !== otp) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10); 
    user.password = hashedPassword;
    await user.save();

    delete otpStore[email];  

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error); 
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.listen(5000, () => {
  console.log("Server started on port 5000");
});