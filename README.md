# LAN Chat Application

A real-time messaging application for local area networks, designed for classroom environments, allowing students and instructors to communicate through broadcast messages and private chats.

## Features

- **User Authentication:** Secure login system with password change functionality
- **Broadcast Channel:** Send messages to all connected users
- **Private Messaging:** One-on-one conversations between users
- **File Sharing:** Share files of any type with other users
- **Real-time Updates:** Instant message delivery and online status indicators
- **Unread Message Counters:** Visual indicators for unread messages
- **Message History:** Persistent chat history stored in a database
- **Responsive Design:** Works on desktops, tablets, and mobile devices

## Prerequisites

- [Node.js](https://nodejs.org/) (v12 or higher)
- NPM (comes with Node.js)

## Installation

1. Clone the repository or download and extract the zip file
```
git clone https://github.com/yourusername/lan-chat-app.git
cd lan-chat-app
```

2. Install dependencies
```
npm install
```

3. Initialize the database and create an admin user
```
npm start
```
This will create an admin user with:
- Username: `admin`
- Password: `admin123`

4. Add student accounts
```
npm run add-students
```
This will create 70 student accounts with the default password: `password`

Note: Edit the `add-students.js` file to replace placeholder usernames with actual student names.

## Usage

1. Start the server
```
npm start
```

2. Connect to the application
   - From the same computer: http://localhost:3000
   - From other devices on the LAN: http://[SERVER_IP]:3000 (the server will display this URL when started)

3. Login with your credentials
   - Admin: username `admin`, password `admin123`
   - Students: username as configured in `add-students.js`, default password `password`

4. Chat Features
   - Click on the Broadcast Channel to send messages to everyone
   - Click on a user in the sidebar to start a private conversation
   - Use the paperclip icon to share files
   - Red badges indicate unread messages

## Security Considerations

- All passwords are stored as hashed values using bcrypt
- File uploads are stored on the server within the application directory
- The application is designed for internal LAN use and should not be exposed to the public internet without additional security measures

## Project Structure

- `server.js` - Main server file with API endpoints and socket.io handlers
- `add-students.js` - Script to add student accounts
- `public/` - Client-side files
  - `index.html` - Login and password change screens
  - `chat.html` - Main chat interface
  - `app.js` - Main client-side JavaScript for login and authentication
  - `chat.js` - Client-side JavaScript for chat functionality
  - `styles.css` - Styling for the application

## Database

The application uses SQLite for data storage with the following tables:
- `users` - User accounts with username and password
- `messages` - Stores all messages, including file references

## Customization

To customize the application for your classroom:
1. Edit `add-students.js` to include actual student names
2. Modify `styles.css` to change the look and feel
3. Adjust the server port in `server.js` if needed

## Support

For issues and questions, please create an issue in the repository
