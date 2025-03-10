// server.js - Main server file for LAN Chat Application
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Database initialization
const db = new sqlite3.Database('./chat.db');

// Create users table if it doesn't exist
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            last_seen DATETIME
        )
    `);
    
    // Create an admin user for testing
    bcrypt.hash('admin123', 10, (err, hash) => {
        if (err) throw err;
        db.run(`INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)`, 
            ['admin', hash]);
        
        console.log('Created admin user. Use username: "admin" and password: "admin123" to login.');
        console.log('To add your 70 student accounts, run: npm run add-students');
    });
});

// Create messages table if it doesn't exist
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender TEXT NOT NULL,
            recipient TEXT NOT NULL,
            message TEXT NOT NULL,
            file_path TEXT,
            file_name TEXT,
            file_type TEXT,
            is_broadcast BOOLEAN DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_read BOOLEAN DEFAULT 0
        )
    `);
    console.log('Messages table created or already exists');
});

// Authentication endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Server error' });
        }
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }
        
        bcrypt.compare(password, user.password, (err, result) => {
            if (err || !result) {
                return res.status(401).json({ success: false, message: 'Invalid username or password' });
            }
            
            // Update last seen
            db.run(`UPDATE users SET last_seen = DATETIME('now') WHERE id = ?`, [user.id]);
            
            res.json({ 
                success: true, 
                user: { 
                    id: user.id, 
                    username: user.username 
                } 
            });
        });
    });
});

// Change password endpoint
app.post('/api/change-password', (req, res) => {
    const { username, currentPassword, newPassword } = req.body;
    
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ success: false, message: 'Authentication failed' });
        }
        
        bcrypt.compare(currentPassword, user.password, (err, result) => {
            if (err || !result) {
                return res.status(401).json({ success: false, message: 'Current password is incorrect' });
            }
            
            bcrypt.hash(newPassword, 10, (err, hash) => {
                if (err) {
                    return res.status(500).json({ success: false, message: 'Server error' });
                }
                
                db.run(`UPDATE users SET password = ? WHERE id = ?`, [hash, user.id], (err) => {
                    if (err) {
                        return res.status(500).json({ success: false, message: 'Failed to update password' });
                    }
                    
                    res.json({ success: true, message: 'Password updated successfully' });
                });
            });
        });
    });
});

// Get all users
app.get('/api/users', (req, res) => {
    db.all(`SELECT id, username, last_seen FROM users`, (err, users) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Failed to retrieve users' });
        }
        res.json({ success: true, users });
    });
});

// New API endpoint to get chat history
app.get('/api/messages/:chatId', (req, res) => {
    const { chatId } = req.params;
    const { username } = req.query;
    
    if (!username) {
        return res.status(400).json({ success: false, message: 'Username is required' });
    }
    
    let sql, params;
    
    if (chatId === 'broadcast') {
        // Get broadcast messages
        sql = `
            SELECT * FROM messages 
            WHERE is_broadcast = 1
            ORDER BY timestamp ASC
        `;
        params = [];
    } else {
        // Get private messages between two users
        sql = `
            SELECT * FROM messages 
            WHERE (sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?)
            AND is_broadcast = 0
            ORDER BY timestamp ASC
        `;
        params = [username, chatId, chatId, username];
    }
    
    db.all(sql, params, (err, messages) => {
        if (err) {
            console.error('Error fetching messages:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch messages' });
        }
        
        // Mark messages as read
        if (messages.length > 0) {
            const messageIds = messages
                .filter(msg => msg.recipient === username && !msg.is_read)
                .map(msg => msg.id);
                
            if (messageIds.length > 0) {
                db.run(`UPDATE messages SET is_read = 1 WHERE id IN (${messageIds.join(',')})`, (err) => {
                    if (err) {
                        console.error('Error marking messages as read:', err);
                    }
                });
            }
        }
        
        // Process file messages
        const processedMessages = messages.map(msg => {
            if (msg.file_path) {
                // Don't include the actual file data in the initial load
                // The client will request it separately if needed
                return {
                    ...msg,
                    hasFile: true
                };
            }
            return msg;
        });
        
        res.json({ 
            success: true, 
            messages: processedMessages
        });
    });
});

// Add endpoint to get unread message counts
app.get('/api/unread-counts/:username', (req, res) => {
    const { username } = req.params;
    
    // Get counts of unread messages grouped by sender
    db.all(`
        SELECT sender, COUNT(*) as count 
        FROM messages 
        WHERE recipient = ? AND is_read = 0 AND is_broadcast = 0
        GROUP BY sender
    `, [username], (err, privateCounts) => {
        if (err) {
            console.error('Error fetching unread counts:', err);
            return res.status(500).json({ success: false, message: 'Failed to fetch unread counts' });
        }
        
        // Get count of unread broadcast messages
        db.get(`
            SELECT COUNT(*) as count 
            FROM messages 
            WHERE is_broadcast = 1 AND is_read = 0
        `, (err, broadcastCount) => {
            if (err) {
                console.error('Error fetching broadcast count:', err);
                return res.status(500).json({ success: false, message: 'Failed to fetch unread counts' });
            }
            
            res.json({ 
                success: true, 
                counts: {
                    private: privateCounts,
                    broadcast: broadcastCount ? broadcastCount.count : 0
                }
            });
        });
    });
});

// Endpoint to get file data
app.get('/api/file/:messageId', (req, res) => {
    const { messageId } = req.params;
    
    db.get(`SELECT file_path, file_name, file_type FROM messages WHERE id = ?`, [messageId], (err, message) => {
        if (err || !message) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }
        
        const filePath = path.join(__dirname, message.file_path);
        
        fs.readFile(filePath, (err, data) => {
            if (err) {
                return res.status(404).json({ success: false, message: 'File not found' });
            }
            
            const base64Data = data.toString('base64');
            
            res.json({
                success: true,
                fileData: base64Data,
                fileName: message.file_name,
                fileType: message.file_type
            });
        });
    });
});

// Socket.IO connection handling
const connectedUsers = new Map(); // Maps socket ID to username
const userSockets = new Map();    // Maps username to socket ID

io.on('connection', (socket) => {
    console.log('New client connected');
    
    // User authentication
    socket.on('authenticate', (data) => {
        const { username } = data;
        connectedUsers.set(socket.id, username);
        userSockets.set(username, socket.id);
        
        // Notify all clients about the new user
        io.emit('user_status', { 
            username, 
            status: 'online', 
            onlineUsers: Array.from(connectedUsers.values()) 
        });
        
        console.log(`${username} connected`);
    });
    
    // Private message
    socket.on('private_message', (data) => {
        const { to, message, timestamp } = data;
        const from = connectedUsers.get(socket.id);
        
        // Save message to database
        db.run(`
            INSERT INTO messages (sender, recipient, message, timestamp, is_read) 
            VALUES (?, ?, ?, ?, ?)
        `, [from, to, message, timestamp, 0], function(err) {
            if (err) {
                console.error('Error saving private message:', err);
            }
            
            const messageId = this ? this.lastID : null;
            
            const receiverSocketId = userSockets.get(to);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('private_message', {
                    from,
                    message,
                    timestamp,
                    messageId
                });
                
                // Mark as read if user is online
                if (messageId) {
                    db.run(`UPDATE messages SET is_read = 1 WHERE id = ?`, [messageId]);
                }
            }
        });
    });
    
    // Broadcast message to all users
    socket.on('broadcast_message', (data) => {
        const { message, timestamp } = data;
        const from = connectedUsers.get(socket.id);
        
        // Save broadcast message to database
        db.run(`
            INSERT INTO messages (sender, recipient, message, timestamp, is_broadcast) 
            VALUES (?, ?, ?, ?, ?)
        `, [from, 'broadcast', message, timestamp, 1], function(err) {
            if (err) {
                console.error('Error saving broadcast message:', err);
            }
            
            const messageId = this ? this.lastID : null;
            
            io.emit('broadcast_message', {
                from,
                message,
                timestamp,
                messageId
            });
        });
    });
    
    // File sharing
    socket.on('file_share', (data) => {
        const { to, filename, fileData, fileType, timestamp } = data;
        const from = connectedUsers.get(socket.id);
        
        // Save file to server
        const filePath = path.join(uploadDir, `${Date.now()}_${filename}`);
        
        // Convert base64 data to buffer
        const fileBuffer = Buffer.from(fileData, 'base64');
        
        fs.writeFile(filePath, fileBuffer, (err) => {
            if (err) {
                console.error('Error saving file:', err);
                return;
            }
            
            // Save file message to database
            const relativePath = path.relative(__dirname, filePath);
            const sql = `
                INSERT INTO messages (sender, recipient, message, file_path, file_name, file_type, timestamp, is_broadcast) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            db.run(sql, [
                from, 
                to, 
                `Sent file: ${filename}`, 
                relativePath,
                filename,
                fileType,
                timestamp,
                to === 'broadcast' ? 1 : 0
            ], function(err) {
                if (err) {
                    console.error('Error saving file message:', err);
                    return;
                }
                
                const messageId = this.lastID;
                
                const messageData = {
                    from,
                    filename,
                    fileData,
                    fileType,
                    timestamp,
                    messageId
                };
                
                // If broadcast file
                if (to === 'broadcast') {
                    io.emit('file_receive', messageData);
                } else {
                    // Private file
                    const receiverSocketId = userSockets.get(to);
                    if (receiverSocketId) {
                        io.to(receiverSocketId).emit('file_receive', messageData);
                        
                        // Mark as read if user is online
                        db.run(`UPDATE messages SET is_read = 1 WHERE id = ?`, [messageId]);
                    }
                }
            });
        });
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        const username = connectedUsers.get(socket.id);
        if (username) {
            connectedUsers.delete(socket.id);
            userSockets.delete(username);
            
            // Notify all clients about the disconnected user
            io.emit('user_status', { 
                username, 
                status: 'offline', 
                onlineUsers: Array.from(connectedUsers.values()) 
            });
            
            console.log(`${username} disconnected`);
            
            // Update last seen in database
            db.run(`UPDATE users SET last_seen = DATETIME('now') WHERE username = ?`, [username]);
        }
        
        console.log('Client disconnected');
    });
});

// Serve the main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the chat page (ADD THIS LINE)
app.get('/chat.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Get machine's IP address on the LAN
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const interfaceName of Object.keys(interfaces)) {
        for (const iface of interfaces[interfaceName]) {
            // Skip over non-IPv4 and internal (loopback) addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1'; // Fallback to localhost if no external IP is found
}

// Start the server
const PORT = process.env.PORT || 3000;
const LOCAL_IP = getLocalIpAddress();

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://${LOCAL_IP}:${PORT}`);
    console.log(`Connect from other devices using: http://${LOCAL_IP}:${PORT}`);
});