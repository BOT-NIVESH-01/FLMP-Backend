const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

// Define Schemas (Or require them if you prefer)
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Faculty', 'HOD', 'DEO', 'Admin'], default: 'Faculty' },
  department: String,
  leaveBalance: {
    casual: { type: Number, default: 12 },
    sick: { type: Number, default: 10 },
    personal: { type: Number, default: 5 }
  }
});

const TimetableSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  day: String,
  slot: Number, // 1 to 8
  subject: String,
  class: String
});

const LeaveSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  type: String,
  date: String,
  endDate: String,
  startTime: String,
  endTime: String,
  reason: String,
  status: String,
  substitutions: [{
    date: String,
    slot: Number,
    subject: String,
    class: String,
    subId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    subName: String,
    status: String
  }]
});

const User = mongoose.model('User', UserSchema);
const Timetable = mongoose.model('Timetable', TimetableSchema);
const Leave = mongoose.model('Leave', LeaveSchema);

// Data to Seed
const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected...');

    // 1. Clear existing data
    await User.deleteMany({});
    await Timetable.deleteMany({});
    await Leave.deleteMany({});
    console.log('Old data cleared.');

    // 2. Create Users
    const users = await User.insertMany([
      {
        name: 'Dr. MRN Tagore',
        email: 'mrntagore@vvit.edu',
        password: '123',
        role: 'HOD',
        department: 'Computer Science',
        leaveBalance: { casual: 12, sick: 10, personal: 5 }
      },
      {
        name: 'Prof. OT Gopi Krishna',
        email: 'otgopikrishna@vvit.edu',
        password: '123',
        role: 'Faculty',
        department: 'Computer Science',
        leaveBalance: { casual: 12, sick: 10, personal: 5 }
      },
      {
        name: 'Prof. P Satish Kumar',
        email: 'psatishkumar@vvit.edu',
        password: '123',
        role: 'Faculty',
        department: 'Computer Science',
        leaveBalance: { casual: 12, sick: 10, personal: 5 }
      },
      {
        name: 'Prof. Sk Sameerunnisa',
        email: 'sameera@vvit.edu',
        password: '123',
        role: 'Faculty',
        department: 'Computer Science',
        leaveBalance: { casual: 12, sick: 10, personal: 5 }
      },
      {
        name: 'Prof. K.Ravi Kumar',
        email: 'kravikumar@vvit.edu',
        password: '123',
        role: 'Faculty',
        department: 'Computer Science',
        leaveBalance: { casual: 12, sick: 10, personal: 5 }
      },
      {
        name: 'Dr. O Aruna',
        email: 'oaruna@vvit.edu',
        password: '123',
        role: 'Faculty',
        department: 'Computer Science',
        leaveBalance: { casual: 12, sick: 10, personal: 5 }
      },
      {
        name: 'Prof. V Ramya',
        email: 'vramya@vvit.edu',
        password: '123',
        role: 'Faculty',
        department: 'Computer Science',
        leaveBalance: { casual: 12, sick: 10, personal: 5 }
      },
      {
        name: 'Dr. I L J Bhakta Singh',
        email: 'iljbhaktasingh@vvit.edu',
        password: '123',
        role: 'Faculty',
        department: 'Computer Science',
        leaveBalance: { casual: 12, sick: 10, personal: 5 }
      },
      {
        name: 'Prof. T Suresh',
        email: 'tsuresh@vvit.edu',
        password: '123',
        role: 'Faculty',
        department: 'Computer Science',
        leaveBalance: { casual: 12, sick: 10, personal: 5 }
      },
      {
        name: 'Prof. Dhurvasi',
        email: 'dhurvasi@vvit.edu',
        password: '123',
        role: 'Faculty',
        department: 'Computer Science',
        leaveBalance: { casual: 12, sick: 10, personal: 5 }
      },
      // Admin User
      {
        name: 'System Admin',
        email: 'admin@uni.edu',
        password: 'admin', // Make sure to change this in production!
        role: 'Admin',
        department: 'Administration',
        leaveBalance: { casual: 12, sick: 10, personal: 5 }
      },
      {
        name: 'Department DEO',
        email: 'deo@vvit.edu',
        password: '123',
        role: 'DEO',
        department: 'Computer Science',
        leaveBalance: { casual: 12, sick: 10, personal: 5 }
      }
    ]);

    console.log('Users created.');

    const [tagore, gopi, satish, sameera, ravi, aruna, ramya, bhakta, suresh, dhurvasi, admin] = users;

    // 3. Create Timetables
    // Teaching Slots mapping:
    // Slot 1: 08:00-08:50
    // Slot 2: 09:10-10:00
    // Slot 3: 10:00-10:50
    // Slot 4: 11:10-12:00
    // Slot 5: 12:00-12:50
    // Slot 6: 01:40-02:30
    // Slot 7: 02:30-03:20
    // Slot 8: 03:20-04:10

   const timetableData = [
  // ===== ORIGINAL TIMETABLE =====

  // --- Prof. OT Gopi Krishna (Web Technologies) ---
  { userId: gopi._id, day: 'Monday', slot: 1, subject: 'Web Dev', class: 'CS-A' },
  { userId: gopi._id, day: 'Monday', slot: 6, subject: 'Web Dev Lab', class: 'CS-A' },
  { userId: gopi._id, day: 'Tuesday', slot: 2, subject: 'Project Phase I', class: 'CS-C' },
  { userId: gopi._id, day: 'Wednesday', slot: 4, subject: 'Mentoring', class: 'CS-B' },
  { userId: gopi._id, day: 'Thursday', slot: 7, subject: 'Web Dev', class: 'CS-A' },
  { userId: gopi._id, day: 'Friday', slot: 1, subject: 'Web Dev Lab', class: 'CS-A' },

  // --- Prof. P Satish Kumar (Database Systems) ---
  { userId: satish._id, day: 'Monday', slot: 2, subject: 'Database Systems', class: 'CS-B' },
  { userId: satish._id, day: 'Monday', slot: 4, subject: 'DBMS Lab', class: 'CS-B' },
  { userId: satish._id, day: 'Tuesday', slot: 1, subject: 'Database Systems', class: 'CS-A' },
  { userId: satish._id, day: 'Wednesday', slot: 3, subject: 'DBMS Lab', class: 'CS-A' },
  { userId: satish._id, day: 'Thursday', slot: 5, subject: 'Database Systems', class: 'CS-B' },
  { userId: satish._id, day: 'Friday', slot: 8, subject: 'Mentoring', class: 'CS-C' },

  // --- Prof. Sk Sameerunnisa (Network Security) ---
  { userId: sameera._id, day: 'Monday', slot: 5, subject: 'Network Security', class: 'CS-C' },
  { userId: sameera._id, day: 'Tuesday', slot: 3, subject: 'Ethical Hacking', class: 'CS-Final' },
  { userId: sameera._id, day: 'Wednesday', slot: 1, subject: 'Network Security', class: 'CS-C' },
  { userId: sameera._id, day: 'Thursday', slot: 2, subject: 'Networks Lab', class: 'CS-C' },
  { userId: sameera._id, day: 'Friday', slot: 4, subject: 'Ethical Hacking', class: 'CS-Final' },

  // --- Prof. K.Ravi Kumar (AI & Data Mining) ---
  { userId: ravi._id, day: 'Tuesday', slot: 5, subject: 'AI', class: 'CS-B' },
  { userId: ravi._id, day: 'Wednesday', slot: 2, subject: 'AI Lab', class: 'CS-B' },
  { userId: ravi._id, day: 'Thursday', slot: 1, subject: 'Data Mining', class: 'CS-A' },
  { userId: ravi._id, day: 'Friday', slot: 6, subject: 'Data Mining', class: 'CS-A' },

  // --- Dr. O Aruna (Big Data Analytics) ---
  { userId: aruna._id, day: 'Monday', slot: 6, subject: 'Big Data', class: 'CS-C' },
  { userId: aruna._id, day: 'Thursday', slot: 4, subject: 'Big Data', class: 'CS-C' },
  { userId: aruna._id, day: 'Friday', slot: 3, subject: 'Big Data Lab', class: 'CS-C' },

  // --- Prof. V Ramya (Cloud Computing) ---
  { userId: ramya._id, day: 'Tuesday', slot: 6, subject: 'Cloud Computing', class: 'CS-A' },
  { userId: ramya._id, day: 'Wednesday', slot: 7, subject: 'Cloud Lab', class: 'CS-A' },
  { userId: ramya._id, day: 'Thursday', slot: 3, subject: 'Cloud Computing', class: 'CS-A' },

  // --- Dr. I L J Bhakta Singh (Software Engineering) ---
  { userId: bhakta._id, day: 'Monday', slot: 7, subject: 'Software Eng', class: 'CS-B' },
  { userId: bhakta._id, day: 'Wednesday', slot: 5, subject: 'Software Eng', class: 'CS-A' },
  { userId: bhakta._id, day: 'Friday', slot: 7, subject: 'Project Review', class: 'CS-B' },

  // --- Prof. T Suresh (Compiler Design) ---
  { userId: suresh._id, day: 'Tuesday', slot: 4, subject: 'Compiler Design', class: 'CS-C' },
  { userId: suresh._id, day: 'Thursday', slot: 8, subject: 'Compiler Design', class: 'CS-B' },
  { userId: suresh._id, day: 'Friday', slot: 5, subject: 'Compiler Lab', class: 'CS-B' },

  // --- Prof. Dhurvasi (Mobile Computing) ---
  { userId: dhurvasi._id, day: 'Monday', slot: 8, subject: 'Mobile Computing', class: 'CS-B' },
  { userId: dhurvasi._id, day: 'Wednesday', slot: 6, subject: 'Mobile Computing', class: 'CS-A' },
  { userId: dhurvasi._id, day: 'Thursday', slot: 6, subject: 'Mobile Computing', class: 'CS-C' },

  // --- Dr. MRN Tagore (HOD - Advanced Algorithms) ---
  { userId: tagore._id, day: 'Monday', slot: 3, subject: 'Adv Algorithms', class: 'M.Tech' },
  { userId: tagore._id, day: 'Wednesday', slot: 8, subject: 'Research Method', class: 'PhD' },
  { userId: tagore._id, day: 'Friday', slot: 2, subject: 'Dept Meeting', class: 'Staff' },

  // ===== ADDITIONAL TIMETABLE =====

  { userId: gopi._id, day: 'Tuesday', slot: 7, subject: 'Web Dev', class: 'CS-B' },
  { userId: gopi._id, day: 'Wednesday', slot: 6, subject: 'Web Dev', class: 'CS-C' },
  { userId: gopi._id, day: 'Saturday', slot: 2, subject: 'Web Dev Lab', class: 'CS-A' },
  { userId: gopi._id, day: 'Saturday', slot: 3, subject: 'Web Dev Lab', class: 'CS-A' },

  { userId: satish._id, day: 'Tuesday', slot: 6, subject: 'Database Systems', class: 'CS-B' },
  { userId: satish._id, day: 'Thursday', slot: 7, subject: 'DBMS Lab', class: 'CS-C' },
  { userId: satish._id, day: 'Saturday', slot: 4, subject: 'Database Systems', class: 'CS-C' },
  { userId: satish._id, day: 'Saturday', slot: 5, subject: 'Mentoring', class: 'CS-B' },

  { userId: sameera._id, day: 'Monday', slot: 7, subject: 'Cyber Security', class: 'CS-B' },
  { userId: sameera._id, day: 'Wednesday', slot: 5, subject: 'Network Security', class: 'CS-A' },
  { userId: sameera._id, day: 'Saturday', slot: 1, subject: 'Ethical Hacking', class: 'CS-Final' },
  { userId: sameera._id, day: 'Saturday', slot: 2, subject: 'Ethical Hacking Lab', class: 'CS-Final' },

  { userId: ravi._id, day: 'Monday', slot: 8, subject: 'AI', class: 'CS-A' },
  { userId: ravi._id, day: 'Tuesday', slot: 7, subject: 'Data Mining', class: 'CS-C' },
  { userId: ravi._id, day: 'Saturday', slot: 6, subject: 'AI Workshop', class: 'CS-B' },
  { userId: ravi._id, day: 'Saturday', slot: 7, subject: 'AI Lab', class: 'CS-B' },

  { userId: aruna._id, day: 'Tuesday', slot: 3, subject: 'Big Data', class: 'CS-B' },
  { userId: aruna._id, day: 'Wednesday', slot: 7, subject: 'Big Data Analytics', class: 'CS-A' },
  { userId: aruna._id, day: 'Saturday', slot: 4, subject: 'Big Data Lab', class: 'CS-C' },
  { userId: aruna._id, day: 'Saturday', slot: 5, subject: 'Big Data Lab', class: 'CS-C' },

  { userId: ramya._id, day: 'Monday', slot: 4, subject: 'Cloud Computing', class: 'CS-C' },
  { userId: ramya._id, day: 'Friday', slot: 2, subject: 'Cloud Computing', class: 'CS-B' },
  { userId: ramya._id, day: 'Saturday', slot: 3, subject: 'Cloud Workshop', class: 'CS-A' },
  { userId: ramya._id, day: 'Saturday', slot: 4, subject: 'Cloud Workshop', class: 'CS-A' },

  { userId: bhakta._id, day: 'Tuesday', slot: 2, subject: 'Software Engineering', class: 'CS-C' },
  { userId: bhakta._id, day: 'Thursday', slot: 4, subject: 'Software Engineering', class: 'CS-B' },
  { userId: bhakta._id, day: 'Saturday', slot: 6, subject: 'Project Review', class: 'CS-A' },
  { userId: bhakta._id, day: 'Saturday', slot: 7, subject: 'Mentoring', class: 'CS-C' },

  { userId: suresh._id, day: 'Monday', slot: 1, subject: 'Compiler Design', class: 'CS-C' },
  { userId: suresh._id, day: 'Wednesday', slot: 4, subject: 'Compiler Design', class: 'CS-B' },
  { userId: suresh._id, day: 'Saturday', slot: 1, subject: 'Compiler Lab', class: 'CS-A' },
  { userId: suresh._id, day: 'Saturday', slot: 2, subject: 'Compiler Lab', class: 'CS-A' },

  { userId: dhurvasi._id, day: 'Tuesday', slot: 5, subject: 'Mobile Computing', class: 'CS-B' },
  { userId: dhurvasi._id, day: 'Friday', slot: 3, subject: 'Mobile App Dev', class: 'CS-A' },
  { userId: dhurvasi._id, day: 'Saturday', slot: 5, subject: 'Mobile Computing Lab', class: 'CS-C' },
  { userId: dhurvasi._id, day: 'Saturday', slot: 6, subject: 'Mobile Computing Lab', class: 'CS-C' },

  { userId: tagore._id, day: 'Tuesday', slot: 8, subject: 'Advanced Algorithms', class: 'M.Tech' },
  { userId: tagore._id, day: 'Thursday', slot: 6, subject: 'Research Methodology', class: 'PhD' },
  { userId: tagore._id, day: 'Saturday', slot: 7, subject: 'Department Review', class: 'Staff' },
  { userId: tagore._id, day: 'Saturday', slot: 8, subject: 'Research Meeting', class: 'PhD' }
];

    await Timetable.insertMany(timetableData);
    console.log('Timetables created.');

    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedDatabase();