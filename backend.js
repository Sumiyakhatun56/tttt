const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cors = require('cors');
const session = require('express-session');

const app = express();
const PORT = 3000;

// Middleware
// More flexible CORS configuration for development
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // List of allowed origins
        const allowedOrigins = [
            'http://localhost:8080',
            'http://localhost:5500',
            'http://127.0.0.1:8080',
            'http://127.0.0.1:5500',
            'http://192.168.68.80:8080'
        ];
        
        if (allowedOrigins.includes(origin) || origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return callback(null, true);
        }
        
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests for all routes
app.options('*', cors());
app.use(express.json());
app.use(session({
    secret: 'greenthumb-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Initialize database
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    // Read and execute SQL from file
    const fs = require('fs');
    const sql = fs.readFileSync('./database.sql', 'utf8');
    
    db.exec(sql, (err) => {
        if (err) {
            console.error('Error initializing database:', err.message);
        } else {
            console.log('Database initialized successfully');
            // Update demo user password
            updateDemoUserPassword();
        }
    });
}

async function updateDemoUserPassword() {
    const demoPassword = 'demo123';
    const hashedPassword = await bcrypt.hash(demoPassword, 10);
    
    db.run(
        `UPDATE users SET password = ? WHERE username = 'gardener1'`,
        [hashedPassword],
        (err) => {
            if (err) {
                console.error('Error updating password:', err.message);
            } else {
                console.log('Demo user password updated');
            }
        }
    );
}

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
};

// API Routes

// 1. Login endpoint
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    db.get(
        `SELECT * FROM users WHERE username = ? OR email = ?`,
        [username, username],
        async (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            
            try {
                const passwordMatch = await bcrypt.compare(password, user.password);
                
                if (passwordMatch) {
                    // Remove password from user object
                    const { password, ...userWithoutPassword } = user;
                    
                    // Store user in session
                    req.session.user = userWithoutPassword;
                    
                    res.json({
                        success: true,
                        user: userWithoutPassword,
                        message: 'Login successful'
                    });
                } else {
                    res.status(401).json({ error: 'Invalid credentials' });
                }
            } catch (error) {
                res.status(500).json({ error: 'Authentication error' });
            }
        }
    );
});

// 2. Check authentication status
app.get('/api/check-auth', (req, res) => {
    if (req.session.user) {
        res.json({
            authenticated: true,
            user: req.session.user
        });
    } else {
        res.json({
            authenticated: false,
            user: null
        });
    }
});

// 3. Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// 4. Dashboard stats
app.get('/api/dashboard/stats', requireAuth, (req, res) => {
    const userId = req.session.user.id;
    
    db.get(`
        SELECT 
            (SELECT COUNT(*) FROM garden_plots WHERE gardener_id = ? AND status = 'active') as activePlants,
            (SELECT COUNT(*) FROM tasks WHERE assigned_to = ? AND status = 'pending') as pendingTasks,
            (SELECT COUNT(DISTINCT gardener_id) FROM garden_plots WHERE gardener_id IS NOT NULL) as activeGardeners,
            (SELECT COUNT(*) FROM tasks WHERE due_date >= DATE('now') AND status = 'pending') as upcomingEvents,
            75 as gardenHealth,
            60 as taskCompletion,
            85 as participationRate
    `, [userId, userId], (err, stats) => {
        if (err) {
            console.error('Error fetching stats:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(stats);
    });
});

// 5. Dashboard tasks
app.get('/api/dashboard/tasks', requireAuth, (req, res) => {
    const userId = req.session.user.id;
    
    db.all(`
        SELECT * FROM tasks 
        WHERE assigned_to = ? 
        ORDER BY 
            CASE priority 
                WHEN 'high' THEN 1 
                WHEN 'medium' THEN 2 
                WHEN 'low' THEN 3 
            END,
            due_date ASC
        LIMIT 10
    `, [userId], (err, tasks) => {
        if (err) {
            console.error('Error fetching tasks:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(tasks);
    });
});

// 6. Update task status
app.put('/api/tasks/:id', requireAuth, (req, res) => {
    const taskId = req.params.id;
    const { status } = req.body;
    const userId = req.session.user.id;
    
    db.run(
        `UPDATE tasks SET status = ? WHERE id = ? AND assigned_to = ?`,
        [status, taskId, userId],
        function(err) {
            if (err) {
                console.error('Error updating task:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Task not found or not authorized' });
            }
            
            res.json({ 
                success: true, 
                message: 'Task updated successfully',
                changes: this.changes 
            });
        }
    );
});

// 7. Project information
app.get('/api/project', requireAuth, (req, res) => {
    const project = {
        title: "GreenThumb Connect - Community Garden Platform",
        course_title: "Advanced Web Development",
        course_code: "COMP-498",
        section: "01",
        phase: "Final Project",
        submission_date: "December 15, 2024",
        submitted_to: "Dr. Smith",
        institution: "University of Technology"
    };
    
    const teamMembers = [
        { name: "John Doe", student_id: "S12345678" },
        { name: "Jane Smith", student_id: "S23456789" },
        { name: "Bob Johnson", student_id: "S34567890" },
        { name: "Alice Williams", student_id: "S45678901" }
    ];
    
    res.json({
        project,
        teamMembers
    });
});

// 8. Get user's garden plots
app.get('/api/garden-plots', requireAuth, (req, res) => {
    const userId = req.session.user.id;
    
    db.all(
        `SELECT * FROM garden_plots WHERE gardener_id = ? ORDER BY plot_name`,
        [userId],
        (err, plots) => {
            if (err) {
                console.error('Error fetching garden plots:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(plots);
        }
    );
});

// 9. Create new task
app.post('/api/tasks', requireAuth, (req, res) => {
    const { title, description, priority, due_date, plot_name } = req.body;
    const userId = req.session.user.id;
    
    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
    }
    
    db.run(
        `INSERT INTO tasks (title, description, priority, due_date, plot_name, assigned_to, status) 
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [title, description || '', priority || 'medium', due_date || null, plot_name || null, userId],
        function(err) {
            if (err) {
                console.error('Error creating task:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json({
                success: true,
                message: 'Task created successfully',
                taskId: this.lastID
            });
        }
    );
});

// 10. Search endpoint
app.get('/api/search', requireAuth, (req, res) => {
    const query = req.query.q;
    const userId = req.session.user.id;
    
    if (!query || query.trim() === '') {
        return res.json({ tasks: [], plots: [] });
    }
    
    const searchTerm = `%${query}%`;
    
    db.all(`
        SELECT * FROM tasks 
        WHERE assigned_to = ? 
        AND (title LIKE ? OR description LIKE ? OR plot_name LIKE ?)
        LIMIT 10
    `, [userId, searchTerm, searchTerm, searchTerm], (err, tasks) => {
        if (err) {
            console.error('Search error:', err);
            return res.status(500).json({ error: 'Search failed' });
        }
        
        db.all(`
            SELECT * FROM garden_plots 
            WHERE gardener_id = ? 
            AND (plot_name LIKE ? OR plant_type LIKE ?)
            LIMIT 10
        `, [userId, searchTerm, searchTerm], (err, plots) => {
            if (err) {
                console.error('Search error:', err);
                return res.status(500).json({ error: 'Search failed' });
            }
            
            res.json({ tasks, plots });
        });
    });
});

// Change this (around line 264):
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on http://0.0.0.0:${PORT}`);
    console.log(`You can access it from:`);
    console.log(`- Local: http://localhost:${PORT}`);
    console.log(`- Network: http://192.168.68.80:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});