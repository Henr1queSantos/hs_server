const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3000", "https://Henr1queSantos.github.io/hs_collaborative-whiteboard"], // Allow both
    methods: ["GET", "POST"]
  }
});

let drawingHistory = []; // Stores all drawing data as an array of element objects
let activeUsers = {}; // Stores { socketId: { username, color } }

const userColors = [
  '#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#A133FF', '#FF8D33',
  '#33FF8D', '#8D33FF', '#FF3333', '#33FFFF', '#FFFF33', '#FF33FF'
];
let colorIndex = 0;

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  const assignedColor = userColors[colorIndex % userColors.length];
  colorIndex++;

  const newUser = {
    id: socket.id,
    username: `Guest-${Math.floor(Math.random() * 1000)}`,
    color: assignedColor,
  };
  activeUsers[socket.id] = newUser;

  // 1. Send the new user their own ID and initial data
  socket.emit('current-user-info', newUser);

  // 2. Send existing drawing history (all elements) to the new user
  socket.emit('load-drawing', drawingHistory);

  // 3. Inform the new user about all currently active users
  socket.emit('active-users-list', Object.values(activeUsers));

  // 4. Broadcast to everyone else that a new user has connected
  socket.broadcast.emit('user-connected', newUser);

  // --- New: Handle element updates (for new elements or continuous updates) ---
  socket.on('element-update', (elementData) => {
    // Find if the element already exists in history by its ID
    const existingIndex = drawingHistory.findIndex(el => el.id === elementData.id);

    if (existingIndex !== -1) {
      // If it exists, update it (e.g., line points, shape dimensions)
      drawingHistory[existingIndex] = elementData;
    } else {
      // If it's a new element (e.g., the start of a new line or shape)
      drawingHistory.push(elementData);
    }
    // Broadcast the updated/new element to all other clients (excluding sender)
    socket.broadcast.emit('element-update', elementData);
  });

  // Handle username updates from clients
  socket.on('update-username', (newUsername) => {
    const user = activeUsers[socket.id];
    if (user && newUsername && newUsername.trim() !== '') {
      user.username = newUsername.trim().substring(0, 20); // Limit username length
      io.emit('user-updated', user); // Broadcast update to all
    }
  });

  // Handle clear canvas event
  socket.on('clear-canvas', () => {
    drawingHistory = []; // Clear history
    io.emit('clear-canvas'); // Broadcast clear event to all clients
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const disconnectedUser = activeUsers[socket.id];
    delete activeUsers[socket.id];
    if (disconnectedUser) {
      io.emit('user-disconnected', disconnectedUser.id); // Broadcast disconnection
    }
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});