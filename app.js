// =======================================================================
// APP.JS - Main Application & Page Management
// Page rendering, editing, image management, and export functions
// =======================================================================

// =======================================================================
// PAGE RENDERING FUNCTIONS
// =======================================================================

function renderFormattedPages(pages) {
    var container = document.getElementById('pagesContainer');
    container.innerHTML = '';

    for (var i = 0; i < pages.length; i++) {
        var page = pages[i];
        var pageDiv = document.createElement('div');
        pageDiv.className = 'page size-' + currentBookSize;
        pageDiv.setAttribute('data-page-index', i);

        // Flow indicator
        var flowIndicator = document.createElement('div');
        flowIndicator.className = 'flow-indicator';
        flowIndicator.textContent = 'Flowing...';

        // Page header
        var headerDiv = document.createElement('div');
        headerDiv.className = 'page-header';
        
        var pageInfo = document.createElement('div');
        pageInfo.className = 'page-info';
        
        var characterCountClass = getCharacterCountClass(page.characterCount);
        var characterCountHtml = '<span class="character-counter ' + characterCountClass + '">' + page.characterCount + ' / ' + targetCharactersPerPage + ' chars</span>';
        
        pageInfo.innerHTML = '<span>Page ' + page.number + '</span>' + characterCountHtml;
        
        // Page actions
        var pageActions = document.createElement('div');
        pageActions.className = 'page-actions';
        pageActions.innerHTML = 
            '<button class="copy-button" onclick="copyFormattedPage(' + i + ', \'text\')">Copy Text</button>' +
            '<button class="copy-button" onclick="copyFormattedPage(' + i + ', \'formatted\')">Copy HTML</button>' +
            (processedPages.length > 1 ? '<button class="delete-button" onclick="deletePage(' + i + ')">Delete</button>' : '');
        
        headerDiv.appendChild(pageInfo);
        headerDiv.appendChild(pageActions);

        // Toolbar
        var toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        toolbar.innerHTML = 
            '<button class="toolbar-button image-btn" onclick="insertImagePlaceholder(' + i + ', \'half\')">📷 Half Image</button>' +
            '<button class="toolbar-button image-btn" onclick="insertImagePlaceholder(' + i + ', \'full\')">🖼️ Full Image</button>' +
            '<button class="toolbar-button break-btn" onclick="forcePageBreak(' + i + ')">⏎ Force Break</button>';

        // Page content
        var contentDiv = document.createElement('div');
        contentDiv.className = 'page-content';

        // Render existing images
        for (var j = 0; j < page.images.length; j++) {
            var img = page.images[j];
            var imgPlaceholder = createImageElement(img.type, img.id, i);
            contentDiv.appendChild(imgPlaceholder);
        }

        // Editable text content
        var editableDiv = document.createElement('div');
        editableDiv.className = 'editable-content';
        editableDiv.contentEditable = true;
        editableDiv.setAttribute('data-page-index', i);
        editableDiv.textContent = page.content;
        
        // Add input event listener for real-time character flow
        editableDiv.addEventListener('input', function(e) {
            handleTextInput(e);
        });

        // Add cursor tracking
        editableDiv.addEventListener('focus', function(e) {
            currentCursorPage = parseInt(e.target.getAttribute('data-page-index'));
        });

        contentDiv.appendChild(editableDiv);
        
        pageDiv.appendChild(flowIndicator);
        pageDiv.appendChild(headerDiv);
        pageDiv.appendChild(toolbar);
        pageDiv.appendChild(contentDiv);
        container.appendChild(pageDiv);
    }
}

function handleTextInput(event) {
    if (isReflowing) return;
    
    var editableDiv = event.target;
    var pageIndex = parseInt(editableDiv.getAttribute('data-page-index'));
    
    // Update the page content in our data structure
    var newContent = editableDiv.textContent || editableDiv.innerText;
    processedPages[pageIndex].content = newContent;
    processedPages[pageIndex].characterCount = newContent.length;
    
    logToDebug('Page ' + (pageIndex + 1) + ' edited: ' + newContent.length + ' characters', 'flow');
    
    // Mark as changed for auto-save
    markAsChanged();
    
    // Update character counter display
    updateCharacterCounter(pageIndex);
    
    // Schedule reflow after a short delay to avoid excessive calls
    scheduleReflow();
}

function updateCharacterCounter(pageIndex) {
    var page = processedPages[pageIndex];
    var headerDiv = document.querySelector('[data-page-index="' + pageIndex + '"] .page-header .page-info');
    var characterCountClass = getCharacterCountClass(page.characterCount);
    var characterCountHtml = '<span class="character-counter ' + characterCountClass + '">' + page.characterCount + ' / ' + targetCharactersPerPage + ' chars</span>';
    
    headerDiv.innerHTML = '<span>Page ' + page.number + '</span>' + characterCountHtml;
}

// =======================================================================
// IMAGE PLACEHOLDER FUNCTIONS
// =======================================================================

function createImageElement(type, id, pageIndex) {
    var imgDiv = document.createElement('div');
    imgDiv.className = 'image-placeholder ' + type + '-page';
    imgDiv.setAttribute('data-image-id', id);
    imgDiv.setAttribute('data-page-index', pageIndex);
    
    var placeholderText = document.createElement('div');
    placeholderText.className = 'placeholder-text';
    placeholderText.textContent = type === 'half' ? '🖼️ HALF PAGE IMAGE' : '🖼️ FULL PAGE IMAGE';
    
    var placeholderDetails = document.createElement('div');
    placeholderDetails.className = 'placeholder-details';
    placeholderDetails.textContent = type === 'half' ? 
        'This image will occupy half the page height' : 
        'This image will occupy most of the page';
    
    var removeBtn = document.createElement('button');
    removeBtn.className = 'remove-image';
    removeBtn.innerHTML = '×';
    removeBtn.onclick = function() {
        removeImagePlaceholder(id, pageIndex);
    };
    
    imgDiv.appendChild(removeBtn);
    imgDiv.appendChild(placeholderText);
    imgDiv.appendChild(placeholderDetails);
    
    return imgDiv;
}

function insertImagePlaceholder(pageIndex, type) {
    logToDebug('Inserting ' + type + ' image placeholder on page ' + (pageIndex + 1), 'info');
    
    var page = processedPages[pageIndex];
    var newImageId = 'img_' + page.number + '_' + (page.images.length + 1);
    
    page.images.push({
        type: type,
        id: newImageId
    });
    
    // Re-render the page
    var pageDiv = document.querySelector('[data-page-index="' + pageIndex + '"]');
    var contentDiv = pageDiv.querySelector('.page-content');
    
    // Add the new image placeholder
    var editableDiv = contentDiv.querySelector('.editable-content');
    var imgElement = createImageElement(type, newImageId, pageIndex);
    contentDiv.insertBefore(imgElement, editableDiv);
    
    // Update available character space
    var reservedChars = type === 'half' ? 200 : 400;
    if (page.content.length > targetCharactersPerPage - reservedChars) {
        scheduleReflow();
    }
    
    // Mark as changed
    markAsChanged();
    
    showStatus('Image placeholder added successfully!', 'success');
}

function removeImagePlaceholder(imageId, pageIndex) {
    logToDebug('Removing image placeholder ' + imageId + ' from page ' + (pageIndex + 1), 'info');
    
    var page = processedPages[pageIndex];
    page.images = page.images.filter(function(img) {
        return img.id !== imageId;
    });
    
    // Remove from DOM
    var imgElement = document.querySelector('[data-image-id="' + imageId + '"]');
    if (imgElement) {
        imgElement.remove();
    }
    
    // Trigger reflow since we have more space now
    scheduleReflow();
    
    // Mark as changed
    markAsChanged();
    
    showStatus('Image placeholder removed!', 'success');
}

// =======================================================================
// PAGE MANAGEMENT FUNCTIONS
// =======================================================================

function forcePageBreak(pageIndex) {
    logToDebug('Forcing page break at page ' + (pageIndex + 1), 'info');
    
    // Get cursor position in the editable div
    var editableDiv = document.querySelector('[data-page-index="' + pageIndex + '"] .editable-content');
    var selection = window.getSelection();
    
    if (selection.rangeCount > 0) {
        var range = selection.getRangeAt(0);
        var cursorPos = range.startOffset;
        var textContent = editableDiv.textContent;
        
        // Split content at cursor position
        var beforeCursor = textContent.substring(0, cursorPos);
        var afterCursor = textContent.substring(cursorPos);
        
        // Update current page with content before cursor
        processedPages[pageIndex].content = beforeCursor;
        processedPages[pageIndex].characterCount = beforeCursor.length;
        
        // Create new page with content after cursor
        var newPageNumber = processedPages.length + 1;
        var newPage = createCharacterPage(newPageNumber, afterCursor, false);
        
        // Insert new page after current page
        processedPages.splice(pageIndex + 1, 0, newPage);
        
        // Renumber pages
        for (var i = 0; i < processedPages.length; i++) {
            processedPages[i].number = i + 1;
        }
        
        // Re-render
        renderFormattedPages(processedPages);
        
        // Mark as changed
        markAsChanged();
        
        showStatus('Page break inserted successfully!', 'success');
    } else {
        showStatus('Place cursor where you want to break the page', 'error');
    }
}

function deletePage(pageIndex) {
    if (processedPages.length <= 1) {
        showStatus('Cannot delete the only page!', 'error');
        return;
    }
    
    if (confirm('Are you sure you want to delete this page? The content will be merged with adjacent pages.')) {
        logToDebug('Deleting page ' + (pageIndex + 1), 'info');
        
        // Merge content with next page if it exists, otherwise with previous page
        var deletedContent = processedPages[pageIndex].content;
        
        if (pageIndex < processedPages.length - 1) {
            // Merge with next page
            processedPages[pageIndex + 1].content = deletedContent + ' ' + processedPages[pageIndex + 1].content;
            processedPages[pageIndex + 1].characterCount = processedPages[pageIndex + 1].content.length;
        } else if (pageIndex > 0) {
            // Merge with previous page
            processedPages[pageIndex - 1].content = processedPages[pageIndex - 1].content + ' ' + deletedContent;
            processedPages[pageIndex - 1].characterCount = processedPages[pageIndex - 1].content.length;
        }
        
        // Remove the page
        processedPages.splice(pageIndex, 1);
        
        // Renumber pages
        for (var i = 0; i < processedPages.length; i++) {
            processedPages[i].number = i + 1;
        }
        
        // Trigger reflow to redistribute content properly
        scheduleReflow();
        
        // Mark as changed
        markAsChanged();
        
        showStatus('Page deleted and content merged successfully!', 'success');
    }
}

// =======================================================================
// COPY AND EXPORT FUNCTIONS
// =======================================================================

function copyFormattedPage(index, format) {
    var page = processedPages[index];
    var textToCopy = '';
    
    if (format === 'formatted') {
        textToCopy = convertToCanvaFormat(page);
    } else {
        textToCopy = page.content;
        
        // Add image placeholders to text
        for (var i = 0; i < page.images.length; i++) {
            var img = page.images[i];
            textToCopy = '[' + img.type.toUpperCase() + ' IMAGE PLACEHOLDER]\n\n' + textToCopy;
        }
    }

    navigator.clipboard.writeText(textToCopy).then(function() {
        showStatus('Page copied to clipboard (' + format + ' format)!', 'success');
    });
}

function convertToCanvaFormat(page) {
    var canvaText = '';
    
    // Add image placeholders
    for (var i = 0; i < page.images.length; i++) {
        var img = page.images[i];
        canvaText += '[ADD ' + img.type.toUpperCase() + ' IMAGE HERE]\n\n';
    }
    
    canvaText += page.content;
    
    return canvaText;
}

function copyAllPages() {
    var allText = '';
    for (var i = 0; i < processedPages.length; i++) {
        allText += convertToCanvaFormat(processedPages[i]) + '\n---\n\n';
    }
    navigator.clipboard.writeText(allText).then(function() {
        showStatus('All pages copied to clipboard (Canva format)!', 'success');
    });
}

function exportToText() {
    var content = 'Book Layout Export (Character-Based Flow v2.0)\nGenerated: ' + new Date().toLocaleDateString() + '\nTotal Pages: ' + processedPages.length + '\nCharacters per page: ' + targetCharactersPerPage + '\n\n';
    content += '==================================================\n\n';

    for (var i = 0; i < processedPages.length; i++) {
        var page = processedPages[i];
        content += 'PAGE ' + page.number + ' (' + page.characterCount + ' characters)\n';
        content += '==================================================\n';
        
        // Add image placeholders
        for (var j = 0; j < page.images.length; j++) {
            var img = page.images[j];
            content += '[' + img.type.toUpperCase() + ' IMAGE PLACEHOLDER - ' + img.id + ']\n\n';
        }
        
        content += page.content + '\n\n';
        
        if (i < processedPages.length - 1) {
            content += '==================================================\n\n';
        }
    }

    var blob = new Blob([content], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'book-layout-character-based-v2.txt';
    a.click();
    URL.revokeObjectURL(url);
}

function generateCanvaInstructions() {
    var instructions = 'Canva Book Layout Instructions (Character-Based Flow v2.0)\n';
    instructions += '==================================================\n\n';
    instructions += 'Book Details:\n';
    instructions += '- Total Pages: ' + processedPages.length + '\n';
    instructions += '- Book Type: ' + document.getElementById('bookType').value + '\n';
    instructions += '- Book Size: ' + document.getElementById('bookSize').value + '\n';
    instructions += '- Characters per Page: ' + document.getElementById('charactersPerPage').value + '\n';
    instructions += '- Layout System: Character-based flow with real-time editing v2.0\n';
    instructions += '- Project Management: Auto-save enabled with project history\n\n';
    
    instructions += 'Image Placement Guide:\n';
    instructions += '- Half-page images reserve ~200 characters of space\n';
    instructions += '- Full-page images reserve ~400 characters of space\n';
    instructions += '- Images can be placed anywhere in the page flow\n';
    instructions += '- Each image placeholder shows exact dimensions needed\n\n';
    
    instructions += 'Steps for Canva:\n';
    instructions += '1. Create a new design with your chosen book dimensions\n';
    instructions += '2. For each page below, create a new page in Canva\n';
    instructions += '3. Add image placeholders first (they determine text space)\n';
    instructions += '4. Copy the text content into text boxes\n';
    instructions += '5. Ensure consistent spacing and alignment\n';
    instructions += '6. Replace image placeholders with actual artwork\n';
    instructions += '7. Use this file as your master reference\n\n';
    
    instructions += 'Page-by-Page Content:\n';
    instructions += '==================================================\n\n';

    for (var i = 0; i < processedPages.length; i++) {
        var page = processedPages[i];
        instructions += 'PAGE ' + page.number + ' (' + page.characterCount + ' characters):\n\n';
        
        // Add image instructions
        if (page.images.length > 0) {
            instructions += 'IMAGES TO ADD:\n';
            for (var j = 0; j < page.images.length; j++) {
                var img = page.images[j];
                instructions += '- ' + img.type.toUpperCase() + ' page image (' + img.id + ')\n';
            }
            instructions += '\n';
        }
        
        instructions += 'TEXT CONTENT:\n';
        instructions += page.content + '\n\n';
        
        var separator = '';
        for (var k = 0; k < 50; k++) {
            separator += '-';
        }
        instructions += separator + '\n\n';
    }

    var blob = new Blob([instructions], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'canva-instructions-character-flow-v2.txt';
    a.click();
    URL.revokeObjectURL(url);
}

function generatePDF() {
    showStatus('PDF generation will be enhanced in Phase 3. Currently using browser print...', 'success');
    
    // For now, use browser print - this will be enhanced in Phase 3
    setTimeout(function() {
        window.print();
    }, 1000);
}

// =======================================================================
// INITIALIZATION COMPLETE
// =======================================================================

// Log successful initialization
if (typeof logToDebug === 'function') {
    setTimeout(function() {
        logToDebug('All modules loaded successfully - App ready!', 'success');
        logToDebug('Features: Character flow, Auto-save, Project management, Image placeholders', 'info');
    }, 100);
}
