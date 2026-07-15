const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DB_PATH, 'users.json');

// Ensure db directory exists
if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH, { recursive: true });
}

// Ensure users file exists
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}

function readUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users database:', error);
    return [];
  }
}

function writeUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error writing to users database:', error);
  }
}

const Database = {
  findUserByUsername: (username) => {
    const users = readUsers();
    return users.find(u => u.username.toLowerCase() === username.toLowerCase());
  },

  createUser: (username, hashedPassword) => {
    const users = readUsers();
    const newUser = {
      id: Date.now().toString(),
      username,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    writeUsers(users);
    return { id: newUser.id, username: newUser.username };
  }
};

module.exports = Database;
