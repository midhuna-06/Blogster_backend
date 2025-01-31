const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploaded images

// MongoDB connection
mongoose.connect('mongodb://127.0.0.1:27017/Main_Blog', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB:', err));

// User schema and model
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const User = mongoose.model('User', UserSchema);

// Blog schema and model
const BlogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: String, required: true },
  category: { type: String, required: true },
  externalLink: { type: String },
  image: { type: String }, // Store image path
  createdAt: { type: Date, default: Date.now },
});
const Blog = mongoose.model('Blog', BlogSchema);

// Multer setup for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Register Route
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();
    res.status(200).json({ message: 'Registration successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// Create Blog Route (with image upload)
app.post('/blogs/create', upload.single('image'), async (req, res) => {
  const { title, content, author, category, externalLink } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;
  
  if (!title || !content || !author || !category) {
    return res.status(400).json({ message: 'Please fill all the required fields' });
  }
  
  try {
    const newBlog = new Blog({
      title,
      content,
      author, // Ensure 'author' is the logged-in user's username
      category,
      externalLink,
      image,
    });
    await newBlog.save();
    res.status(200).json({ message: 'Blog created successfully', blog: newBlog });
  } catch (error) {
    console.error('Error creating blog:', error);
    res.status(500).json({ message: 'Error creating blog, please try again' });
  }
});


// Login Route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // Check if the user exists
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    // Compare entered password with stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    res.status(200).json({ message: 'Login successful', username: user.username });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Error logging in, please try again' });
  }
});


// Get Blogs Route (Updated for filtering based on username)
app.get('/blogs', async (req, res) => {
  const { username } = req.query;  // Fetch username from query parameters
  try {
    let blogs;
    
    if (username) {
      // Fetch blogs for a specific user
      blogs = await Blog.find({ author: username });
    } else {
      // Fetch all blogs when no username is provided
      blogs = await Blog.find();
    }

    res.status(200).json({ blogs }); // Send back blogs
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({ message: 'Error fetching blogs' });
  }
});

// Delete Blog Route
app.delete('/blogs/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const blog = await Blog.findByIdAndDelete(id);
      if (!blog) {
        return res.status(404).json({ message: 'Blog not found' });
      }
      res.status(200).json({ message: 'Blog deleted successfully' });
    } catch (error) {
      console.error('Error deleting blog:', error);
      res.status(500).json({ message: 'Error deleting blog' });
    }
  });
  
// Update Blog Route
app.put('/blogs/update/:id', upload.single('image'), async (req, res) => {
    const { title, content, author, category, externalLink } = req.body;
    const { id } = req.params; // Get the blog ID from the URL
    const image = req.file ? `/uploads/${req.file.filename}` : null;
  
    if (!title || !content || !author || !category) {
      return res.status(400).json({ message: 'Please fill all the required fields' });
    }
  
    try {
      const blog = await Blog.findById(id);
      if (!blog) {
        return res.status(404).json({ message: 'Blog not found' });
      }
  
      blog.title = title;
      blog.content = content;
      blog.author = author;
      blog.category = category;
      blog.externalLink = externalLink;
      if (image) blog.image = image; // Update the image if new one is provided
  
      await blog.save();
      res.status(200).json({ message: 'Blog updated successfully', blog });
    } catch (error) {
      console.error('Error updating blog:', error);
      res.status(500).json({ message: 'Error updating blog, please try again' });
    }
  });
  
// Get Blogs by Title Search
app.get('/blogs/search', async (req, res) => {
  const { title } = req.query;  // Fetch the title query parameter
  try {
    let blogs;
    
    if (title) {
      // Fetch blogs that match the title
      blogs = await Blog.find({ title: { $regex: title, $options: 'i' } });  // Case-insensitive search
    } else {
      // If no title is provided, return all blogs
      blogs = await Blog.find();
    }

    res.status(200).json({ blogs });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({ message: 'Error fetching blogs' });
  }
});


// Get Blogs by Title Search
app.get('/blogs/search', async (req, res) => {
    const { title } = req.query;  // Fetch the title query parameter
    try {
      let blogs;
      
      if (title) {
        // Fetch blogs that match the title (case-insensitive search)
        blogs = await Blog.find({ 
          title: { $regex: title, $options: 'i' }  // 'i' for case-insensitive search
        });
      } else {
        // If no title is provided, return all blogs
        blogs = await Blog.find();
      }
  
      res.status(200).json({ blogs });
    } catch (error) {
      console.error('Error fetching blogs:', error);
      res.status(500).json({ message: 'Error fetching blogs' });
    }
});


// Other Routes remain unchanged (login, delete, update)

app.listen(4000, () => {
  console.log('Server is running on port http://localhost:4000');
}); 