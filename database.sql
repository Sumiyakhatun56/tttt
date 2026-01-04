-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'gardener',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'medium',
    due_date DATE,
    assigned_to INTEGER,
    plot_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(id)
);

-- Create garden_plots table
CREATE TABLE IF NOT EXISTS garden_plots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plot_name TEXT NOT NULL,
    gardener_id INTEGER,
    plant_type TEXT,
    status TEXT DEFAULT 'active',
    area_sqft REAL,
    last_watered DATE,
    FOREIGN KEY (gardener_id) REFERENCES users(id)
);

-- Insert demo user
INSERT OR IGNORE INTO users (username, email, password, full_name, role) 
VALUES ('gardener1', 'gardener@example.com', '$2b$10$YourHashedPasswordHere', 'Alex Green', 'gardener');

-- Insert sample tasks
INSERT OR IGNORE INTO tasks (title, description, status, priority, due_date, assigned_to, plot_name) VALUES
('Water tomato plants', 'Water the tomato plants in plot A-3', 'pending', 'high', DATE('now', '+1 day'), 1, 'Plot A-3'),
('Weed the herb garden', 'Remove weeds from the herb garden section', 'pending', 'medium', DATE('now', '+2 days'), 1, 'Herb Garden'),
('Harvest lettuce', 'Harvest mature lettuce heads', 'completed', 'low', DATE('now', '-1 day'), 1, 'Plot B-2'),
('Add compost', 'Add compost to all plots', 'pending', 'medium', DATE('now', '+3 days'), 1, 'All Plots');

-- Insert sample garden plots
INSERT OR IGNORE INTO garden_plots (plot_name, gardener_id, plant_type, status, area_sqft) VALUES
('Plot A-3', 1, 'Tomatoes', 'active', 25.5),
('Herb Garden', 1, 'Mixed Herbs', 'active', 15.0),
('Plot B-2', 1, 'Lettuce', 'active', 20.0),
('Plot C-1', NULL, 'Empty', 'available', 30.0);