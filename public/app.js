document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const loginScreen = document.getElementById('login-screen');
    const changePasswordScreen = document.getElementById('change-password-screen');
    const chatScreen = document.getElementById('chat-screen');
    
    const loginForm = document.getElementById('login-form');
    const changePasswordForm = document.getElementById('change-password-form');
    const showChangePasswordLink = document.getElementById('show-change-password');
    const backToLoginLink = document.getElementById('back-to-login');
    
    const currentUserElement = document.getElementById('current-user');
    const logoutBtn = document.getElementById('logout-btn');
    const chatTitle = document.getElementById('chat-title');
    const usersListElement = document.getElementById('users-list');
    const onlineCountElement = document.getElementById('online-count');
    
    const messagesContainer = document.getElementById('messages-container');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const fileBtn = document.getElementById('file-btn');
    const fileInput = document.getElementById('file-input');
    
    
    const alertModal = new bootstrap.Modal(document.getElementById('alert-modal'));
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    // App State
    let currentUser = null;
    let currentChat = 'broadcast';
    let onlineUsers = [];
    let socket = null;
    
    // Initialize the broadcast channel click event
    document.querySelector('.broadcast-channel').addEventListener('click', () => {
        selectChat('broadcast');
    });
    
    
    function showAlert(title, message) {
        modalTitle.textContent = title;
        modalBody.textContent = message;
        alertModal.show();
    }
    
    // Navigation functions
    function showLoginScreen() {
        loginScreen.classList.remove('d-none');
        changePasswordScreen.classList.add('d-none');
        chatScreen.classList.add('d-none');
        loginForm.reset();
    }
    
    function showChangePasswordScreen() {
        loginScreen.classList.add('d-none');
        changePasswordScreen.classList.remove('d-none');
        chatScreen.classList.add('d-none');
        changePasswordForm.reset();
    }
    
    function showChatScreen() {
        loginScreen.classList.add('d-none');
        changePasswordScreen.classList.add('d-none');
        chatScreen.classList.remove('d-none');
    }
    
    // Event listeners for navigation
    showChangePasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        showChangePasswordScreen();
    });
    
    backToLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginScreen();
    });
    
    logoutBtn.addEventListener('click', () => {
        if (socket) {
            socket.disconnect();
        }
        currentUser = null;
        showLoginScreen();
    });
    
    // Login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                currentUser = data.user;
                currentUserElement.textContent = `Welcome, ${currentUser.username}`;
                initializeSocket();
                showChatScreen();
                loadUsers();
            } else {
                showAlert('Login Failed', data.message || 'Invalid username or password');
            }
        } catch (error) {
            console.error('Login error:', error);
            showAlert('Error', 'Failed to connect to server');
        }
    });
    
    // Change password form submission
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('cp-username').value.trim();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (newPassword !== confirmPassword) {
            showAlert('Password Mismatch', 'New password and confirmation do not match');
            return;
        }
        
        try {
            const response = await fetch('/api/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    username, 
                    currentPassword, 
                    newPassword 
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showAlert('Success', 'Password changed successfully');
                showLoginScreen();
            } else {
                showAlert('Failed', data.message || 'Failed to change password');
            }
        } catch (error) {
            console.error('Change password error:', error);
            showAlert('Error', 'Failed to connect to server');
        }
    });
    
    // Load users list
    async function loadUsers() {
        try {
            const response = await fetch('/api/users');
            const data = await response.json();
            
            if (data.success) {
                renderUsersList(data.users);
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }
    
    // Render users list
    function renderUsersList(users) {
        usersListElement.innerHTML = '';
        
        users.forEach(user => {
            // Skip current user
            if (currentUser && user.username === currentUser.username) {
                return;
            }
            
            const isOnline = onlineUsers.includes(user.username);
            
            const userElement = document.createElement('div');
            userElement.className = `user-item ${currentChat === user.username ? 'active-user' : ''}`;
            userElement.dataset.username = user.username;
            
            userElement.innerHTML = `
                <div class="user-status ${isOnline ? 'status-online' : 'status-offline'}"></div>
                <div class="user-name">${user.username}</div>
            `;
            
            userElement.addEventListener('click', () => {
                selectChat(user.username);
            });
            
            usersListElement.appendChild(userElement);
        });
        
        onlineCountElement.textContent = onlineUsers.length;
        
        // Load unread counts after user list is populated
        loadUnreadCounts();
    }
    
    // Select chat (user or broadcast)
    function selectChat(chatId) {
        // Remove active class from previous selection
        document.querySelectorAll('.active-user, .active-channel').forEach(el => {
            el.classList.remove('active-user', 'active-channel');
        });
        
        currentChat = chatId;
        
        if (chatId === 'broadcast') {
            document.querySelector('.broadcast-channel').classList.add('active-channel');
            chatTitle.textContent = 'Broadcast Channel';
            
            // Remove unread indicator if present
            const unreadBadge = document.querySelector('.broadcast-channel .unread-badge');
            if (unreadBadge) {
                unreadBadge.remove();
            }
        } else {
            const userElement = document.querySelector(`.user-item[data-username="${chatId}"]`);
            if (userElement) {
                userElement.classList.add('active-user');
                chatTitle.textContent = chatId;
                
                // Remove unread indicator if present
                const unreadBadge = userElement.querySelector('.unread-badge');
                if (unreadBadge) {
                    unreadBadge.remove();
                }
            }
        }
        
        // Clear messages container for new chat
        messagesContainer.innerHTML = '';
        
        // Show loading indicator
        messagesContainer.innerHTML = '<div class="text-center p-3"><div class="spinner-border text-primary" role="status"></div><p>Loading messages...</p></div>';
        
        // Load chat history
        loadChatHistory(chatId);
        
        messageInput.focus();
    }
    
    // Function to load chat history
    async function loadChatHistory(chatId) {
        try {
            const response = await fetch(`/api/messages/${chatId}?username=${currentUser.username}`);
            const data = await response.json();
            
            // Clear messages container
            messagesContainer.innerHTML = '';
            
            if (data.success) {
                if (data.messages.length === 0) {
                    messagesContainer.innerHTML = '<div class="text-center p-3 text-muted">No messages yet. Start a conversation!</div>';
                } else {
                    // Display messages
                    data.messages.forEach(msg => {
                        if (msg.hasFile) {
                            // Display file message placeholder
                            displayFileMessagePlaceholder(msg.sender, msg.file_name, msg.timestamp, msg.id);
                        } else {
                            // Display text message
                            displayMessage(msg.sender, msg.message, msg.timestamp, msg.is_broadcast === 1);
                        }
                    });
                    
                    // Scroll to bottom after all messages are loaded
                    scrollToBottom();
                }
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
            messagesContainer.innerHTML = '<div class="text-center p-3 text-danger">Failed to load messages. Please try again.</div>';
        }
    }
    
    // Initialize Socket.IO connection
    function initializeSocket() {
        socket = io();
        
        socket.on('connect', () => {
            socket.emit('authenticate', { username: currentUser.username });
        });
        
        socket.on('user_status', (data) => {
            onlineUsers = data.onlineUsers;
            loadUsers();
        });
        
        // Handle incoming private messages
        socket.on('private_message', (data) => {
            if (currentChat === data.from) {
                displayMessage(data.from, data.message, data.timestamp, false);
            } else {
                // Notification for message from another user
                showAlert('New Message', `You have a new message from ${data.from}`);
                // Update unread counts
                loadUnreadCounts();
            }
        });
        
        // Handle incoming broadcast messages
        socket.on('broadcast_message', (data) => {
            if (currentChat === 'broadcast') {
                displayMessage(data.from, data.message, data.timestamp, true);
            } else {
                // Notification for broadcast if not in broadcast channel
                showAlert('Broadcast Message', `New broadcast message from ${data.from}`);
                // Update unread counts
                loadUnreadCounts();
            }
        });
        
        // Handle file receive
        socket.on('file_receive', (data) => {
            if ((currentChat === data.from) || (currentChat === 'broadcast' && data.to === 'broadcast')) {
                displayFileMessage(data.from, data.filename, data.fileData, data.fileType, data.timestamp);
            } else {
                // Notification for file message
                showAlert('New File', `You have received a file from ${data.from}`);
                // Update unread counts
                loadUnreadCounts();
            }
        });
        
        socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });
        
        socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            showAlert('Connection Error', 'Failed to connect to the server');
        });
        
        // Add a periodic check for unread messages
        setInterval(loadUnreadCounts, 10000); // Check every 10 seconds
        
        // Load unread counts initially
        loadUnreadCounts();
    }
    
    // Display message in the chat
    function displayMessage(sender, message, timestamp, isBroadcast) {
        const messageElement = document.createElement('div');
        const isOutgoing = sender === currentUser.username;
        
        if (isBroadcast) {
            messageElement.className = 'message message-broadcast';
            messageElement.innerHTML = `
                <div class="message-content">
                    <strong>${sender}:</strong> ${message}
                </div>
                <div class="message-info">
                    <span class="message-time">${formatTimestamp(timestamp)}</span>
                </div>
            `;
        } else {
            messageElement.className = `message ${isOutgoing ? 'message-outgoing' : 'message-incoming'}`;
            messageElement.innerHTML = `
                <div class="message-content">
                    ${!isOutgoing ? `<strong>${sender}:</strong> ` : ''}${message}
                </div>
                <div class="message-info">
                    <span class="message-time">${formatTimestamp(timestamp)}</span>
                </div>
            `;
        }
        
        messagesContainer.appendChild(messageElement);
        scrollToBottom();
    }
    
    // Display file message
    function displayFileMessage(sender, filename, fileData, fileType, timestamp) {
        const messageElement = document.createElement('div');
        const isOutgoing = sender === currentUser.username;
        
        // Determine file icon based on type
        const fileIcon = getFileIcon(fileType);
        
        messageElement.className = `message ${isOutgoing ? 'message-outgoing' : 'message-incoming'}`;
        
        // Create download link for file
        const fileUrl = `data:${fileType};base64,${fileData}`;
        
        messageElement.innerHTML = `
            <div class="file-message">
                <div class="file-icon">
                    <i class="fas ${fileIcon}"></i>
                </div>
                <div class="file-info">
                    <div class="file-name">
                        ${!isOutgoing ? `<strong>${sender}:</strong> ` : ''}
                        <a href="${fileUrl}" download="${filename}" target="_blank">${filename}</a>
                    </div>
                    <div class="message-info">
                        <span class="message-time">${formatTimestamp(timestamp)}</span>
                    </div>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(messageElement);
        scrollToBottom();
    }
    
    // Function to display file message placeholder (and load file data if needed)
    function displayFileMessagePlaceholder(sender, filename, timestamp, messageId) {
        const messageElement = document.createElement('div');
        const isOutgoing = sender === currentUser.username;
        
        messageElement.className = `message ${isOutgoing ? 'message-outgoing' : 'message-incoming'}`;
        messageElement.innerHTML = `
            <div class="file-message">
                <div class="file-icon">
                    <i class="fas fa-file"></i>
                </div>
                <div class="file-info">
                    <div class="file-name">
                        ${!isOutgoing ? `<strong>${sender}:</strong> ` : ''}
                        ${filename} 
                        <button class="btn btn-sm btn-outline-primary load-file-btn" data-message-id="${messageId}">
                            <i class="fas fa-download"></i> Load File
                        </button>
                    </div>
                    <div class="message-info">
                        <span class="message-time">${formatTimestamp(timestamp)}</span>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listener to load button
        const loadButton = messageElement.querySelector('.load-file-btn');
        loadButton.addEventListener('click', () => loadFile(messageId, messageElement));
        
        messagesContainer.appendChild(messageElement);
    }
    
    // Function to load file data
    async function loadFile(messageId, messageElement) {
        const loadButton = messageElement.querySelector('.load-file-btn');
        loadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        loadButton.disabled = true;
        
        try {
            const response = await fetch(`/api/file/${messageId}`);
            const data = await response.json();
            
            if (data.success) {
                // Replace placeholder with actual file
                const fileIcon = getFileIcon(data.fileType);
                const fileUrl = `data:${data.fileType};base64,${data.fileData}`;
                
                const fileInfoElement = messageElement.querySelector('.file-info');
                fileInfoElement.innerHTML = `
                    <div class="file-name">
                        <a href="${fileUrl}" download="${data.fileName}" target="_blank">${data.fileName}</a>
                    </div>
                    <div class="message-info">
                        <span class="message-time">${messageElement.querySelector('.message-time').textContent}</span>
                    </div>
                `;
                
                // Update icon
                messageElement.querySelector('.file-icon i').className = `fas ${fileIcon}`;
            } else {
                loadButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Failed';
                loadButton.disabled = false;
            }
        } catch (error) {
            console.error('Error loading file:', error);
            loadButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Failed';
            loadButton.disabled = false;
        }
    }
    
    // Helper function to get file icon based on type
    function getFileIcon(fileType) {
        let fileIcon = 'fa-file';
        if (fileType.startsWith('image/')) {
            fileIcon = 'fa-file-image';
        } else if (fileType.startsWith('video/')) {
            fileIcon = 'fa-file-video';
        } else if (fileType.startsWith('audio/')) {
            fileIcon = 'fa-file-audio';
        } else if (fileType.includes('pdf')) {
            fileIcon = 'fa-file-pdf';
        } else if (fileType.includes('word') || fileType.includes('document')) {
            fileIcon = 'fa-file-word';
        } else if (fileType.includes('excel') || fileType.includes('sheet')) {
            fileIcon = 'fa-file-excel';
        }
        return fileIcon;
    }
    
    // Format timestamp
    function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Scroll messages container to bottom
    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Add unread message counts
    function loadUnreadCounts() {
        if (!currentUser) return;
        
        fetch(`/api/unread-counts/${currentUser.username}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update broadcast channel
                    const broadcastCount = data.counts.broadcast;
                    const broadcastChannel = document.querySelector('.broadcast-channel');
                    
                    if (broadcastCount > 0 && currentChat !== 'broadcast') {
                        // Add or update badge
                        let badge = broadcastChannel.querySelector('.unread-badge');
                        if (!badge) {
                            badge = document.createElement('span');
                            badge.className = 'unread-badge badge bg-danger float-end';
                            broadcastChannel.appendChild(badge);
                        }
                        badge.textContent = broadcastCount;
                    }
                    
                    // Update private chats
                    data.counts.private.forEach(item => {
                        const userElement = document.querySelector(`.user-item[data-username="${item.sender}"]`);
                        if (userElement && currentChat !== item.sender) {
                            // Add or update badge
                            let badge = userElement.querySelector('.unread-badge');
                            if (!badge) {
                                badge = document.createElement('span');
                                badge.className = 'unread-badge badge bg-danger float-end';
                                userElement.appendChild(badge);
                            }
                            badge.textContent = item.count;
                        }
                    });
                }
            })
            .catch(error => console.error('Error loading unread counts:', error));
    }
    
    // Message form submission
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const message = messageInput.value.trim();
        if (!message) return;
        
        const timestamp = new Date().toISOString();
        
        if (currentChat === 'broadcast') {
            socket.emit('broadcast_message', { message, timestamp });
            displayMessage(currentUser.username, message, timestamp, true);
        } else {
            socket.emit('private_message', { to: currentChat, message, timestamp });
            displayMessage(currentUser.username, message, timestamp, false);
        }
        
        messageInput.value = '';
        messageInput.focus();
    });
    
    // File button click
    fileBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    // File input change
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const fileData = event.target.result.split(',')[1]; // Get base64 data
            const timestamp = new Date().toISOString();
            
            if (currentChat === 'broadcast') {
                socket.emit('file_share', {
                    to: 'broadcast',
                    filename: file.name,
                    fileData: fileData,
                    fileType: file.type,
                    timestamp
                });
            } else {
                socket.emit('file_share', {
                    to: currentChat,
                    filename: file.name,
                    fileData: fileData,
                    fileType: file.type,
                    timestamp
                });
            }
            
            // Display file locally
            displayFileMessage(
                currentUser.username,
                file.name,
                fileData,
                file.type,
                timestamp
            );
        };
        
        reader.readAsDataURL(file);
        fileInput.value = ''; // Clear the input
    });
    
    // Start at login screen
    showLoginScreen();
});
