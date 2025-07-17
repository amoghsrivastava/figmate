const API_URL = 'https://meme-api.com/gimme/wholesomememes';
const VENDOR_NAME_DATA_URL = 'https://raw.githubusercontent.com/amoghsrivastava/figmate/main/data/vendor_name_data.txt';



// Read the content of the text file from Firebase Storage
async function readRemoteTextFile(url: string): Promise<string[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    const text = await response.text();
    return text.split('\n').filter((line: string) => line.trim() !== '');

  } catch (error) {
    console.error('Error reading text file:', error);
    figma.notify('Failed to fetch text file data');
    return [];
  }
}
// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// This shows the HTML page in "ui.html".
figma.showUI(__html__, {themeColors: true, width: 310, height: 600 });

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.

// RenamePro functions for advanced case conversion
function detectCaseStyle(text: string): string {
  if (/^[a-z][a-zA-Z0-9]*$/.test(text)) return "camelCase";
  if (/^[A-Z][a-zA-Z0-9]*$/.test(text)) return "PascalCase";
  if (/^[a-z0-9_]+$/.test(text)) return "snake_case";
  if (/^[a-z0-9\-]+$/.test(text)) return "kebab-case";
  if (/^[A-Z][A-Za-z0-9]*(-[A-Z][A-Za-z0-9]*)*$/.test(text)) return "Train-Case";
  if (/^[A-Z0-9_]+$/.test(text)) return "MACRO_CASE";
  return "unknown";
}

function normalizeText(caseStyle: string, text: string): string {
  switch (caseStyle) {
    case "camelCase":
      return text.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
    case "PascalCase":
      return text.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
    case "snake_case":
      return text.replace(/_/g, " ").toLowerCase();
    case "kebab-case":
      return text.replace(/-/g, " ").toLowerCase();
    case "Train-Case":
      return text.replace(/-/g, " ").toLowerCase();
    case "MACRO_CASE":
      return text.replace(/_/g, " ").toLowerCase();
    default:
      return text.toLowerCase();
  }
}

function applyCaseStyle(caseStyle: string, text: string): string {
  switch (caseStyle) {
    case "camelCase":
      return text.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
        index === 0 ? word.toLowerCase() : word.toUpperCase()
      ).replace(/\s+/g, '');
    case "PascalCase":
      return text.replace(/\w+/g, (word) => word[0].toUpperCase() + word.slice(1)).replace(/\s+/g, '');
    case "snake_case":
      return text.replace(/\s+/g, '_').toLowerCase();
    case "kebab-case":
      return text.replace(/\s+/g, '-').toLowerCase();
    case "Train-Case":
      return text.replace(/\b\w/g, (char) => char.toUpperCase()).replace(/\s+/g, '-');
    case "MACRO_CASE":
      return text.replace(/\s+/g, '_').toUpperCase();
    case "Title Case":
      return text.replace(/\b\w/g, (char) => char.toUpperCase());
    case "Sentence case":
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    case "lower case":
      return text.toLowerCase();
    case "UPPER CASE":
      return text.toUpperCase();
    default:
      return text;
  }
}

// Functions to handle messages from the UI
figma.ui.onmessage = async (msg) => {
  // Function to set text style ID
  const setTextStyleId = async (node: TextNode, styleId: string) => {
    try {
      await figma.loadFontAsync(node.fontName as FontName); // Ensure font is loaded
      await figma.getStyleByIdAsync(styleId); // Apply the text style ID to the node
    } catch (error) {
      console.error('Error setting text style ID:', error);
    }
  };
  // Advanced rename functionality with match/replace support
  function applyRename(originalText: string, matchPattern: string, renameTo: string, caseStyle: string): string {
    let newText = originalText;
    
    // If no match pattern is provided
    if (!matchPattern || matchPattern.trim() === '') {
      // Only replace if renameTo has content, otherwise keep original text
      if (renameTo && renameTo.trim() !== '') {
        newText = renameTo;
      }
      // If both match and renameTo are empty, keep original text for case transformation
    } else {
      // Apply find and replace
      if (originalText.includes(matchPattern)) {
        newText = originalText.replace(new RegExp(matchPattern, 'g'), renameTo);
      } else {
        // If no match found, keep original text
        newText = originalText;
      }
    }
    
    // Handle $& token for current name substitution
    newText = newText.replace(/\$&/g, originalText);
    
    // Apply case transformation if specified
    if (caseStyle && caseStyle !== 'Sentence case') {
      const normalizedText = normalizeText(detectCaseStyle(newText), newText);
      newText = applyCaseStyle(caseStyle, normalizedText);
    }
    
    return newText;
  }

  // Handle new rename functionality
  if (msg.type === 'rename-apply') {
    const selectedNodes = figma.currentPage.selection;

    if (msg.mode === "Text Mode") {
      const textNodes = selectedNodes.filter(node => node.type === "TEXT");

      if (textNodes.length === 0) {
        figma.notify('Please select at least one text layer');
        return;
      }

      // Load fonts for each text node and then modify the text
      await Promise.all(textNodes.map(async (textNode) => {
        if (textNode.type === "TEXT") {
          // Load the font for this text node before modifying its characters
          await figma.loadFontAsync(textNode.fontName as FontName);

          // Apply the advanced rename logic
          const newText = applyRename(
            textNode.characters, 
            msg.matchPattern, 
            msg.renameTo, 
            msg.caseStyle
          );
          
          textNode.characters = newText;
        }
      }));

      figma.notify('Text updated successfully');

    } else if (msg.mode === "Layer Mode") {
      // Filter for all renameable node types (any node with a name property)
      const renameableNodeTypes = [
        "FRAME",
        "GROUP", 
        "RECTANGLE",
        "ELLIPSE",
        "TEXT",
        "VECTOR",
        "STAR",
        "POLYGON",
        "LINE",
        "COMPONENT",
        "INSTANCE",
        "COMPONENT_SET",
        "SLICE",
        "BOOLEAN_OPERATION"
      ];
      
      const renameableNodes = selectedNodes.filter(node => {
        return renameableNodeTypes.indexOf(node.type) !== -1;
      });

      if (renameableNodes.length === 0) {
        figma.notify('Please select at least one layer');
        return;
      }

      // Apply advanced rename logic to the names of selected nodes
      renameableNodes.forEach(node => {
        const newName = applyRename(
          node.name, 
          msg.matchPattern, 
          msg.renameTo, 
          msg.caseStyle
        );
        
        node.name = newName;
      });

      figma.notify(`${renameableNodes.length} layer name(s) updated successfully`);
    }
  }

  // Functions to handle character count
  if (msg.type.startsWith('char-count')) {
    let totalChars = 0;
    // Check if a text node is selected
    const selectedTextNodes = figma.currentPage.selection.filter(node => node.type === 'TEXT') as TextNode[];

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
    } else if (selectedNodes.length === 1) {
      figma.notify(selectedNodes.length + ' object');
    } else {
      figma.notify(selectedNodes.length + ' objects');
    }
    // figma.ui.postMessage(totalChars);
  }

  // Functions to add a meme to the UI
  if (msg.type === 'addMeme') {
    try {
      const response = await fetch(API_URL);
      const data = await response.json();
      const imageUrl = data.preview[2];

      figma.createImageAsync(imageUrl).then(async (image: Image) => {
        const page = figma.currentPage;
        const children = page.children;

        // Get the original dimensions of the image
        const { width: imageWidth, height: imageHeight } = await image.getSizeAsync();

        // Set the fixed width and calculate the proportional height
        const fixedWidth = 320;
        const newHeight = (imageHeight / imageWidth) * fixedWidth;

        // Function to check if the new position overlaps with existing elements
        function isOverlapping(x: number, y: number, width: number, height: number): boolean {
          for (const child of children) {
            if ('absoluteBoundingBox' in child && child.absoluteBoundingBox) {
              const { x: childX, y: childY, width: childWidth, height: childHeight } = child.absoluteBoundingBox;
              if (
                x < childX + childWidth &&
                x + width > childX &&
                y < childY + childHeight &&
                y + height > childY
              ) {
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
          } else {
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
      });

      figma.notify('Inserted a meme');
    } catch (error) {
      figma.notify('Failed to add meme');
      console.error('Error:', error);
    }

  }

  if (msg.type === 'vendor-name-data') {
    const selectedNodes = figma.currentPage.selection;
    const textNodes: TextNode[] = selectedNodes.filter((node): node is TextNode => node.type === 'TEXT');

    if (textNodes.length === 0) {
      figma.notify('Please select at least one text layer');
      return;
    }

    const data = await readRemoteTextFile(VENDOR_NAME_DATA_URL);
    console.log("Data found: ", data);
    if (data.length === 0) {
      figma.notify('No data found to populate.');
      return;
    }

    // Update each selected text node
    for (const node of textNodes) {
      await figma.loadFontAsync(node.fontName as FontName);
    }

    for (let i = 0; i < textNodes.length; i++) {
      const textNode = textNodes[i];
      const dataIndex = i % data.length; // Loop through data if there are more text layers than data
      textNode.characters = data[dataIndex];
    }

    figma.notify('Text layers populated successfully!');
  }

  // Function to handle copying layer names
  if (msg.type === 'copy-layer-names') {
    const selectedNodes = figma.currentPage.selection;

    if (selectedNodes.length === 0) {
      figma.notify('Please select at least one layer');
      return;
    }

    // Extract layer names and join with new lines
    const layerNames = selectedNodes.map(node => node.name);
    const layerNamesText = layerNames.join('\n');

    // Copy to clipboard using the UI postMessage
    figma.ui.postMessage({
      type: 'copy-to-clipboard',
      content: layerNamesText
    });

    // Notify user
    const layerCount = selectedNodes.length;
    const layerWord = layerCount === 1 ? 'layer name' : 'layer names';
    figma.notify(`Copied ${layerCount} ${layerWord} to clipboard`);
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
      async function applyImageFill(node: any) {
        if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE' || node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
          try {
            // Load the image and get its hash
            const imageHash = await loadImageAsync(msg.url);

            // Create an image paint object
            const imagePaint = {
              type: 'IMAGE',
              scaleMode: 'FILL',
              imageHash: imageHash
            };

            // Apply the image fill to the selected node
            node.fills = [imagePaint];
          } catch (error) {
            // Log the error and notify the user
            console.error('Error applying fill:', error);
            figma.notify('Failed to apply image as fill');
          }
        } else {
          // Notify the user if the selected node is not a valid shape
          figma.notify('Please select a valid shape');
        }
      }

      // Iterate over all selected nodes and apply the image fill
      selectedNodes.forEach(node => {
        applyImageFill(node);
      }
      );
    } else {
      // Notify the user if no nodes are selected
      figma.notify('Please select at least one shape');
    }

  }
};



// Function to load an image from a URL and return its hash
async function loadImageAsync(url: any): Promise<string> {
  try {
    // Fetch the image from the URL
    const response = await fetch(url);

    // Check if the response is ok
    if (!response.ok) {
      throw new Error(`Network response was not ok, status: ${response.status}`);
    }

    // Convert the response to an array buffer
    const image = await response.arrayBuffer();

    // Create an image in Figma and return its hash
    const imageHash = figma.createImage(new Uint8Array(image)).hash;
    return imageHash;
  } catch (error) {
    // Log the error and notify the user
    console.error('Error loading image:', error);
    figma.notify('Failed to load image. Please try again.');
    throw error; // Re-throw the error if further handling is required
  }
};

// In plugin code
figma.on('drop', (event) => {
  const { items, node, dropMetadata } = event;
  if (items.length > 0 && items[0].type === 'text/plain') {
    console.log(items);
    // Get an image from a URL.
    figma.createImageAsync(
      items[0].data
    ).then(async (image: Image) => {
      // Create a rectangle that's the same dimensions as the image.
      const node = figma.createRectangle()
      const { width, height } = await image.getSizeAsync()
      node.resize(width, height)
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
    });
  };
  return false;
}
);