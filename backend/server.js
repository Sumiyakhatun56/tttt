// Import required packages
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Middleware setup
// Middleware setup - More permissive CORS for local development
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://127.0.0.1:5500',
            'http://localhost:5500',
            'http://127.0.0.1:5501',
            'http://localhost:5501',
            'http://127.0.0.1:8080',
            'http://localhost:8080',
            'null' // For file:// protocol
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://127.0.0.1') || origin.startsWith('http://localhost')) {
            callback(null, true);
        } else {
            callback(null, true); // Allow all in development
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'greenthumb-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Initialize database tables with proper sequencing
function initializeDatabase() {
    // Serialize ensures tables are created in order before inserting data
    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT DEFAULT 'Gardener',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) console.error('Error creating users table:', err);
        });

        // Garden plots table
        db.run(`CREATE TABLE IF NOT EXISTS plots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plot_name TEXT NOT NULL,
            size TEXT,
            location TEXT,
            assigned_to INTEGER,
            status TEXT DEFAULT 'active',
            FOREIGN KEY (assigned_to) REFERENCES users(id)
        )`, (err) => {
            if (err) console.error('Error creating plots table:', err);
        });

        // Tasks table
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            due_date DATE,
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'pending',
            plot_id INTEGER,
            assigned_to INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (plot_id) REFERENCES plots(id),
            FOREIGN KEY (assigned_to) REFERENCES users(id)
        )`, (err) => {
            if (err) console.error('Error creating tasks table:', err);
        });

        // Project info table
        db.run(`CREATE TABLE IF NOT EXISTS project_info (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            course_title TEXT,
            course_code TEXT,
            section TEXT,
            phase TEXT,
            submission_date TEXT,
            submitted_to TEXT,
            institution TEXT
        )`, (err) => {
            if (err) console.error('Error creating project_info table:', err);
        });

        // Team members table
        db.run(`CREATE TABLE IF NOT EXISTS team_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            student_id TEXT NOT NULL,
            role TEXT
        )`, (err) => {
            if (err) console.error('Error creating team_members table:', err);
            else {
                // Insert demo data only after all tables are created
                insertDemoData();
            }
        });
    });
}

// Insert demo data
function insertDemoData() {
    // Check if demo user exists
    db.get('SELECT * FROM users WHERE username = ?', ['gardener1'], (err, row) => {
        if (err) {
            console.error('Error checking for demo user:', err);
            return;
        }
        
        if (!row) {
            // Use serialize to ensure proper sequencing
            db.serialize(() => {
                // Insert demo user
                db.run(`INSERT INTO users (username, email, password, full_name, role) 
                        VALUES (?, ?, ?, ?, ?)`,
                    ['gardener1', 'gardener@example.com', 'demo123', 'John Gardener', 'Gardener'],
                    function(err) {
                        if (err) {
                            console.error('Error inserting demo user:', err);
                            return;
                        }
                        
                        const userId = this.lastID;
                        
                        // Insert demo plots
                        db.run(`INSERT INTO plots (plot_name, size, location, assigned_to, status) 
                                VALUES (?, ?, ?, ?, ?)`,
                            ['North Garden', '10x10 ft', 'North Section', userId, 'active'],
                            function(err) {
                                if (err) console.error('Error inserting plot 1:', err);
                                
                                const plot1Id = this.lastID;
                                
                                // Insert tasks for plot 1
                                const tomorrow = new Date();
                                tomorrow.setDate(tomorrow.getDate() + 1);
                                const dueDate = tomorrow.toISOString().split('T')[0];
                                
                                db.run(`INSERT INTO tasks (title, description, due_date, priority, status, plot_id, assigned_to) 
                                        VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                    ['Water tomatoes', 'Water the tomato plants in the morning', dueDate, 'high', 'pending', plot1Id, userId],
                                    (err) => { if (err) console.error('Error inserting task 1:', err); });
                                
                                db.run(`INSERT INTO tasks (title, description, due_date, priority, status, plot_id, assigned_to) 
                                        VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                    ['Weed the garden', 'Remove weeds from the north section', dueDate, 'medium', 'pending', plot1Id, userId],
                                    (err) => { if (err) console.error('Error inserting task 2:', err); });
                            });

                        // Insert second plot
                        db.run(`INSERT INTO plots (plot_name, size, location, assigned_to, status) 
                                VALUES (?, ?, ?, ?, ?)`,
                            ['South Garden', '8x12 ft', 'South Section', userId, 'active'],
                            function(err) {
                                if (err) console.error('Error inserting plot 2:', err);
                                
                                const plot2Id = this.lastID;
                                const tomorrow = new Date();
                                tomorrow.setDate(tomorrow.getDate() + 1);
                                const dueDate = tomorrow.toISOString().split('T')[0];
                                
                                db.run(`INSERT INTO tasks (title, description, due_date, priority, status, plot_id, assigned_to) 
                                        VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                    ['Harvest carrots', 'Harvest mature carrots from south garden', dueDate, 'low', 'pending', plot2Id, userId],
                                    (err) => { if (err) console.error('Error inserting task 3:', err); });
                            });
                    });

                // Insert project info
                db.run(`INSERT INTO project_info (title, course_title, course_code, section, phase, submission_date, submitted_to, institution) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    ['GreenThumb Connect', 'Web Application Development', 'CSE470', 'Section 1', 'Final Project', 'January 2026', 'Dr. Smith', 'University of Technology'],
                    (err) => { if (err) console.error('Error inserting project info:', err); });

                // Insert team members
                db.run(`INSERT INTO team_members (name, student_id, role) VALUES (?, ?, ?)`, 
                    ['Alice Johnson', '2021001', 'Frontend Developer'],
                    (err) => { if (err) console.error('Error inserting team member 1:', err); });
                    
                db.run(`INSERT INTO team_members (name, student_id, role) VALUES (?, ?, ?)`, 
                    ['Bob Smith', '2021002', 'Backend Developer'],
                    (err) => { if (err) console.error('Error inserting team member 2:', err); });
                    
                db.run(`INSERT INTO team_members (name, student_id, role) VALUES (?, ?, ?)`, 
                    ['Carol White', '2021003', 'Database Designer'],
                    (err) => { if (err) console.error('Error inserting team member 3:', err); });
                    
                db.run(`INSERT INTO team_members (name, student_id, role) VALUES (?, ?, ?)`, 
                    ['David Brown', '2021004', 'UI/UX Designer'],
                    (err) => { 
                        if (err) console.error('Error inserting team member 4:', err);
                        else console.log('✓ Demo data inserted successfully');
                    });
            });
        } else {
            console.log('✓ Demo data already exists');
        }
    });
}

// ==================== API ROUTES ====================

app.get('/api/plots', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    db.all('SELECT * FROM plots WHERE assigned_to = ? OR assigned_to IS NULL', 
        [req.session.userId],
        (err, plots) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(plots || []);
        });
});

// Create new task - ADD THIS TO SERVER.JS
app.post('/api/tasks', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { title, description, due_date, priority, plot_id, status } = req.body;

    db.run(
        `INSERT INTO tasks (title, description, due_date, priority, status, plot_id, assigned_to) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [title, description, due_date, priority, status || 'pending', plot_id, req.session.userId],
        function(err) {
            if (err) {
                console.error('Error creating task:', err);
                return res.status(500).json({ error: 'Failed to create task' });
            }
            res.json({ 
                success: true, 
                taskId: this.lastID,
                message: 'Task created successfully'
            });
        }
    );
});










// Check authentication


app.get('/api/check-auth', (req, res) => {
    if (req.session.userId) {
        db.get('SELECT id, username, email, full_name, role FROM users WHERE id = ?', 
            [req.session.userId], 
            (err, user) => {
                if (err || !user) {
                    return res.json({ authenticated: false });
                }
                res.json({ authenticated: true, user });
            });
    } else {
        res.json({ authenticated: false });
    }
});

// Login endpoint
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE (username = ? OR email = ?) AND password = ?',
        [username, username, password],
        (err, user) => {
            if (err) {
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            if (!user) {
                return res.status(401).json({ success: false, error: 'Invalid credentials' });
            }

            req.session.userId = user.id;
            req.session.username = user.username;

            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    full_name: user.full_name,
                    role: user.role
                }
            });
        });
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ success: false, error: 'Logout failed' });
        }
        res.json({ success: true });
    });
});

// Get dashboard stats
app.get('/api/dashboard/stats', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const stats = {
        activePlants: 42,
        gardenHealth: 85,
        pendingTasks: 0,
        taskCompletion: 0,
        activeGardeners: 12,
        participationRate: 78,
        upcomingEvents: 3
    };

    db.get('SELECT COUNT(*) as count FROM tasks WHERE status = "pending"', (err, row) => {
        if (!err && row) {
            stats.pendingTasks = row.count;
        }

        db.get('SELECT COUNT(*) as total, SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) as completed FROM tasks', 
            (err, row) => {
                if (!err && row && row.total > 0) {
                    stats.taskCompletion = Math.round((row.completed / row.total) * 100);
                }
                res.json(stats);
            });
    });
});

// Get dashboard tasks
app.get('/api/dashboard/tasks', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    db.all(`SELECT tasks.*, plots.plot_name 
            FROM tasks 
            LEFT JOIN plots ON tasks.plot_id = plots.id 
            WHERE tasks.assigned_to = ? 
            ORDER BY tasks.due_date ASC 
            LIMIT 10`,
        [req.session.userId],
        (err, tasks) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(tasks || []);
        });
});

// Update task status
app.put('/api/tasks/:id', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { id } = req.params;
    const { status } = req.body;

    db.run('UPDATE tasks SET status = ? WHERE id = ?', [status, id], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true });
    });
});

// Get project info
app.get('/api/project', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    db.get('SELECT * FROM project_info LIMIT 1', (err, project) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        db.all('SELECT * FROM team_members', (err, teamMembers) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ project: project || {}, teamMembers: teamMembers || [] });
        });
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🌱 GreenThumb Connect Backend Server`);
    console.log(`======================================`);
    console.log(`✓ Server running on: http://localhost:${PORT}`);
    console.log(`✓ Database: SQLite (database.db)`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`======================================\n`);
    console.log(`Demo Login Credentials:`);
    console.log(`  Username: gardener1 or gardener@example.com`);
    console.log(`  Password: demo123\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('\nDatabase connection closed.');
        process.exit(0);
    });
});
