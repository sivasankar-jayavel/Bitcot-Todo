const express = require('express');
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const jwt = require('jsonwebtoken');

const app = express();
const port = 8000;

app.use(express.urlencoded({ extended: true }));

const db = mongoose.connection;


// Task-1. Signup and Login using passport local strategy and Authenticate api's using jwt ,store user info in User table

// Define a user schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});

// Create a user model based on the schema
const User = mongoose.model('User', userSchema);

// Configure Passport.js
app.use(express.json());
app.use(passport.initialize());

// API endpoint for creating a new user
passport.use(
  new LocalStrategy((username, password, done) => {
    User.findOne({ username: username }, (err, user) => {
      if (err) return done(err);
      if (!user) return done(null, false, { message: 'Incorrect username.' });
      if (user.password !== password)
        return done(null, false, { message: 'Incorrect password.' });

      return done(null, user);
    });
  })
);

// API endpoint for user signup
app.post('/signup', (req, res) => {
  const { username, password } = req.body;

  // Check if the username is already taken
  User.findOne({ username: username }, (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to sign up' });
    }

    if (user) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Create a new user document
    const newUser = new User({
      username: username,
      password: password,
    });

    // Save the user document to the database
    newUser.save((err, user) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to sign up' });
      }

      res.status(201).json({ message: 'Signup successful' });
    });
  });
});

// API endpoint for user login
app.post('/login', (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to authenticate' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create a JWT token
    const token = jwt.sign({ userId: user._id }, '3228E95367EED');

  //  3228E95367EED - its My secret key

    res.json({ token: token });
  })(req, res, next);
});

// Authenticated API endpoint
app.get('/api/secure', passport.authenticate('jwt', { session: false }), (req, res) => {
  res.json({ message: 'Authenticated API endpoint' });
});


// Task-2. CRUD Operation using mongo DB for todo records (store todo info in Todo table)

// Define a todo schema
const todoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  completed: {
    type: Boolean,
    default: false,
  },
});

// Create a todo model based on the schema
const Todo = mongoose.model('Todo', todoSchema);

// API endpoint for creating a new todo
app.post('/todos', (req, res) => {
  const { title, description } = req.body;

  // Create a new todo document
  const newTodo = new Todo({
    title: title,
    description: description,
  });


   newTodo.save().then((todo)=>{
     // Return the created todo
     res.status(201).json(todo);
   }).catch((err)=>{
    console.error(err)
    return res.status(500).json({ error: 'Failed to create todo' });
   })
  });


// API endpoint for retrieving all todos
app.get('/todos', (req, res) => {
  Todo.find({}, (err, todos) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to retrieve todos' });
    }

    // Return the retrieved todos
    res.json(todos);
  });
});

// API endpoint for updating a todo
app.put('/todos/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, completed } = req.body;

  // Update the todo document
  Todo.findByIdAndUpdate(
    id,
    { title, description, completed },
    { new: true },
    (err, todo) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to update todo' });
      }

      // Return the updated todo
      res.json(todo);
    }
  );
});

// API endpoint for deleting a todo
app.delete('/todos/:id', (req, res) => {
  const { id } = req.params;

  // Delete the todo document
  Todo.findByIdAndDelete(id, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to delete todo' });
    }

    // Return a success message
    res.json({ message: 'Todo deleted successfully' });
  });
});


// Task-3. Upload Image using multer and store image info in Image table

// Define an image schema
const imageSchema = new mongoose.Schema({
  filename: String,
  originalname: String
});

// Create an image model based on the schema
const Image = mongoose.model('Image', imageSchema);

const multer = require('multer');
const path = require('path');

// Set up Multer middleware for image upload
const upload = multer ({storage:multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null,path.join(__dirname,"..",'uploads/')); 
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); 
  },
})
});


// API endpoint for creating a new image
app.post('/images', upload.single('image'), (req, res) => {
  const { filename, originalname } = req.file;

  // Create a new image document
  const newImage = new Image({
    filename: filename,
    originalname: originalname
  });

  // Save the image document to the database
  newImage.save().then((image) => {
    // Return the created image
    res.status(201).json(image);
  }).catch((err)=>{
      console.error(err);
      return res.status(500).json({ error: 'Failed to create image' });
    })

});


// Task-4. Fetch todo along with there image info in getAll todo records api with pagination of limit 5 per page


// API endpoint for retrieving all todos with pagination
app.get('/todos', async (req, res) => {
  const page = req.query.page || 1;
  const limit = 5;
  const skip = (page - 1) * limit;

  try {
    const todos = await Todo.find()
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    const todoIds = todos.map(todo => todo._id);

    const images = await Image.find({ todoId: { $in: todoIds } }).lean().exec();

    const todosWithImages = todos.map(todo => {
      const todoImages = images.filter(image => image.todoId.toString() === todo._id.toString());
      return { ...todo, images: todoImages };
    });

    res.json(todosWithImages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve todos' });
  }
});



// Connect to the MongoDB database
mongoose.connect('mongodb://127.0.0.1:27017/test-api', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to the database');
  app.listen(8008, () => {
    console.log(`Server started on port ${port}`);
  });
})
.catch((error) => {
  console.error('Error connecting to the database', error);
})
