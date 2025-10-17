// Use environment variable or default - this can be set via Docker environment
const BACKEND_URL = window.BACKEND_URL || '/api';

// Global variables
let autoRefreshInterval = null;

// Check backend status on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    checkBackendStatus();
    loadMessages();
    loadAutoDeleteSettings();
    setupEventListeners();
    startAutoRefresh();
}

function setupEventListeners() {
    // Enter key support for message input
    const messageInput = document.getElementById('messageInput');
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addMessage();
        }
    });

    // Enter key support for auto-delete input
    const autoDeleteInput = document.getElementById('autoDeleteInput');
    autoDeleteInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            setAutoDelete();
        }
    });

    // Enter key support for hours input
    const hoursInput = document.getElementById('hoursInput');
    hoursInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            clearMessagesOlderThan();
        }
    });
}

function startAutoRefresh() {
    // Refresh messages every 30 seconds
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    autoRefreshInterval = setInterval(() => {
        loadMessages();
        checkBackendStatus();
    }, 30000); // 30 seconds
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

async function checkBackendStatus() {
    try {
        const response = await fetch(`${BACKEND_URL}/health`);
        if (response.ok) {
            const health = await response.json();
            document.getElementById('backendStatus').textContent = `Connected (${health.environment})`;
            document.getElementById('backendStatus').className = 'status-connected';
        } else {
            throw new Error('Backend not healthy');
        }
    } catch (error) {
        document.getElementById('backendStatus').textContent = 'Disconnected';
        document.getElementById('backendStatus').className = 'status-disconnected';
    }
}

async function loadMessages() {
    const messagesList = document.getElementById('messagesList');
    const loadingHtml = '<div class="loading">Loading messages...</div>';
    
    // Only show loading if not already loading
    if (!messagesList.innerHTML.includes('loading')) {
        messagesList.innerHTML = loadingHtml;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/messages`);
        if (!response.ok) throw new Error('Failed to fetch messages');
        
        const messages = await response.json();
        
        if (messages.length === 0) {
            messagesList.innerHTML = '<div class="loading">No messages found. Send your first message!</div>';
            return;
        }

        // Sort messages by timestamp (newest first)
        messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        messagesList.innerHTML = messages.map(msg => `
            <div class="message-item" data-id="${msg.id}">
                <div class="message-content">
                    <div class="message-text">${escapeHtml(msg.text)}</div>
                    <div class="message-time">${formatTimestamp(msg.timestamp)}</div>
                </div>
                <button class="delete-btn" onclick="deleteMessage('${msg.id}')" title="Delete this message">
                    ×
                </button>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading messages:', error);
        messagesList.innerHTML = '<div class="error">Failed to load messages. Check if backend is running.</div>';
    }
}

async function deleteMessage(messageId) {
    if (!confirm('Are you sure you want to delete this message?')) {
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/messages/${messageId}`, {
            method: 'DELETE',
        });

        if (!response.ok) throw new Error('Failed to delete message');

        showSuccess('Message deleted successfully');
        loadMessages();
        checkBackendStatus();
    } catch (error) {
        console.error('Error deleting message:', error);
        showError('Failed to delete message. Check backend connection.');
    }
}

async function addMessage() {
    const messageInput = document.getElementById('messageInput');
    const text = messageInput.value.trim();

    if (!text) {
        showError('Please enter a message');
        return;
    }

    // Disable button during request
    const button = document.querySelector('button[onclick="addMessage()"]');
    const originalText = button.textContent;
    button.textContent = 'Sending...';
    button.disabled = true;

    try {
        const response = await fetch(`${BACKEND_URL}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add message');
        }

        messageInput.value = '';
        showSuccess('Message added successfully');
        loadMessages();
        checkBackendStatus();
    } catch (error) {
        console.error('Error adding message:', error);
        showError(error.message || 'Failed to add message. Check backend connection.');
    } finally {
        // Re-enable button
        button.textContent = originalText;
        button.disabled = false;
    }
}

async function deleteAllMessages() {
    if (!confirm('Are you sure you want to delete ALL messages? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/messages`, {
            method: 'DELETE',
        });

        if (!response.ok) throw new Error('Failed to delete messages');

        showSuccess('All messages deleted successfully');
        loadMessages();
        checkBackendStatus();
    } catch (error) {
        console.error('Error deleting all messages:', error);
        showError('Failed to delete messages. Check backend connection.');
    }
}

async function clearMessagesOlderThan() {
    const hoursInput = document.getElementById('hoursInput');
    const hours = parseInt(hoursInput.value);

    if (!hours || hours < 1) {
        showError('Please enter a valid number of hours (minimum 1)');
        return;
    }

    if (!confirm(`Are you sure you want to delete messages older than ${hours} hours?`)) {
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/messages/older-than`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ hours }),
        });

        const result = await response.json();
        
        if (response.ok) {
            showSuccess(result.message || `Deleted ${result.deletedCount} messages older than ${hours} hours`);
        } else {
            // Handle cases like "Message not found" gracefully
            if (result.error === 'Message not found') {
                showSuccess('No messages found older than the specified time');
            } else {
                showError(result.error || 'Failed to delete old messages');
            }
        }
        
        loadMessages();
        checkBackendStatus();
    } catch (error) {
        console.error('Error clearing old messages:', error);
        showError('Failed to delete old messages. Check backend connection.');
    }
}

async function setAutoDelete() {
    const autoDeleteInput = document.getElementById('autoDeleteInput');
    const hours = parseInt(autoDeleteInput.value);

    if (!hours || hours < 1) {
        showError('Please enter a valid number of hours (minimum 1)');
        return;
    }

    if (!confirm(`Set auto-deletion to delete messages older than ${hours} hours?`)) {
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/messages/auto-delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ hours }),
        });

        if (!response.ok) throw new Error('Failed to set auto-deletion');

        const result = await response.json();
        showSuccess(result.message || 'Auto-deletion timer set successfully');
        loadAutoDeleteSettings();
    } catch (error) {
        console.error('Error setting auto-delete:', error);
        showError('Failed to set auto-deletion. Check backend connection.');
    }
}

async function loadAutoDeleteSettings() {
    try {
        const response = await fetch(`${BACKEND_URL}/messages/auto-delete`);
        if (response.ok) {
            const settings = await response.json();
            document.getElementById('autoDeleteStatus').textContent = 
                `Auto-deletion: ${settings.currentSetting || '24 hours'}`;
            // Update the input field to match current setting
            const hours = parseInt(settings.currentSetting) || 24;
            document.getElementById('autoDeleteInput').value = hours;
        }
    } catch (error) {
        console.error('Error loading auto-delete settings:', error);
        document.getElementById('autoDeleteStatus').textContent = 'Auto-deletion: Unknown';
    }
}

// Utility functions
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    return date.toLocaleString();
}

function showSuccess(message) {
    showMessage(message, 'success');
}

function showError(message) {
    showMessage(message, 'error');
}

function showMessage(message, type) {
    // Remove any existing messages
    const existingMessages = document.querySelectorAll('.message-notification');
    existingMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-notification ${type}`;
    messageDiv.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" class="close-btn">×</button>
    `;
    
    // Add styles for the notification
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 4px;
        color: white;
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: 400px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    
    if (type === 'success') {
        messageDiv.style.backgroundColor = '#27ae60';
    } else {
        messageDiv.style.backgroundColor = '#e74c3c';
    }
    
    const closeBtn = messageDiv.querySelector('.close-btn');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    document.body.appendChild(messageDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentElement) {
            messageDiv.remove();
        }
    }, 5000);
}

// Export functions for global access
window.addMessage = addMessage;
window.deleteMessage = deleteMessage;
window.deleteAllMessages = deleteAllMessages;
window.clearMessagesOlderThan = clearMessagesOlderThan;
window.setAutoDelete = setAutoDelete;
window.loadMessages = loadMessages;
window.checkBackendStatus = checkBackendStatus;