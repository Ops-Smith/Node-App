// Load environment variables first
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// Environment variables with defaults
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data', 'messages.json');
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const CORS_ORIGINS = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000'];
const AUTO_DELETE_HOURS = parseInt(process.env.AUTO_DELETE_HOURS) || 24;

// Enhanced logging
function log(level, message) {
    const timestamp = new Date().toISOString();
    if (level === 'error' || (LOG_LEVEL === 'debug' && level === 'debug') || LOG_LEVEL === 'info') {
        console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
    }
}

// Ensure data directory and file exist with proper error handling
function ensureDataDirectory() {
    try {
        const dataDir = path.dirname(DATA_FILE);
        
        log('info', `Setting up data directory: ${dataDir}`);
        log('info', `Data file: ${DATA_FILE}`);
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(dataDir)) {
            log('info', `Creating data directory: ${dataDir}`);
            fs.mkdirSync(dataDir, { recursive: true });
            log('info', 'Data directory created successfully');
        } else {
            log('info', 'Data directory already exists');
        }
        
        // Check directory permissions
        try {
            const stats = fs.statSync(dataDir);
            log('info', `Directory permissions: ${stats.mode.toString(8)}`);
            log('info', `Directory owner: ${stats.uid}:${stats.gid}`);
        } catch (error) {
            log('warn', `Could not check directory stats: ${error.message}`);
        }
        
        // Create data file if it doesn't exist
        if (!fs.existsSync(DATA_FILE)) {
            log('info', `Creating initial data file: ${DATA_FILE}`);
            fs.writeFileSync(DATA_FILE, JSON.stringify([]));
            log('info', 'Data file created successfully');
        } else {
            log('info', 'Data file already exists');
        }
        
        // Test read/write permissions
        fs.accessSync(dataDir, fs.constants.R_OK | fs.constants.W_OK);
        log('info', 'Data directory is readable and writable');
        
        // Test file permissions
        fs.accessSync(DATA_FILE, fs.constants.R_OK | fs.constants.W_OK);
        log('info', 'Data file is readable and writable');
        
    } catch (error) {
        log('error', `CRITICAL: Failed to setup data directory: ${error.message}`);
        log('error', `Error details: ${error.code} - ${error.syscall}`);
        log('error', `Path: ${DATA_FILE}`);
        log('error', `Current working directory: ${process.cwd()}`);
        log('error', `User ID: ${process.getuid ? process.getuid() : 'N/A'}`);
        log('error', `Group ID: ${process.getgid ? process.getgid() : 'N/A'}`);
        
        // Don't exit immediately, let the server start but log the error
        log('warn', 'Server will start but data operations may fail');
    }
}

// CORS configuration - allow all in development, specific in production
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Allow all origins in development
        if (NODE_ENV === 'development') {
            return callback(null, true);
        }
        
        // In production, check against allowed origins
        if (CORS_ORIGINS.includes('*') || CORS_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            console.log(`CORS blocked: ${origin} not in ${CORS_ORIGINS.join(', ')}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    log('debug', `${req.method} ${req.path}`);
    next();
});

// Initialize data directory
ensureDataDirectory();

// Helper function to read messages
function readMessages() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        log('error', `Error reading messages: ${error.message}`);
        return [];
    }
}

// Helper function to write messages
function writeMessages(messages) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2));
        return true;
    } catch (error) {
        log('error', `Error writing messages: ${error.message}`);
        log('error', `Write error details: ${error.code} - ${error.syscall}`);
        return false;
    }
}

// Auto-deletion timer
let autoDeleteTimer = null;

function startAutoDeleteTimer(hours = AUTO_DELETE_HOURS) {
    if (autoDeleteTimer) {
        clearInterval(autoDeleteTimer);
    }

    const intervalMs = hours * 60 * 60 * 1000;
    
    autoDeleteTimer = setInterval(() => {
        const messages = readMessages();
        if (messages.length > 0) {
            const cutoffTime = new Date(Date.now() - intervalMs);
            const filteredMessages = messages.filter(msg => {
                return new Date(msg.timestamp) >= cutoffTime;
            });

            if (writeMessages(filteredMessages)) {
                const deletedCount = messages.length - filteredMessages.length;
                if (deletedCount > 0) {
                    log('info', `Auto-deleted ${deletedCount} messages older than ${hours} hours`);
                }
            }
        }
    }, intervalMs);

    log('info', `Auto-deletion timer started: deleting messages older than ${hours} hours`);
}

// Start auto-deletion with configured time
startAutoDeleteTimer();

// Routes

// Get all messages
app.get('/messages', (req, res) => {
    const messages = readMessages();
    res.json(messages);
});

// Add a new message
app.post('/messages', (req, res) => {
    const { text } = req.body;
    
    if (!text || text.trim() === '') {
        return res.status(400).json({ error: 'Message text is required' });
    }

    const messages = readMessages();
    const newMessage = {
        id: Date.now().toString(),
        text: text.trim(),
        timestamp: new Date().toISOString()
    };

    messages.push(newMessage);
    
    if (writeMessages(messages)) {
        log('info', `New message added: ${text.substring(0, 50)}...`);
        res.status(201).json(newMessage);
    } else {
        log('error', 'Failed to save message');
        res.status(500).json({ error: 'Failed to save message' });
    }
});

// Delete a specific message by ID
app.delete('/messages/:id', (req, res) => {
    const messageId = req.params.id;
    const messages = readMessages();
    
    const initialLength = messages.length;
    const filteredMessages = messages.filter(msg => msg.id !== messageId);
    
    if (filteredMessages.length === initialLength) {
        return res.status(404).json({ error: 'Message not found' });
    }

    if (writeMessages(filteredMessages)) {
        log('info', `Message ${messageId} deleted`);
        res.json({ 
            message: 'Message deleted successfully',
            deletedCount: 1
        });
    } else {
        log('error', `Failed to delete message ${messageId}`);
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

// Delete all messages
app.delete('/messages', (req, res) => {
    if (writeMessages([])) {
        log('info', 'All messages deleted');
        res.json({ message: 'All messages deleted successfully' });
    } else {
        log('error', 'Failed to delete all messages');
        res.status(500).json({ error: 'Failed to delete messages' });
    }
});

// Delete messages older than specified hours
app.delete('/messages/older-than', (req, res) => {
    const { hours } = req.body;
    
    if (!hours || isNaN(hours) || hours < 0) {
        return res.status(400).json({ error: 'Valid hours parameter is required' });
    }

    const messages = readMessages();
    const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    const filteredMessages = messages.filter(msg => {
        return new Date(msg.timestamp) >= cutoffTime;
    });

    if (writeMessages(filteredMessages)) {
        const deletedCount = messages.length - filteredMessages.length;
        log('info', `Deleted ${deletedCount} messages older than ${hours} hours`);
        res.json({ 
            message: `Messages older than ${hours} hours deleted successfully`,
            deletedCount: deletedCount
        });
    } else {
        log('error', `Failed to delete messages older than ${hours} hours`);
        res.status(500).json({ error: 'Failed to delete old messages' });
    }
});

// Set auto-deletion timer
app.post('/messages/auto-delete', (req, res) => {
    const { hours } = req.body;
    
    if (!hours || isNaN(hours) || hours < 0) {
        return res.status(400).json({ error: 'Valid hours parameter is required' });
    }

    startAutoDeleteTimer(hours);
    
    log('info', `Auto-deletion timer set to ${hours} hours`);
    res.json({ 
        message: `Auto-deletion timer set to ${hours} hours`,
        hours: hours
    });
});

// Get current auto-deletion settings
app.get('/messages/auto-delete', (req, res) => {
    res.json({ 
        autoDeleteEnabled: true,
        currentSetting: `${AUTO_DELETE_HOURS} hours`,
        configurable: true
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        service: 'backend'
    });
});

// Info endpoint
app.get('/info', (req, res) => {
    res.json({
        service: 'Simple Node.js Demo Backend',
        version: '1.0.0',
        environment: NODE_ENV,
        port: PORT,
        dataFile: DATA_FILE,
        autoDeleteHours: AUTO_DELETE_HOURS,
        corsOrigins: CORS_ORIGINS
    });
});

// ERROR HANDLER - MUST BE LAST
app.use((err, req, res, next) => {
    log('error', `Unhandled error: ${err.message}`);
    res.status(500).json({ 
        error: 'Internal server error',
        message: NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 HANDLER - MUST BE AFTER ALL ROUTES
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method
    });
});

// START THE SERVER
app.listen(PORT, HOST, () => {
    log('info', `Backend server running on http://${HOST}:${PORT}`);
    log('info', `Environment: ${NODE_ENV}`);
    log('info', `Data file: ${DATA_FILE}`);
    log('info', `Auto-deletion: ${AUTO_DELETE_HOURS} hours`);
    log('info', `CORS origins: ${CORS_ORIGINS.join(', ')}`);
});