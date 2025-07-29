// =======================================================================
// PROJECT-MANAGER.JS - Project Management & Auto-save System
// Handles project saving, loading, auto-save, and recovery functionality
// =======================================================================

// Project management variables
var currentProjectName = 'Untitled Book Project';
var lastSaveTime = null;
var autoSaveInterval = null;
var hasUnsavedChanges = false;
var projectSettings = {
    bookType: 'text',
    bookSize: 'standard',
    charactersPerPage: 1800,
    illustrationFreq: 'none'
};

// =======================================================================
// INITIALIZATION FUNCTIONS
// =======================================================================

function initializeProjectManagement() {
    logToDebug('Initializing project management system...', 'save');
    
    // Add project management UI
    addProjectManagementUI();
    
    // Start auto-save timer
    startAutoSave();
    
    // Set up beforeunload handler
    window.addEventListener('beforeunload', function(e) {
        if (hasUnsavedChanges) {
            var message = 'You have unsaved changes. Are you sure you want to leave?';
            e.returnValue = message;
            return message;
        }
    });
    
    logToDebug('Project management initialized', 'success');
}

function addProjectManagementUI() {
    var header = document.querySelector('.header');
    
    // Create project management bar
    var projectBar = document.createElement('div');
    projectBar.id = 'projectBar';
    projectBar.style.cssText = 'background: rgba(255,255,255,0.1); padding: 15px 30px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; border-top: 1px solid rgba(255,255,255,0.2);';
    
    // Project name and status
    var projectInfo = document.createElement('div');
    projectInfo.style.cssText = 'display: flex; align-items: center; gap: 15px; flex-wrap: wrap;';
    projectInfo.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-weight: bold; font-size: 1.1em;">📚 ${currentProjectName}</span>
            <span id="saveStatus" style="font-size: 0.9em; opacity: 0.8;">Ready</span>
        </div>
        <input type="text" id="projectNameInput" placeholder="Enter project name" 
               style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); 
                      padding: 8px 12px; border-radius: 6px; color: white; font-size: 0.9em; min-width: 200px;"
               value="${currentProjectName}">
    `;
    
    // Project actions
    var projectActions = document.createElement('div');
    projectActions.style.cssText = 'display: flex; gap: 10px; flex-wrap: wrap;';
    projectActions.innerHTML = `
        <button onclick="saveProject()" class="project-button save-btn">💾 Save Project</button>
        <button onclick="loadProject()" class="project-button load-btn">📁 Load Project</button>
        <button onclick="newProject()" class="project-button new-btn">📄 New Project</button>
        <button onclick="showProjectHistory()" class="project-button history-btn">🕒 History</button>
    `;
    
    projectBar.appendChild(projectInfo);
    projectBar.appendChild(projectActions);
    header.appendChild(projectBar);
    
    // Project name input handler
    document.getElementById('projectNameInput').addEventListener('input', function(e) {
        currentProjectName = e.target.value || 'Untitled Book Project';
        updateProjectDisplay();
        markAsChanged();
    });
}

function checkForRecoveryData() {
    try {
        var recoveryData = localStorage.getItem('bookLayout_recovery');
        if (recoveryData) {
            var data = JSON.parse(recoveryData);
            var timeDiff = Date.now() - data.timestamp;
            
            // Show recovery option if data is less than 24 hours old
            if (timeDiff < 24 * 60 * 60 * 1000) {
                showRecoveryDialog(data);
            } else {
                // Clean up old recovery data
                localStorage.removeItem('bookLayout_recovery');
            }
        }
    } catch (err) {
        logToDebug('Error checking recovery data: ' + err.message, 'error');
    }
}

function showRecoveryDialog(recoveryData) {
    var dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
        background: rgba(0,0,0,0.7); z-index: 10000; 
        display: flex; align-items: center; justify-content: center;
    `;
    
    var recoveryTime = new Date(recoveryData.timestamp).toLocaleString();
    
    dialog.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; max-width: 500px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
            <h2 style="color: #ff6b6b; margin-bottom: 20px;">🔄 Unsaved Work Detected</h2>
            <p style="margin-bottom: 20px; line-height: 1.6;">
                We found unsaved work from <strong>${recoveryTime}</strong><br>
                Project: <strong>${recoveryData.projectName}</strong><br>
                Pages: <strong>${recoveryData.pages ? recoveryData.pages.length : 0}</strong>
            </p>
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button onclick="recoverProject()" style="background: #28a745; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: bold;">
                    ✅ Recover Work
                </button>
                <button onclick="dismissRecovery()" style="background: #dc3545; color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: bold;">
                    ❌ Start Fresh
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    window.recoverProject = function() {
        try {
            loadProjectData(recoveryData);
            localStorage.removeItem('bookLayout_recovery');
            document.body.removeChild(dialog);
            showStatus('Previous work recovered successfully!', 'success');
            logToDebug('Recovery successful', 'success');
        } catch (err) {
            showStatus('Error recovering data: ' + err.message, 'error');
            logToDebug('Recovery error: ' + err.message, 'error');
        }
    };
    
    window.dismissRecovery = function() {
        localStorage.removeItem('bookLayout_recovery');
        document.body.removeChild(dialog);
        showStatus('Starting with fresh project', 'success');
    };
}

// =======================================================================
// AUTO-SAVE FUNCTIONS
// =======================================================================

function startAutoSave() {
    // Auto-save every 30 seconds
    autoSaveInterval = setInterval(function() {
        if (hasUnsavedChanges && processedPages.length > 0) {
            autoSaveToLocal();
        }
    }, 30000); // 30 seconds
    
    logToDebug('Auto-save started (30 second intervals)', 'save');
}

function autoSaveToLocal() {
    try {
        var projectData = getCurrentProjectData();
        localStorage.setItem('bookLayout_recovery', JSON.stringify(projectData));
        logToDebug('Auto-save completed to local storage', 'save');
        updateSaveStatus('Auto-saved at ' + new Date().toLocaleTimeString());
    } catch (err) {
        logToDebug('Auto-save error: ' + err.message, 'error');
    }
}

function markAsChanged() {
    hasUnsavedChanges = true;
    updateSaveStatus('Modified');
}

function markAsSaved() {
    hasUnsavedChanges = false;
    lastSaveTime = Date.now();
    updateSaveStatus('Saved at ' + new Date().toLocaleTimeString());
}

function updateSaveStatus(status) {
    var saveStatus = document.getElementById('saveStatus');
    if (saveStatus) {
        saveStatus.textContent = status;
        saveStatus.style.color = hasUnsavedChanges ? '#ffeb3b' : '#4caf50';
    }
}

function updateProjectDisplay() {
    var projectInfo = document.querySelector('#projectBar div span');
    if (projectInfo) {
        projectInfo.textContent = '📚 ' + currentProjectName;
    }
}

// =======================================================================
// PROJECT DATA FUNCTIONS
// =======================================================================

function getCurrentProjectData() {
    return {
        projectName: currentProjectName,
        timestamp: Date.now(),
        version: '2.0',
        settings: {
            bookType: document.getElementById('bookType').value,
            bookSize: document.getElementById('bookSize').value,
            charactersPerPage: parseInt(document.getElementById('charactersPerPage').value),
            illustrationFreq: document.getElementById('illustrationFreq').value
        },
        documentStructure: documentStructure,
        pages: processedPages.map(function(page) {
            return {
                number: page.number,
                content: page.content,
                characterCount: page.characterCount,
                images: page.images || [],
                hasIllustration: page.hasIllustration || false
            };
        }),
        metadata: {
            totalPages: processedPages.length,
            totalCharacters: processedPages.reduce(function(total, page) {
                return total + page.characterCount;
            }, 0),
            createdDate: lastSaveTime || Date.now(),
            lastModified: Date.now()
        }
    };
}

// =======================================================================
// SAVE/LOAD FUNCTIONS
// =======================================================================

function saveProject() {
    try {
        var projectData = getCurrentProjectData();
        var dataStr = JSON.stringify(projectData, null, 2);
        var dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        var fileName = currentProjectName.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.bookproject';
        
        var url = URL.createObjectURL(dataBlob);
        var a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        
        markAsSaved();
        showStatus('Project saved successfully as ' + fileName, 'success');
        logToDebug('Project saved: ' + fileName, 'save');
        
        // Also save to project history
        saveToProjectHistory(projectData);
        
    } catch (err) {
        showStatus('Error saving project: ' + err.message, 'error');
        logToDebug('Save error: ' + err.message, 'error');
    }
}

function loadProject() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bookproject,.json';
    
    input.onchange = function(e) {
        var file = e.target.files[0];
        if (!file) return;
        
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var projectData = JSON.parse(e.target.result);
                
                if (hasUnsavedChanges) {
                    if (!confirm('You have unsaved changes. Loading a project will lose these changes. Continue?')) {
                        return;
                    }
                }
                
                loadProjectData(projectData);
                showStatus('Project loaded successfully!', 'success');
                logToDebug('Project loaded: ' + projectData.projectName, 'save');
                
            } catch (err) {
                showStatus('Error loading project: ' + err.message, 'error');
                logToDebug('Load error: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

function loadProjectData(projectData) {
    // Validate project data
    if (!projectData.pages || !Array.isArray(projectData.pages)) {
        throw new Error('Invalid project file format');
    }
    
    // Load project settings
    currentProjectName = projectData.projectName || 'Loaded Project';
    document.getElementById('projectNameInput').value = currentProjectName;
    
    if (projectData.settings) {
        document.getElementById('bookType').value = projectData.settings.bookType || 'text';
        document.getElementById('bookSize').value = projectData.settings.bookSize || 'standard';
        document.getElementById('charactersPerPage').value = projectData.settings.charactersPerPage || 1800;
        document.getElementById('illustrationFreq').value = projectData.settings.illustrationFreq || 'none';
        
        targetCharactersPerPage = projectData.settings.charactersPerPage || 1800;
        currentBookSize = projectData.settings.bookSize || 'standard';
    }
    
    // Load document structure if available
    if (projectData.documentStructure) {
        documentStructure = projectData.documentStructure;
    }
    
    // Load pages
    processedPages = projectData.pages.map(function(pageData, index) {
        return {
            number: index + 1,
            content: pageData.content || '',
            characterCount: pageData.characterCount || pageData.content.length || 0,
            images: pageData.images || [],
            hasIllustration: pageData.hasIllustration || false
        };
    });
    
    // Show results section and render pages
    document.getElementById('resultsSection').style.display = 'block';
    renderFormattedPages(processedPages);
    
    // Update UI
    updateProjectDisplay();
    markAsSaved();
    
    logToDebug('Project data loaded successfully - ' + processedPages.length + ' pages', 'save');
}

function newProject() {
    if (hasUnsavedChanges) {
        if (!confirm('You have unsaved changes. Creating a new project will lose these changes. Continue?')) {
            return;
        }
    }
    
    // Reset all data
    currentProjectName = 'Untitled Book Project';
    documentText = '';
    documentHTML = '';
    documentStructure = [];
    processedPages = [];
    hasUnsavedChanges = false;
    
    // Reset UI
    document.getElementById('projectNameInput').value = currentProjectName;
    document.getElementById('fileName').innerHTML = '';
    document.getElementById('resultsSection').style.display = 'none';
    
    // Reset settings to defaults
    document.getElementById('bookType').value = 'text';
    document.getElementById('bookSize').value = 'standard';
    document.getElementById('charactersPerPage').value = '1800';
    document.getElementById('illustrationFreq').value = 'none';
    
    targetCharactersPerPage = 1800;
    currentBookSize = 'standard';
    
    updateProjectDisplay();
    updateSaveStatus('Ready');
    
    showStatus('New project created', 'success');
    logToDebug('New project created', 'save');
}

// =======================================================================
// PROJECT HISTORY FUNCTIONS
// =======================================================================

function saveToProjectHistory(projectData) {
    try {
        var history = JSON.parse(localStorage.getItem('bookLayout_history') || '[]');
        
        var historyEntry = {
            id: Date.now(),
            projectName: projectData.projectName,
            timestamp: projectData.timestamp,
            pageCount: projectData.pages.length,
            characterCount: projectData.metadata.totalCharacters,
            preview: projectData.pages[0] ? projectData.pages[0].content.substring(0, 100) + '...' : 'Empty project'
        };
        
        history.unshift(historyEntry);
        
        // Keep only last 10 projects in history
        if (history.length > 10) {
            history = history.slice(0, 10);
        }
        
        localStorage.setItem('bookLayout_history', JSON.stringify(history));
        localStorage.setItem('bookLayout_project_' + historyEntry.id, JSON.stringify(projectData));
        
        logToDebug('Project saved to history', 'save');
        
    } catch (err) {
        logToDebug('Error saving to history: ' + err.message, 'error');
    }
}

function showProjectHistory() {
    try {
        var history = JSON.parse(localStorage.getItem('bookLayout_history') || '[]');
        
        if (history.length === 0) {
            showStatus('No project history found', 'error');
            return;
        }
        
        var dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
            background: rgba(0,0,0,0.7); z-index: 10000; 
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
        `;
        
        var historyList = history.map(function(entry) {
            var date = new Date(entry.timestamp).toLocaleString();
            return `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 10px; cursor: pointer; transition: all 0.3s ease;"
                     onmouseover="this.style.background='#e9ecef'" 
                     onmouseout="this.style.background='#f8f9fa'"
                     onclick="loadFromHistory(${entry.id})">
                    <div style="font-weight: bold; color: #333; margin-bottom: 5px;">${entry.projectName}</div>
                    <div style="font-size: 0.9em; color: #666; margin-bottom: 5px;">${date}</div>
                    <div style="font-size: 0.8em; color: #999; margin-bottom: 5px;">${entry.pageCount} pages • ${entry.characterCount} characters</div>
                    <div style="font-size: 0.8em; color: #666; font-style: italic;">${entry.preview}</div>
                </div>
            `;
        }).join('');
        
        dialog.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 15px; max-width: 600px; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="color: #333; margin: 0;">🕒 Project History</h2>
                    <button onclick="closeHistoryDialog()" style="background: #dc3545; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer;">✕ Close</button>
                </div>
                <div style="margin-bottom: 20px;">
                    ${historyList || '<p style="text-align: center; color: #666;">No projects in history</p>'}
                </div>
                <div style="text-align: center; padding-top: 15px; border-top: 1px solid #eee;">
                    <button onclick="clearProjectHistory()" style="background: #ffc107; color: #333; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold;">
                        🗑️ Clear History
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        window.loadFromHistory = function(projectId) {
            try {
                var projectData = JSON.parse(localStorage.getItem('bookLayout_project_' + projectId));
                if (projectData) {
                    if (hasUnsavedChanges) {
                        if (!confirm('You have unsaved changes. Loading this project will lose these changes. Continue?')) {
                            return;
                        }
                    }
                    loadProjectData(projectData);
                    closeHistoryDialog();
                    showStatus('Project loaded from history!', 'success');
                } else {
                    showStatus('Project data not found', 'error');
                }
            } catch (err) {
                showStatus('Error loading project: ' + err.message, 'error');
            }
        };
        
        window.closeHistoryDialog = function() {
            document.body.removeChild(dialog);
        };
        
        window.clearProjectHistory = function() {
            if (confirm('Are you sure you want to clear all project history? This cannot be undone.')) {
                localStorage.removeItem('bookLayout_history');
                // Clear individual project data
                for (var i = 0; i < localStorage.length; i++) {
                    var key = localStorage.key(i);
                    if (key && key.startsWith('bookLayout_project_')) {
                        localStorage.removeItem(key);
                    }
                }
                closeHistoryDialog();
                showStatus('Project history cleared', 'success');
            }
        };
        
    } catch (err) {
        showStatus('Error loading project history: ' + err.message, 'error');
        logToDebug('History error: ' + err.message, 'error');
    }
}
