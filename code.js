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
const API_URL = 'https://meme-api.com/gimme/dankmemes';
const DATA_URL = 'https://raw.githubusercontent.com/amoghsrivastava/figmate/main/public/vendor_name_data.txt';
// Read the content of the text file from Firebase Storage
function readRemoteTextFile() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield fetch(DATA_URL);
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
figma.showUI(__html__, { width: 360, height: 500 });
// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
// Functions to handle messages from the UI
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    // Functions to handle case
    if (msg.type.startsWith('submit-')) {
        // Check if a text node is selected
        const selectedTextNodes = figma.currentPage.selection.filter(node => node.type === 'TEXT');
        if (selectedTextNodes.length === 0) {
            // If no text node is selected, send a message back to the UI
            figma.notify('Please select at least one text layer.');
            return;
        }
        // Get the case type from the message
        const caseType = msg.type.replace('submit-', '');
        // Function to change text case
        const changeTextCase = (text, type) => {
            // selectedTextNodes[0].textCase = "ORIGINAL";
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
            node.characters = changeTextCase(node.characters, caseType);
            node.textCase = "ORIGINAL";
        }
        // Notify the plugin that the work is done
        // figma.closePlugin();
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
    if (msg.type === 'fill-text') {
        const selectedNodes = figma.currentPage.selection;
        const textNodes = selectedNodes.filter((node) => node.type === 'TEXT');
        if (textNodes.length === 0) {
            figma.notify('Please select at least one text layer.');
            return;
        }
        const data = yield readRemoteTextFile();
        console.log("Data found: ", data);
        if (data.length === 0) {
            figma.notify('No data found to populate.');
            return;
        }
        yield figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });
        for (let i = 0; i < textNodes.length; i++) {
            const textNode = textNodes[i];
            const dataIndex = i % data.length; // Loop through data if there are more text layers than data
            textNode.characters = data[dataIndex];
        }
        figma.notify('Text layers populated successfully!');
    }
});
figma.on("selectionchange", () => {
    const selectedNodes = figma.currentPage.selection;
    const textNodes = selectedNodes.filter(node => node.type === 'TEXT');
    if (textNodes.length === 0) {
        figma.notify('No text layers selected.');
    }
});
