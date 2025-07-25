// Global variables
var documentText = '';
var documentHTML = '';
var documentStructure = [];
var processedPages = [];
var targetWordsPerPage = 50;
var isReflowing = false;
var currentBookSize = 'standard';

// Initialize when page loads
window.onload = function() {
    console.log('App loaded successfully');
    setupEventListeners();
};

function setupEventListeners() {
    var uploadSection = document.getElementById('uploadSection');
    var fileInput = document.getElementById('fileInput');

    uploadSection.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadSection.classList.add('dragover');
    });

    uploadSection.addEventListener('dragleave', function() {
        uploadSection.classList.remove('dragover');
    });

    uploadSection.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadSection.classList.remove('dragover');
        var files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });
}

// Debug console functions
function showDebugConsole() {
    var debugConsole = document.getElementById('debugConsole');
    if (!debugConsole) {
        addDebugConsole();
    }
    document.getElementById('debugConsole').style.display = 'block';
    logToDebug('Debug console opened - ready to track upload process!', 'success');
}

function addDebugConsole() {
    var debugDiv = document.createElement('div');
    debugDiv.id = 'debugConsole';
    debugDiv.style.cssText = 'position: fixed; bottom: 20px; right: 20px; width: 450px; max-height: 400px; background: #1a1a1a; color: #00ff00; font-family: monospace; font-size: 12px; padding: 15px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); overflow-y: auto; z-index: 1000; display: none; border: 2px solid #333;';
    
    debugDiv.innerHTML = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #333; padding-bottom: 8px;"><strong style="color: #ffffff; font-size: 14px;">🐛 Debug Console</strong><button onclick="document.getElementById(\'debugConsole\').style.display=\'none\'" style="background: #ff4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">✕ Close</button></div><div id="debugLog" style="max-height: 320px; overflow-y: auto;"></div><div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #333; font-size: 10px; color: #888;">💡 This shows real-time upload and processing logs</div>';
    
    document.body.appendChild(debugDiv);
}

function logToDebug(message, type) {
    var debugLog = document.getElementById('debugLog');
    if (debugLog) {
        var colors = {
            info: '#00ff00',
            warn: '#ffaa00', 
            error: '#ff4444',
            success: '#00aa00'
        };
        
        var timestamp = new Date().toLocaleTimeString();
        var color = colors[type] || '#00ff00';
        debugLog.innerHTML += '<div style="color: ' + color + '; margin-bottom: 3px;">[' + timestamp + '] ' + message + '</div>';
        debugLog.scrollTop = debugLog.scrollHeight;
    }
}

// File handling
function handleFile(file) {
    logToDebug('Starting file upload process...', 'info');
    logToDebug('File: ' + file.name + ' (' + file.size + ' bytes)', 'info');

    if (!file.name.match(/\.(docx|doc)$/i)) {
        logToDebug('Invalid file type: ' + file.name, 'error');
        showStatus('Please select a Word document (.docx or .doc)', 'error');
        return;
    }

    var fileName = document.getElementById('fileName');
    fileName.innerHTML = 'Selected: ' + file.name;
    showProgress(true);
    updateProgress(20);
    logToDebug('File validation passed, starting FileReader...', 'success');

    var reader = new FileReader();
    
    reader.onerror = function(e) {
        logToDebug('FileReader error: ' + e, 'error');
        showStatus('Error reading file. Please try again.', 'error');
        showProgress(false);
    };

    reader.onload = function(e) {
        logToDebug('FileReader completed, file size: ' + e.target.result.byteLength + ' bytes', 'info');
        updateProgress(50);
        
        try {
            var options = {
                styleMap: [
                    "p[style-name='Heading 1'] => h1:fresh",
                    "p[style-name='Heading 2'] => h2:fresh",
                    "p[style-name='Heading 3'] => h3:fresh"
                ]
            };

            logToDebug('Starting Mammoth processing...', 'info');
            
            Promise.all([
                mammoth.convertToHtml({arrayBuffer: e.target.result}, options),
                mammoth.extractRawText({arrayBuffer: e.target.result})
            ]).then(function(results) {
                logToDebug('Mammoth processing successful', 'success');
                logToDebug('HTML result length: ' + results[0].value.length, 'info');
                logToDebug('Text result length: ' + results[1].value.length, 'info');

                documentHTML = results[0].value;
                documentText = results[1].value;
                
                logToDebug('Parsing document structure...', 'info');
                documentStructure = parseDocumentStructure(documentHTML);
                logToDebug('Document structure: ' + documentStructure.length + ' elements found', 'success');
                
                updateProgress(100);
                showStatus('Document loaded successfully with formatting!', 'success');
                setTimeout(function() { showProgress(false); }, 1000);
                
                showFormattingPreview(documentStructure);
            })
            .catch(function(err) {
                logToDebug('Mammoth processing error: ' + err.message, 'error');
                showStatus('Error processing document: ' + err.message, 'error');
                showProgress(false);
            });
            
        } catch (err) {
            logToDebug('Unexpected error in handleFile: ' + err.message, 'error');
            showStatus('Unexpected error: ' + err.message, 'error');
            showProgress(false);
        }
    };
    
    logToDebug('Starting FileReader.readAsArrayBuffer...', 'info');
    reader.readAsArrayBuffer(file);
}

function parseDocumentStructure(html) {
    logToDebug('Parsing document structure from HTML...', 'info');
    
    try {
        var parser = new DOMParser();
        var doc = parser.parseFromString(html, 'text/html');
        var elements = doc.body.children;
        var structure = [];
        
        logToDebug('Found ' + elements.length + ' elements in document body', 'info');
        
        for (var i = 0; i < elements.length; i++) {
            var element = elements[i];
            var item = {
                tag: element.tagName.toLowerCase(),
                content: element.textContent.trim(),
                html: element.outerHTML,
                isHeading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].indexOf(element.tagName.toLowerCase()) !== -1,
                isEmpty: element.textContent.trim() === ''
            };
            
            if (!item.isEmpty) {
                structure.push(item);
            }
        }
        
        logToDebug('Document structure parsed: ' + structure.length + ' non-empty elements', 'success');
        return structure;
        
    } catch (err) {
        logToDebug('Error parsing document structure: ' + err.message, 'error');
        return [{
            tag: 'p',
            content: html.replace(/<[^>]*>/g, ''),
            html: html,
            isHeading: false,
            isEmpty: false
        }];
    }
}

function showFormattingPreview(structure) {
    logToDebug('Showing formatting preview...', 'info');
    
    try {
        var headings = structure.filter(function(item) { return item.isHeading; });
        logToDebug('Found headings: ' + headings.length, 'info');
        
        if (headings.length > 0) {
            var fileName = document.getElementById('fileName');
            var previewDiv = document.createElement('div');
            previewDiv.style.cssText = 'background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #28a745;';
            
            var headingsList = headings.slice(0, 5).map(function(h) { return '• ' + h.content; }).join('<br>');
            var moreText = headings.length > 5 ? '<br>• ... and more' : '';
            
            previewDiv.innerHTML = '<strong>📋 Detected Document Structure:</strong><br><small style="color: #666;">Found ' + headings.length + ' headings that will be used for chapters/sections</small><br>' + headingsList + moreText;
            fileName.appendChild(previewDiv);
            logToDebug('Formatting preview displayed', 'success');
        } else {
            logToDebug('No headings found for preview', 'info');
        }
    } catch (err) {
        logToDebug('Error showing formatting preview: ' + err.message, 'error');
    }
}

function processDocument() {
    logToDebug('Starting document processing...', 'info');
    
    if (!documentHTML && !documentText) {
        showStatus('Please upload a document first', 'error');
        return;
    }

    showProgress(true);
    updateProgress(10);

    var bookType = document.getElementById('bookType').value;
    var bookSize = document.getElementById('bookSize').value;
    var wordsPerPage = parseInt(document.getElementById('wordsPerPage').value);
    var illustrationFreq = document.getElementById('illustrationFreq').value;

    targetWordsPerPage = wordsPerPage; // Store for text flow calculations
    currentBookSize = bookSize; // Store for print layout

    logToDebug('Processing with settings: ' + bookType + ', ' + bookSize + ', ' + wordsPerPage + ' words/page', 'info');

    updateProgress(30);
    processedPages = createFormattedBookLayout(documentStructure, bookType, wordsPerPage, illustrationFreq);
    
    updateProgress(70);
    renderFormattedPages(processedPages);
    
    updateProgress(100);
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
    
    showStatus('Successfully generated ' + processedPages.length + ' pages with proper word counts!', 'success');
    setTimeout(function() { showProgress(false); }, 1000);
}

function createFormattedBookLayout(structure, bookType, wordsPerPage, illustrationFreq) {
    var pages = [];
    var currentPageContent = [];
    var currentWordCount = 0;
    var pageNumber = 1;

    logToDebug('Creating layout with ' + wordsPerPage + ' words per page target', 'info');

    for (var i = 0; i < structure.length; i++) {
        var item = structure[i];
        var itemWords = item.content.split(/\s+/).filter(function(word) { return word.length > 0; });
        var itemWordCount = itemWords.length;
        
        logToDebug('Processing item: ' + itemWordCount + ' words, current page total: ' + currentWordCount, 'info');
        
        // If adding this item would exceed word limit and we have content, create page
        if (currentWordCount + itemWordCount > wordsPerPage && currentPageContent.length > 0) {
            logToDebug('Creating page ' + pageNumber + ' with ' + currentWordCount + ' words', 'success');
            pages.push(createFormattedPage(pageNumber, currentPageContent, illustrationFreq, pageNumber));
            currentPageContent = [];
            currentWordCount = 0;
            pageNumber++;
        }
        
        // If single item exceeds word limit, split it
        if (itemWordCount > wordsPerPage) {
            logToDebug('Item too long (' + itemWordCount + ' words), splitting...', 'warn');
            var splitItems = splitLongContent(item, wordsPerPage);
            for (var j = 0; j < splitItems.length; j++) {
                if (currentPageContent.length > 0) {
                    pages.push(createFormattedPage(pageNumber, currentPageContent, illustrationFreq, pageNumber));
                    currentPageContent = [];
                    currentWordCount = 0;
                    pageNumber++;
                }
                currentPageContent.push(splitItems[j]);
                var splitWords = splitItems[j].content.split(/\s+/).filter(function(word) { return word.length > 0; });
                currentWordCount = splitWords.length;
                pages.push(createFormattedPage(pageNumber, currentPageContent, illustrationFreq, pageNumber));
                currentPageContent = [];
                currentWordCount = 0;
                pageNumber++;
            }
        } else {
            currentPageContent.push(item);
            currentWordCount += itemWordCount;
        }
    }
    
    if (currentPageContent.length > 0) {
        logToDebug('Creating final page ' + pageNumber + ' with ' + currentWordCount + ' words', 'success');
        pages.push(createFormattedPage(pageNumber, currentPageContent, illustrationFreq, pageNumber));
    }

    logToDebug('Layout complete: ' + pages.length + ' pages created', 'success');
    return pages;
}

function splitLongContent(item, wordsPerPage) {
    var words = item.content.split(/\s+/).filter(function(word) { return word.length > 0; });
    var splitItems = [];
    var currentChunk = '';
    var wordCount = 0;
    
    for (var i = 0; i < words.length; i++) {
        if (wordCount >= wordsPerPage && currentChunk.length > 0) {
            splitItems.push({
                tag: item.tag,
                content: currentChunk.trim(),
                html: '<' + item.tag + '>' + currentChunk.trim() + '</' + item.tag + '>',
                isHeading: item.isHeading,
                isEmpty: false
            });
            currentChunk = '';
            wordCount = 0;
        }
        currentChunk += words[i] + ' ';
        wordCount++;
    }
    
    if (currentChunk.trim().length > 0) {
        splitItems.push({
            tag: item.tag,
            content: currentChunk.trim(),
            html: '<' + item.tag + '>' + currentChunk.trim() + '</' + item.tag + '>',
            isHeading: item.isHeading,
            isEmpty: false
        });
    }
    
    return splitItems;
}

function createFormattedPage(pageNum, contentItems, illustrationFreq, totalPage, title) {
    var needsIllustration = shouldHaveIllustration(illustrationFreq, totalPage);
    var totalWords = 0;
    for (var i = 0; i < contentItems.length; i++) {
        var itemWords = contentItems[i].content.split(/\s+/).filter(function(word) { return word.length > 0; });
        totalWords += itemWords.length;
    }
    
    var formattedHTML = '';
    var plainText = '';
    var hasHeadings = false;
    
    for (var i = 0; i < contentItems.length; i++) {
        formattedHTML += contentItems[i].html;
        plainText += contentItems[i].content;
        if (i < contentItems.length - 1) plainText += '\n\n';
        if (contentItems[i].isHeading) hasHeadings = true;
    }
    
    logToDebug('Created page ' + pageNum + ' with exactly ' + totalWords + ' words', 'success');
    
    return {
        number: pageNum,
        contentItems: contentItems,
        formattedHTML: formattedHTML,
        plainText: plainText,
        hasIllustration: needsIllustration,
        title: title || null,
        wordCount: totalWords,
        hasHeadings: hasHeadings,
        isChapterStart: title !== null,
        chapterTitle: title
    };
}

function shouldHaveIllustration(freq, pageNum) {
    switch (freq) {
        case 'every': return true;
        case 'alternate': return pageNum % 2 === 0;
        case 'chapter': return pageNum === 1;
        case 'none':
        default: return false;
    }
}

// Page rendering with editable content
function renderFormattedPages(pages) {
    var container = document.getElementById('pagesContainer');
    container.innerHTML = '';

    for (var i = 0; i < pages.length; i++) {
        var page = pages[i];
        var pageDiv = document.createElement('div');
        pageDiv.className = 'page size-' + currentBookSize;
        pageDiv.setAttribute('data-page-index', i);

        var headerDiv = document.createElement('div');
        headerDiv.className = 'page-header';
        
        var wordCountClass = getWordCountClass(page.wordCount);
        var wordCountHtml = '<span class="word-counter ' + wordCountClass + '">' + page.wordCount + ' / ' + targetWordsPerPage + ' words</span>';
        
        // Add page management buttons
        var pageManagementHtml = '<div style="display: flex; gap: 5px; align-items: center;">' +
            '<button class="copy-button" onclick="copyFormattedPage(' + i + ', \'formatted\')" style="margin-right: 5px;">Copy HTML</button>' +
            '<button class="copy-button" onclick="copyFormattedPage(' + i + ', \'plain\')" style="margin-right: 5px;">Copy Text</button>' +
            '<button class="copy-button" onclick="addBlankPage(' + i + ')" style="background: #ffc107; margin-right: 5px;">+ Blank</button>' +
            (processedPages.length > 1 ? '<button class="copy-button" onclick="deletePage(' + i + ')" style="background: #dc3545;">Delete</button>' : '') +
            '</div>';
        
        headerDiv.innerHTML = '<span>' + (page.title || 'Page ' + page.number) + ' ' + wordCountHtml + (page.hasHeadings ? ' • Contains Headings' : '') + '</span>' + pageManagementHtml;

        var flowIndicator = document.createElement('div');
        flowIndicator.className = 'flow-indicator';
        flowIndicator.textContent = 'Flowing...';

        var contentDiv = document.createElement('div');
        contentDiv.className = 'page-content';
        if (page.hasIllustration) {
            contentDiv.classList.add('illustration-space');
        }

        var pageContent = '';
        if (page.hasIllustration || page.isBlank) {
            pageContent += '<div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #ffc107;"><strong>🎨 Illustration Space</strong><br><small>This page should include an illustration based on the content below.</small></div>';
        }

        // Create editable content area
        if (!page.isBlank) {
            var editableDiv = document.createElement('div');
            editableDiv.className = 'editable-content';
            editableDiv.contentEditable = true;
            editableDiv.setAttribute('data-page-index', i);
            editableDiv.innerHTML = page.formattedHTML || page.plainText;
            
            // Add input event listener for real-time text flow
            editableDiv.addEventListener('input', function(e) {
                handleTextInput(e);
            });

            contentDiv.appendChild(editableDiv);
        } else {
            // Blank page content
            var blankDiv = document.createElement('div');
            blankDiv.className = 'editable-content';
            blankDiv.style.textAlign = 'center';
            blankDiv.style.color = '#999';
            blankDiv.style.fontStyle = 'italic';
            blankDiv.innerHTML = '<p>This is a blank page reserved for full-page illustration</p>';
            contentDiv.appendChild(blankDiv);
        }
        
        pageDiv.appendChild(flowIndicator);
        pageDiv.appendChild(headerDiv);
        pageDiv.appendChild(contentDiv);
        container.appendChild(pageDiv);
    }
}

function getWordCountClass(wordCount) {
    var min = targetWordsPerPage - 5;  // 45 for target 50
    var max = targetWordsPerPage + 5;  // 55 for target 50
    var overflow = targetWordsPerPage + 10; // 60 for target 50
    
    if (wordCount >= min && wordCount <= max) {
        return 'optimal';
    } else if (wordCount <= overflow) {
        return 'warning';
    } else {
        return 'overflow';
    }
}

function handleTextInput(event) {
    if (isReflowing) return; // Prevent recursive calls
    
    var editableDiv = event.target;
    var pageIndex = parseInt(editableDiv.getAttribute('data-page-index'));
    
    // Update the page content in our data structure
    var newContent = editableDiv.textContent || editableDiv.innerText;
    processedPages[pageIndex].plainText = newContent;
    processedPages[pageIndex].wordCount = countWords(newContent);
    
    // Update word counter display
    updateWordCounter(pageIndex);
    
    // Check if text flow is needed
    if (processedPages[pageIndex].wordCount > targetWordsPerPage + 10) { // 60+ words
        setTimeout(function() {
            reflowText(pageIndex);
        }, 500); // Small delay to avoid excessive calls while typing
    }
}

function countWords(text) {
    return text.split(/\s+/).filter(function(word) { return word.length > 0; }).length;
}

function updateWordCounter(pageIndex) {
    var page = processedPages[pageIndex];
    var headerDiv = document.querySelector('[data-page-index="' + pageIndex + '"] .page-header');
    var wordCountClass = getWordCountClass(page.wordCount);
    var wordCountHtml = '<span class="word-counter ' + wordCountClass + '">' + page.wordCount + ' / ' + targetWordsPerPage + ' words</span>';
    
    // Update the header with new word count
    var titleText = page.title || 'Page ' + page.number;
    var headingsText = page.hasHeadings ? ' • Contains Headings' : '';
    var buttonsHtml = '<div><button class="copy-button" onclick="copyFormattedPage(' + pageIndex + ', \'formatted\')" style="margin-right: 5px;">Copy HTML</button><button class="copy-button" onclick="copyFormattedPage(' + pageIndex + ', \'plain\')">Copy Text</button></div>';
    
    headerDiv.innerHTML = '<span>' + titleText + ' ' + wordCountHtml + headingsText + '</span>' + buttonsHtml;
}

function reflowText(fromPageIndex) {
    if (isReflowing) return;
    isReflowing = true;
    
    logToDebug('Starting text reflow from page ' + (fromPageIndex + 1), 'info');
    
    // Show flow indicator
    var flowIndicator = document.querySelector('[data-page-index="' + fromPageIndex + '"] .flow-indicator');
    if (flowIndicator) {
        flowIndicator.classList.add('active');
    }
    
    var currentPage = processedPages[fromPageIndex];
    var words = currentPage.plainText.split(/\s+/).filter(function(word) { return word.length > 0; });
    
    if (words.length <= targetWordsPerPage + 10) {
        isReflowing = false;
        if (flowIndicator) flowIndicator.classList.remove('active');
        return;
    }
    
    // Find a good break point (end of sentence near the target)
    var keepWords = findBreakPoint(words, targetWordsPerPage);
    var overflowWords = words.slice(keepWords);
    
    // Update current page
    currentPage.plainText = words.slice(0, keepWords).join(' ');
    currentPage.wordCount = keepWords;
    
    // Update the editable content
    var editableDiv = document.querySelector('[data-page-index="' + fromPageIndex + '"] .editable-content');
    if (editableDiv) {
        editableDiv.textContent = currentPage.plainText;
    }
    
    // Handle overflow text
    var nextPageIndex = fromPageIndex + 1;
    
    // Check if next page is a chapter start (don't flow across chapters)
    if (nextPageIndex < processedPages.length && processedPages[nextPageIndex].isChapterStart) {
        logToDebug('Stopped reflow at chapter boundary', 'warn');
        isReflowing = false;
        if (flowIndicator) flowIndicator.classList.remove('active');
        return;
    }
    
    // Flow to next page or create new page
    if (nextPageIndex < processedPages.length) {
        // Add overflow to existing next page
        var nextPage = processedPages[nextPageIndex];
        var combinedText = overflowWords.join(' ') + ' ' + nextPage.plainText;
        nextPage.plainText = combinedText;
        nextPage.wordCount = countWords(combinedText);
        
        // Update next page display
        var nextEditableDiv = document.querySelector('[data-page-index="' + nextPageIndex + '"] .editable-content');
        if (nextEditableDiv) {
            nextEditableDiv.textContent = nextPage.plainText;
        }
        
        // Continue flowing if next page is also too long
        if (nextPage.wordCount > targetWordsPerPage + 10) {
            setTimeout(function() {
                reflowText(nextPageIndex);
            }, 100);
        }
    } else {
        // Create new page for overflow
        var newPage = createNewPage(overflowWords.join(' '), fromPageIndex + 1);
        processedPages.push(newPage);
        
        // Re-render to show new page
        setTimeout(function() {
            renderFormattedPages(processedPages);
            isReflowing = false;
        }, 100);
        return;
    }
    
    // Update word counters
    updateWordCounter(fromPageIndex);
    updateWordCounter(nextPageIndex);
    
    // Hide flow indicator
    setTimeout(function() {
        if (flowIndicator) flowIndicator.classList.remove('active');
        isReflowing = false;
    }, 500);
}

function findBreakPoint(words, targetCount) {
    // Try to find a sentence ending near the target
    for (var i = Math.max(1, targetCount - 10); i <= Math.min(words.length - 1, targetCount + 5); i++) {
        if (words[i - 1].endsWith('.') || words[i - 1].endsWith('!') || words[i - 1].endsWith('?')) {
            return i;
        }
    }
    
    // If no sentence break found, use target count
    return Math.min(targetCount, words.length);
}

function createNewPage(content, afterPageIndex) {
    var pageNumber = processedPages.length + 1;
    return {
        number: pageNumber,
        contentItems: [{
            tag: 'p',
            content: content,
            html: '<p>' + content + '</p>',
            isHeading: false,
            isEmpty: false
        }],
        formattedHTML: '<p>' + content + '</p>',
        plainText: content,
        hasIllustration: false,
        title: null,
        wordCount: countWords(content),
        hasHeadings: false,
        isChapterStart: false,
        chapterTitle: null
    };
}

// Copy and export functions
function copyFormattedPage(index, format) {
    var page = processedPages[index];
    var textToCopy = '';
    
    if (format === 'formatted') {
        textToCopy = convertToCanvaFormat(page);
    } else {
        textToCopy = page.plainText;
        if (page.hasIllustration) {
            textToCopy = '[ILLUSTRATION SPACE]\n\n' + textToCopy;
        }
        if (page.title) {
            textToCopy = page.title + '\n\n' + textToCopy;
        }
    }

    navigator.clipboard.writeText(textToCopy).then(function() {
        showStatus('Page copied to clipboard (' + format + ' format)!', 'success');
    });
}

function convertToCanvaFormat(page) {
    var canvaText = '';
    
    if (page.title) {
        canvaText += '**' + page.title + '**\n\n';
    }
    
    if (page.hasIllustration) {
        canvaText += '[ADD ILLUSTRATION HERE]\n\n';
    }
    
    for (var i = 0; i < page.contentItems.length; i++) {
        var item = page.contentItems[i];
        if (item.isHeading) {
            canvaText += '**' + item.content + '**\n\n';
        } else {
            var content = item.html;
            content = content.replace(/<(strong|b)>(.*?)<\/(strong|b)>/gi, '**$2**');
            content = content.replace(/<(em|i)>(.*?)<\/(em|i)>/gi, '*$2*');
            content = content.replace(/<[^>]*>/g, '');
            content = content.replace(/\s+/g, ' ').trim();
            
            if (content) {
                canvaText += content + '\n\n';
            }
        }
    }
    
    return canvaText;
}

function copyAllPages() {
    var allHTML = '';
    for (var i = 0; i < processedPages.length; i++) {
        allHTML += convertToCanvaFormat(processedPages[i]) + '\n---\n\n';
    }
    navigator.clipboard.writeText(allHTML).then(function() {
        showStatus('All pages copied to clipboard (Canva format)!', 'success');
    });
}

function exportToText() {
    var content = 'Book Layout Export\nGenerated: ' + new Date().toLocaleDateString() + '\nTotal Pages: ' + processedPages.length + '\n\n';
    content += '==================================================\n\n';

    for (var i = 0; i < processedPages.length; i++) {
        var page = processedPages[i];
        if (page.title) {
            content += page.title + '\n';
            var underline = '';
            for (var j = 0; j < page.title.length; j++) {
                underline += '-';
            }
            content += underline + '\n\n';
        }
        if (page.hasIllustration) {
            content += '[ILLUSTRATION SPACE - Add visual content here]\n\n';
        }
        if (page.hasHeadings) {
            content += '[Contains formatted headings and styled text]\n\n';
        }
        content += page.plainText + '\n\n';
        if (i < processedPages.length - 1) {
            content += '==================================================\n\n';
        }
    }

    var blob = new Blob([content], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'book-layout-formatted.txt';
    a.click();
    URL.revokeObjectURL(url);
}

function generateCanvaInstructions() {
    var instructions = 'Canva Book Layout Instructions with Formatting\n';
    instructions += '==================================================\n\n';
    instructions += 'Book Details:\n';
    instructions += '- Total Pages: ' + processedPages.length + '\n';
    instructions += '- Book Type: ' + document.getElementById('bookType').value + '\n';
    instructions += '- Book Size: ' + document.getElementById('bookSize').value + '\n';
    instructions += '- Words per Page: ' + document.getElementById('wordsPerPage').value + '\n';
    instructions += '- Contains Formatting: YES (headings, bold, italic)\n\n';
    
    instructions += 'Formatting Guide for Canva:\n';
    instructions += '- **Text** = Bold formatting in Canva\n';
    instructions += '- *Text* = Italic formatting in Canva\n';  
    instructions += '- Headings are marked with ** and should be larger font size\n';
    instructions += '- Maintain paragraph breaks as shown\n';
    instructions += '- Use consistent fonts throughout\n\n';
    
    instructions += 'Steps for Canva:\n';
    instructions += '1. Create a new design with your chosen book dimensions\n';
    instructions += '2. For each page below, create a new page in Canva\n';
    instructions += '3. Copy the formatted text content into text boxes\n';
    instructions += '4. Apply formatting: ** for bold, * for italic\n';
    instructions += '5. Make headings larger and more prominent\n';
    instructions += '6. Add illustrations where marked\n';
    instructions += '7. Ensure consistent spacing and alignment\n\n';
    
    instructions += 'Page-by-Page Content with Formatting:\n';
    instructions += '==================================================\n\n';

    for (var i = 0; i < processedPages.length; i++) {
        var page = processedPages[i];
        instructions += 'PAGE ' + (i + 1) + ':\n';
        if (page.title) {
            instructions += 'Title: ' + page.title + '\n';
        }
        if (page.hasIllustration) {
            instructions += 'WARNING: ADD ILLUSTRATION HERE\n';
        }
        if (page.hasHeadings) {
            instructions += 'NOTE: Contains formatted headings\n';
        }
        instructions += '\nFormatted Content:\n';
        instructions += convertToCanvaFormat(page) + '\n';
        
        var separator = '';
        for (var j = 0; j < 40; j++) {
            separator += '-';
        }
        instructions += separator + '\n\n';
    }

    var blob = new Blob([instructions], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'canva-instructions-formatted.txt';
    a.click();
    URL.revokeObjectURL(url);
}

// Utility functions
function showProgress(show) {
    document.getElementById('progressBar').style.display = show ? 'block' : 'none';
    if (!show) {
        updateProgress(0);
    }
}

function updateProgress(percent) {
    document.getElementById('progressFill').style.width = percent + '%';
}

function showStatus(message, type) {
    var statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = message;
    statusDiv.className = 'status-message status-' + type;
    statusDiv.style.display = 'block';
    
    setTimeout(function() {
        statusDiv.style.display = 'none';
    }, 5000);
}

// Print functionality
function showPrintSettings() {
    document.getElementById('printSettings').style.display = 'block';
    document.getElementById('pagesContainer').style.display = 'none';
    updatePrintPreview();
}

function hidePrintSettings() {
    document.getElementById('printSettings').style.display = 'none';
    document.getElementById('pagesContainer').style.display = 'block';
}

function updatePrintPreview() {
    var fontSize = document.getElementById('printFontSize').value;
    var margins = document.getElementById('printMargins').value;
    var pageNumbers = document.getElementById('pageNumbers').value;
    
    // Apply print preview styles to pages
    var pages = document.querySelectorAll('.page');
    pages.forEach(function(page, index) {
        var content = page.querySelector('.page-content');
        if (content) {
            // Remove existing print classes
            content.classList.remove('font-small', 'font-medium', 'font-large');
            content.classList.remove('margin-normal', 'margin-wide', 'margin-narrow');
            
            // Add new classes
            content.classList.add('font-' + fontSize);
            content.classList.add('margin-' + margins);
            
            // Handle page numbers
            var existingPageNum = page.querySelector('.page-number');
            if (existingPageNum) {
                existingPageNum.remove();
            }
            
            if (pageNumbers !== 'none') {
                var pageNumDiv = document.createElement('div');
                pageNumDiv.className = 'page-number';
                pageNumDiv.textContent = index + 1;
                
                if (pageNumbers === 'corner') {
                    pageNumDiv.style.textAlign = (index % 2 === 0) ? 'left' : 'right';
                    pageNumDiv.style.paddingLeft = (index % 2 === 0) ? '0.5in' : '0';
                    pageNumDiv.style.paddingRight = (index % 2 === 1) ? '0.5in' : '0';
                }
                
                page.appendChild(pageNumDiv);
            }
        }
        
        // Update illustration placeholders for print
        var illustrations = page.querySelectorAll('.illustration-space > div:first-child');
        illustrations.forEach(function(illus) {
            illus.className = 'illustration-placeholder';
            illus.innerHTML = '<strong>ILLUSTRATION PLACEHOLDER</strong><br>This space reserved for artwork';
        });
    });
    
    showStatus('Print preview updated! Use browser print to see exact layout.', 'success');
}

function showPrintPreview() {
    // Apply print styles temporarily
    document.body.classList.add('print-preview');
    
    // Open print dialog
    setTimeout(function() {
        window.print();
        document.body.classList.remove('print-preview');
    }, 500);
}

function generatePDF() {
    showStatus('Opening print dialog - choose "Save as PDF" for best results', 'success');
    
    // Set up optimal print settings
    updatePrintPreview();
    
    // Brief delay then open print dialog
    setTimeout(function() {
        window.print();
    }, 1000);
}

function addBlankPage(afterPageIndex) {
    var newPage = {
        number: processedPages.length + 1,
        contentItems: [],
        formattedHTML: '',
        plainText: '',
        hasIllustration: true,
        title: null,
        wordCount: 0,
        hasHeadings: false,
        isChapterStart: false,
        chapterTitle: null,
        isBlank: true
    };
    
    // Insert the blank page
    if (afterPageIndex >= 0) {
        processedPages.splice(afterPageIndex + 1, 0, newPage);
    } else {
        processedPages.push(newPage);
    }
    
    // Renumber pages
    for (var i = 0; i < processedPages.length; i++) {
        processedPages[i].number = i + 1;
    }
    
    // Re-render
    renderFormattedPages(processedPages);
    showStatus('Blank page added successfully!', 'success');
}

function deletePage(pageIndex) {
    if (processedPages.length <= 1) {
        showStatus('Cannot delete the only page!', 'error');
        return;
    }
    
    if (confirm('Are you sure you want to delete this page?')) {
        processedPages.splice(pageIndex, 1);
        
        // Renumber pages
        for (var i = 0; i < processedPages.length; i++) {
            processedPages[i].number = i + 1;
        }
        
        renderFormattedPages(processedPages);
        showStatus('Page deleted successfully!', 'success');
    }
}
