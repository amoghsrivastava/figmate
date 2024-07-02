"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const API_URL = 'https://meme-api.com/gimme/wholesomememes';
const VENDOR_NAME_DATA_URL = 'https://raw.githubusercontent.com/amoghsrivastava/figmate/main/data/vendor_name_data.txt';
// Read the content of the text file from Firebase Storage
function readRemoteTextFile(url) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch data: ${response.statusText}`);
            }
            const text = yield response.text();
            return text.split('\n').filter((line) => line.trim() !== '');
        }
        catch (error) {
            console.error('Error reading text file:', error);
            figma.notify('Failed to fetch text file data');
            return [];
        }
    });
}
// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.
// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).
// This shows the HTML page in "ui.html".
figma.showUI(__html__, { themeColors: true, width: 300, height: 590 });
// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
// Functions to handle messages from the UI
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    // Function to set text style ID
    const setTextStyleId = (node, styleId) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield figma.loadFontAsync(node.fontName); // Ensure font is loaded
            yield figma.getStyleByIdAsync(styleId); // Apply the text style ID to the node
        }
        catch (error) {
            console.error('Error setting text style ID:', error);
        }
    });
    // Functions to handle case
    if (msg.type.startsWith('submit-')) {
        const selectedTextNodes = figma.currentPage.selection.filter(node => node.type === 'TEXT');
        if (selectedTextNodes.length === 0) {
            figma.notify('Please select at least one text layer');
            return;
        }
        // Get the case type from the message
        const caseType = msg.type.replace('submit-', '');
        // Function to change text case
        const changeTextCase = (text, type) => {
            switch (type) {
                case 'title':
                    return text.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
                case 'upper':
                    return text.toUpperCase();
                case 'lower':
                    return text.toLowerCase();
                case 'sentence':
                    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
                default:
                    return text;
            }
        };
        // Update each selected text node
        for (const node of selectedTextNodes) {
            yield figma.loadFontAsync(node.fontName);
            // Store the original text style ID
            const originalTextStyleId = node.textStyleId;
            // Apply the new text content with preserved style
            node.characters = changeTextCase(node.characters, caseType);
            // If you want to apply a specific shared text style ID:
            const sharedStyleId = 'YOUR_SHARED_TEXT_STYLE_ID'; // Replace with your actual shared style ID
            yield setTextStyleId(node, sharedStyleId);
            // Restore the original text style ID (optional)
            // node.textStyleId = originalTextStyleId;
        }
    }
    // Functions to handle character count
    if (msg.type.startsWith('char-count')) {
        let totalChars = 0;
        // Check if a text node is selected
        const selectedTextNodes = figma.currentPage.selection.filter(node => node.type === 'TEXT');
        if (selectedTextNodes.length === 0) {
            // If no text node is selected, send a message back to the UI
            figma.notify('Please select at least one text layer');
            return;
        }
        for (const node of selectedTextNodes) {
            totalChars += node.characters.length;
        }
        figma.notify(totalChars + ' characters');
        // figma.ui.postMessage(totalChars);
    }
    // Functions to handle object count
    if (msg.type.startsWith('object-count')) {
        let totalChars = 0;
        // Check if a text node is selected
        const selectedNodes = figma.currentPage.selection;
        if (selectedNodes.length === 0) {
            // If no text node is selected, send a message back to the UI
            figma.notify('Nothing is selected');
            return;
        }
        else if (selectedNodes.length === 1) {
            figma.notify(selectedNodes.length + ' object');
        }
        else {
            figma.notify(selectedNodes.length + ' objects');
        }
        // figma.ui.postMessage(totalChars);
    }
    // Functions to add a meme to the UI
    if (msg.type === 'addMeme') {
        try {
            const response = yield fetch(API_URL);
            const data = yield response.json();
            const imageUrl = data.preview[2];
            figma.createImageAsync(imageUrl).then((image) => __awaiter(void 0, void 0, void 0, function* () {
                const page = figma.currentPage;
                const children = page.children;
                // Get the original dimensions of the image
                const { width: imageWidth, height: imageHeight } = yield image.getSizeAsync();
                // Set the fixed width and calculate the proportional height
                const fixedWidth = 320;
                const newHeight = (imageHeight / imageWidth) * fixedWidth;
                // Function to check if the new position overlaps with existing elements
                function isOverlapping(x, y, width, height) {
                    for (const child of children) {
                        if ('absoluteBoundingBox' in child && child.absoluteBoundingBox) {
                            const { x: childX, y: childY, width: childWidth, height: childHeight } = child.absoluteBoundingBox;
                            if (x < childX + childWidth &&
                                x + width > childX &&
                                y < childY + childHeight &&
                                y + height > childY) {
                                return true;
                            }
                        }
                    }
                    return false;
                }
                // Find a position that doesn't overlap
                let newX = 0;
                let newY = 0;
                const gap = 10; // Gap between elements
                let foundPosition = false;
                // Define an arbitrary large width for the page or use the width of the first frame
                const pageWidth = 10000; // You can adjust this value as needed
                // Increment x and y until a non-overlapping position is found
                while (!foundPosition) {
                    if (!isOverlapping(newX, newY, fixedWidth, newHeight)) {
                        foundPosition = true;
                    }
                    else {
                        newX += fixedWidth + gap;
                        if (newX + fixedWidth > pageWidth) { // If we reach the end of the arbitrary page width
                            newX = 0;
                            newY += newHeight + gap;
                        }
                    }
                }
                // Create a rectangle and place it at the found position
                const memeRect = figma.createRectangle();
                memeRect.resize(fixedWidth, newHeight);
                memeRect.x = newX;
                memeRect.y = newY;
                // Render the image by filling the rectangle
                memeRect.fills = [
                    {
                        type: 'IMAGE',
                        imageHash: image.hash,
                        scaleMode: 'FILL'
                    }
                ];
                // Optionally, you can set the name or other properties of the rectangle
                memeRect.name = "meme";
                // Add the rectangle to the current page
                page.appendChild(memeRect);
                figma.viewport.scrollAndZoomIntoView([memeRect]);
            }));
            figma.notify('Inserted a meme');
        }
        catch (error) {
            figma.notify('Failed to add meme');
            console.error('Error:', error);
        }
    }
    if (msg.type === 'vendor-name-data') {
        const selectedNodes = figma.currentPage.selection;
        const textNodes = selectedNodes.filter((node) => node.type === 'TEXT');
        if (textNodes.length === 0) {
            figma.notify('Please select at least one text layer');
            return;
        }
        const data = yield readRemoteTextFile(VENDOR_NAME_DATA_URL);
        console.log("Data found: ", data);
        if (data.length === 0) {
            figma.notify('No data found to populate.');
            return;
        }
        // Update each selected text node
        for (const node of textNodes) {
            yield figma.loadFontAsync(node.fontName);
        }
        for (let i = 0; i < textNodes.length; i++) {
            const textNode = textNodes[i];
            const dataIndex = i % data.length; // Loop through data if there are more text layers than data
            textNode.characters = data[dataIndex];
        }
        figma.notify('Text layers populated successfully!');
    }
    // Check if the message type is 'image-click'
    if (msg.type === 'image-click') {
        const selectedNodes = figma.currentPage.selection;
        // Check if there are any selected nodes
        if (selectedNodes.length === 0) {
            figma.notify('Please select a shape');
            return;
        }
        // Check if there are any selected nodes
        // const selectedNodes = figma.currentPage.selection;
        if (selectedNodes.length > 0) {
            // Function to apply image fill to a node
            function applyImageFill(node) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE' || node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
                        try {
                            // Load the image and get its hash
                            const imageHash = yield loadImageAsync(msg.url);
                            // Create an image paint object
                            const imagePaint = {
                                type: 'IMAGE',
                                scaleMode: 'FILL',
                                imageHash: imageHash
                            };
                            // Apply the image fill to the selected node
                            node.fills = [imagePaint];
                        }
                        catch (error) {
                            // Log the error and notify the user
                            console.error('Error applying fill:', error);
                            figma.notify('Failed to apply image as fill');
                        }
                    }
                    else {
                        // Notify the user if the selected node is not a valid shape
                        figma.notify('Please select a valid shape');
                    }
                });
            }
            // Iterate over all selected nodes and apply the image fill
            selectedNodes.forEach(node => {
                applyImageFill(node);
            });
        }
        else {
            // Notify the user if no nodes are selected
            figma.notify('Please select at least one shape');
        }
    }
});
// Function to load an image from a URL and return its hash
function loadImageAsync(url) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Fetch the image from the URL
            const response = yield fetch(url);
            // Check if the response is ok
            if (!response.ok) {
                throw new Error(`Network response was not ok, status: ${response.status}`);
            }
            // Convert the response to an array buffer
            const image = yield response.arrayBuffer();
            // Create an image in Figma and return its hash
            const imageHash = figma.createImage(new Uint8Array(image)).hash;
            return imageHash;
        }
        catch (error) {
            // Log the error and notify the user
            console.error('Error loading image:', error);
            figma.notify('Failed to load image. Please try again.');
            throw error; // Re-throw the error if further handling is required
        }
    });
}
;
// In plugin code
figma.on('drop', (event) => {
    const { items, node, dropMetadata } = event;
    if (items.length > 0 && items[0].type === 'text/plain') {
        console.log(items);
        // Get an image from a URL.
        figma.createImageAsync(items[0].data).then((image) => __awaiter(void 0, void 0, void 0, function* () {
            // Create a rectangle that's the same dimensions as the image.
            const node = figma.createRectangle();
            const { width, height } = yield image.getSizeAsync();
            node.resize(width, height);
            // Render the image by filling the rectangle.
            node.fills = [
                {
                    type: 'IMAGE',
                    imageHash: image.hash,
                    scaleMode: 'FILL'
                }
            ];
            node.x = event.x;
            node.y = event.y;
            figma.currentPage.selection = [node];
            figma.notify('Added!');
        }));
    }
    ;
    return false;
});
