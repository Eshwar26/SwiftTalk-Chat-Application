// add-students.js - Script to add your class students to the database
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

// Connect to the database
const db = new sqlite3.Database('./chat.db');

// 70 placeholder student names - REPLACE THESE with your actual classmates' names
const studentNames = [
    "student_1", "student_2", "student_3", "student_4", "student_5",
    "student_6", "student_7", "student_8", "student_9", "student_10",
    "student_11", "student_12", "student_13", "student_14", "student_15",
    "student_16", "student_17", "student_18", "student_19", "student_20",
    "student_21", "student_22", "student_23", "student_24", "student_25",
    "student_26", "student_27", "student_28", "student_29", "student_30",
    "student_31", "student_32", "student_33", "student_34", "student_35",
    "student_36", "student_37", "student_38", "student_39", "student_40",
    "student_41", "student_42", "student_43", "student_44", "student_45",
    "student_46", "student_47", "student_48", "student_49", "student_50",
    "student_51", "student_52", "student_53", "student_54", "student_55",
    "student_56", "student_57", "student_58", "student_59", "student_60",
    "student_61", "student_62", "student_63", "student_64", "student_65",
    "student_66", "student_67", "student_68", "student_69", "student_70"
];

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
    
    // Hash the default password
    bcrypt.hash('password', 10, (err, hash) => {
        if (err) {
            console.error('Error hashing password:', err);
            db.close();
            return;
        }
        
        // Create a prepared statement for better performance
        const stmt = db.prepare(`INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)`);
        
        // Insert each student account
        let insertCount = 0;
        studentNames.forEach(username => {
            stmt.run(username, hash, function(err) {
                if (err) {
                    console.error(`Error adding user ${username}:`, err);
                } else if (this.changes > 0) {
                    insertCount++;
                    console.log(`Added user: ${username}`);
                }
            });
        });
        
        // Finalize the statement
        stmt.finalize(() => {
            console.log(`Successfully added ${insertCount} student accounts with default password: "password"`);
            
            // List all users in the database
            db.all(`SELECT username FROM users ORDER BY username`, (err, rows) => {
                if (err) {
                    console.error('Error retrieving users:', err);
                } else {
                    console.log('\nTotal users in database:', rows.length);
                    console.log('User list:');
                    rows.forEach((row, index) => {
                        console.log(`${index + 1}. ${row.username}`);
                    });
                }
                
                // Close the database connection
                db.close();
            });
        });
    });
});