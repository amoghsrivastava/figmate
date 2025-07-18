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
let copiedInstanceData = null;
// Performance optimization: Cache for hierarchy paths to avoid recalculation
// Using WeakMap for automatic garbage collection when nodes are removed
const hierarchyPathCache = new WeakMap();
const nodeCollectionCache = new WeakMap();
// Global font cache to prevent reloading the same fonts across operations
const loadedFontsCache = new Set();
// Helper function to build hierarchy path relative to instance root (used in both copy and paste)
function buildInternalHierarchyPath(node, instanceRoot) {
    // Get or create the cache map for this instance root
    let rootCache = hierarchyPathCache.get(instanceRoot);
    if (!rootCache) {
        rootCache = new Map();
        hierarchyPathCache.set(instanceRoot, rootCache);
    }
    const cacheKey = node.id;
    if (rootCache.has(cacheKey)) {
        return rootCache.get(cacheKey);
    }
    const path = [];
    let current = node.parent;
    while (current && current !== instanceRoot && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
        path.unshift(current.name);
        current = current.parent;
    }
    rootCache.set(cacheKey, path);
    return path;
}
// Performance optimization: Set of overridable node types to filter during traversal
const OVERRIDABLE_NODE_TYPES = new Set([
    'TEXT', 'INSTANCE', 'RECTANGLE', 'ELLIPSE', 'VECTOR', 'FRAME',
    'COMPONENT', 'GROUP', 'LINE', 'STAR', 'POLYGON', 'BOOLEAN_OPERATION'
]);
// Performance optimization: Custom deep compare for Paint arrays (faster than JSON.stringify)
function paintsEqual(a, b) {
    if (!a && !b)
        return true;
    if (!a || !b)
        return false;
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i++) {
        const paintA = a[i];
        const paintB = b[i];
        if (paintA.type !== paintB.type)
            return false;
        // Compare relevant fields based on paint type
        if (paintA.type === 'SOLID' && paintB.type === 'SOLID') {
            if (paintA.color.r !== paintB.color.r ||
                paintA.color.g !== paintB.color.g ||
                paintA.color.b !== paintB.color.b ||
                paintA.opacity !== paintB.opacity) {
                return false;
            }
        }
        else if (paintA.type === 'IMAGE' && paintB.type === 'IMAGE') {
            if (paintA.imageHash !== paintB.imageHash ||
                paintA.scaleMode !== paintB.scaleMode) {
                return false;
            }
        }
        // Add other paint type comparisons as needed
    }
    return true;
}
// Performance optimization: Custom deep compare for FontName objects
function fontNamesEqual(a, b) {
    if (!a && !b)
        return true;
    if (!a || !b)
        return false;
    return a.family === b.family && a.style === b.style;
}
// Performance optimization: Efficient property comparison without JSON.stringify
function propertiesEqual(a, b) {
    if (a === b)
        return true;
    if (!a || !b)
        return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length)
        return false;
    for (const key of keysA) {
        if (keysB.indexOf(key) === -1)
            return false;
        if (a[key] !== b[key])
            return false;
    }
    return true;
}
// Performance optimization: Custom typed cloning functions (much faster than JSON.stringify/parse)
function clonePaint(paint) {
    if (paint.type === 'SOLID') {
        return {
            type: 'SOLID',
            color: { r: paint.color.r, g: paint.color.g, b: paint.color.b },
            opacity: paint.opacity
        };
    }
    else if (paint.type === 'IMAGE') {
        return {
            type: 'IMAGE',
            imageHash: paint.imageHash,
            scaleMode: paint.scaleMode,
            imageTransform: paint.imageTransform,
            scalingFactor: paint.scalingFactor,
            filters: paint.filters,
            visible: paint.visible
        };
    }
    else if (paint.type === 'GRADIENT_LINEAR' || paint.type === 'GRADIENT_RADIAL' || paint.type === 'GRADIENT_DIAMOND' || paint.type === 'GRADIENT_ANGULAR') {
        return {
            type: paint.type,
            gradientTransform: paint.gradientTransform,
            gradientStops: paint.gradientStops,
            opacity: paint.opacity,
            visible: paint.visible
        };
    }
    return paint; // Fallback for unknown paint types
}
function clonePaintArray(paints) {
    if (!paints)
        return undefined;
    return paints.map(clonePaint);
}
function cloneFontName(fontName) {
    return {
        family: fontName.family,
        style: fontName.style
    };
}
function cloneVariantProperties(props) {
    const cloned = {};
    for (const key in props) {
        cloned[key] = props[key];
    }
    return cloned;
}
function cloneComponentProperties(props) {
    const cloned = {};
    for (const key in props) {
        const value = props[key];
        if (value && typeof value === 'object' && 'value' in value) {
            // Handle component property objects like {value: 'text', type: 'TEXT'}
            cloned[key] = Object.assign({}, value);
        }
        else {
            cloned[key] = value;
        }
    }
    return cloned;
}
// Performance optimization: Batch node collection with caching
function collectAllNodesWithCache(root) {
    if (nodeCollectionCache.has(root)) {
        return nodeCollectionCache.get(root);
    }
    const allDescendants = 'findAll' in root
        ? root.findAll((node) => OVERRIDABLE_NODE_TYPES.has(node.type))
        : [];
    const allNodes = [root, ...allDescendants];
    nodeCollectionCache.set(root, allNodes);
    return allNodes;
}
// Performance optimization: Clear all caches to prevent memory leaks
function clearAllCaches() {
    // WeakMaps automatically handle garbage collection, but we can clear the font cache
    loadedFontsCache.clear();
}
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
// This shows the HTML page in "ui.html".
figma.showUI(__html__, { themeColors: true, width: 310, height: 600 });
// Listen for selection changes to update component button states
figma.on('selectionchange', () => __awaiter(void 0, void 0, void 0, function* () {
    yield updateComponentButtonStates();
}));
// Initialize button states
updateComponentButtonStates();
// 🔄 Button state management
function updateComponentButtonStates() {
    return __awaiter(this, void 0, void 0, function* () {
        const selection = figma.currentPage.selection;
        // Copy: exactly one instance selected
        const canCopy = selection.length === 1 && selection[0].type === 'INSTANCE';
        // Paste: data exists and instances selected
        const canPaste = !!copiedInstanceData &&
            selection.length > 0 &&
            selection.every(node => node.type === 'INSTANCE');
        figma.ui.postMessage({
            type: 'update-component-buttons',
            canCopy,
            canPaste
        });
    });
}
// RenamePro functions for advanced case conversion
function detectCaseStyle(text) {
    if (/^[a-z][a-zA-Z0-9]*$/.test(text))
        return "camelCase";
    if (/^[A-Z][a-zA-Z0-9]*$/.test(text))
        return "PascalCase";
    if (/^[a-z0-9_]+$/.test(text))
        return "snake_case";
    if (/^[a-z0-9\-]+$/.test(text))
        return "kebab-case";
    if (/^[A-Z][A-Za-z0-9]*(-[A-Z][A-Za-z0-9]*)*$/.test(text))
        return "Train-Case";
    if (/^[A-Z0-9_]+$/.test(text))
        return "MACRO_CASE";
    return "unknown";
}
function normalizeText(caseStyle, text) {
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
function applyCaseStyle(caseStyle, text) {
    switch (caseStyle) {
        case "camelCase":
            return text.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => index === 0 ? word.toLowerCase() : word.toUpperCase()).replace(/\s+/g, '');
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
figma.ui.onmessage = (msg) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // Advanced rename functionality with match/replace support
    function applyRename(originalText, matchPattern, renameTo, caseStyle) {
        let newText = originalText;
        if (!matchPattern || matchPattern.trim() === '') {
            if (renameTo && renameTo.trim() !== '') {
                newText = renameTo;
            }
        }
        else {
            if (originalText.includes(matchPattern)) {
                newText = originalText.replace(new RegExp(matchPattern, 'g'), renameTo);
            }
            else {
                newText = originalText;
            }
        }
        newText = newText.replace(/\$&/g, originalText);
        if (caseStyle && caseStyle !== 'Sentence case') {
            const normalizedText = normalizeText(detectCaseStyle(newText), newText);
            newText = applyCaseStyle(caseStyle, normalizedText);
        }
        return newText;
    }
    // 🎯 COPY INSTANCE DATA - Override detection system
    if (msg.type === 'copy-instance-data') {
        const selection = figma.currentPage.selection;
        if (selection.length !== 1 || selection[0].type !== 'INSTANCE') {
            figma.notify('Please select exactly one component instance');
            yield updateComponentButtonStates();
            return;
        }
        // Send immediate feedback that operation has started
        figma.ui.postMessage({
            type: 'operation-started',
            operation: 'copy'
        });
        // Small delay to ensure UI updates are processed
        yield new Promise(resolve => setTimeout(resolve, 10));
        const instance = selection[0];
        try {
            // Get main component for comparison
            const mainComponent = yield instance.getMainComponentAsync();
            if (!mainComponent) {
                figma.notify('Selected instance has no main component');
                yield updateComponentButtonStates();
                return;
            }
            // Get component set for cross-variant compatibility
            const componentSet = ((_a = mainComponent.parent) === null || _a === void 0 ? void 0 : _a.type) === 'COMPONENT_SET' ? mainComponent.parent : null;
            // Extract variant and component properties  
            const variantProperties = {};
            for (const key in instance.variantProperties || {}) {
                variantProperties[key] = String(instance.variantProperties[key]);
            }
            let componentProperties = {};
            try {
                componentProperties = JSON.parse(JSON.stringify(instance.componentProperties || {}));
            }
            catch (err) {
                componentProperties = {};
            }
            // 🔍 BUILD OVERRIDE DETECTION SYSTEM
            // This system detects actual overrides by comparing the current instance state
            // with the main component's default state. Includes comprehensive fallback
            // for cases where corresponding nodes cannot be found (e.g., nested instances)
            const overrides = [];
            // Helper function to create unique signatures (INTERNAL TO INSTANCE)
            function createUniqueSignature(node, instanceRoot, hierarchyPath, siblingIndex) {
                return `${node.type}:${node.name}:${hierarchyPath.join('/')}:${siblingIndex}`;
            }
            // Performance optimization: Build a map of all nodes in the main component by internal signature
            let mainComponentSignatureMap = null;
            function buildMainComponentSignatureMap(mainComponent) {
                const map = new Map();
                // Use cached node collection for better performance
                const allNodes = collectAllNodesWithCache(mainComponent);
                for (const node of allNodes) {
                    const hierarchyPath = buildInternalHierarchyPath(node, mainComponent);
                    let siblingIndex = 0;
                    if (node.parent && 'children' in node.parent) {
                        const children = node.parent.children;
                        const matchingSiblings = children.filter((child) => child.name === node.name && child.type === node.type);
                        siblingIndex = matchingSiblings.indexOf(node);
                    }
                    const signature = createUniqueSignature(node, mainComponent, hierarchyPath, siblingIndex);
                    map.set(signature, node);
                }
                return map;
            }
            // Helper function to calculate sibling index
            function getSiblingIndex(node) {
                if (!node.parent || !('children' in node.parent))
                    return 0;
                const siblings = node.parent.children;
                const matchingSiblings = siblings.filter((child) => child.name === node.name && child.type === node.type);
                return matchingSiblings.indexOf(node);
            }
            // Helper function to compare properties and detect overrides
            function detectOverrides(instanceNode, defaultNode) {
                const overrideData = {};
                let hasOverride = false;
                try {
                    // TEXT OVERRIDES
                    if (instanceNode.type === 'TEXT' && defaultNode.type === 'TEXT') {
                        const instText = instanceNode;
                        const defText = defaultNode;
                        if (instText.characters !== defText.characters) {
                            overrideData.characters = instText.characters;
                            hasOverride = true;
                        }
                        // Font override detection - use efficient comparison
                        if (instText.fontName !== figma.mixed && defText.fontName !== figma.mixed && !fontNamesEqual(instText.fontName, defText.fontName)) {
                            try {
                                overrideData.fontName = cloneFontName(instText.fontName);
                                hasOverride = true;
                            }
                            catch (err) { }
                        }
                        if (typeof instText.fontSize === 'number' && typeof defText.fontSize === 'number' && instText.fontSize !== defText.fontSize) {
                            overrideData.fontSize = instText.fontSize;
                            hasOverride = true;
                        }
                        if (instText.fills !== figma.mixed && defText.fills !== figma.mixed && !paintsEqual(instText.fills, defText.fills)) {
                            try {
                                overrideData.fills = clonePaintArray(instText.fills);
                                hasOverride = true;
                            }
                            catch (err) { }
                        }
                    }
                    // VISUAL OVERRIDES
                    if ('opacity' in instanceNode && 'opacity' in defaultNode) {
                        if (instanceNode.opacity !== defaultNode.opacity) {
                            overrideData.opacity = instanceNode.opacity;
                            hasOverride = true;
                        }
                    }
                    if ('visible' in instanceNode && 'visible' in defaultNode) {
                        if (instanceNode.visible !== defaultNode.visible) {
                            overrideData.visible = instanceNode.visible;
                            hasOverride = true;
                        }
                    }
                    // FILL OVERRIDES (for shapes, not text)
                    if (('fills' in instanceNode && 'fills' in defaultNode) &&
                        (instanceNode.type === 'VECTOR' || instanceNode.type === 'BOOLEAN_OPERATION' || instanceNode.type === 'RECTANGLE' || instanceNode.type === 'ELLIPSE' || instanceNode.type === 'POLYGON' || instanceNode.type === 'STAR' || instanceNode.type === 'LINE' || instanceNode.type === 'FRAME' || instanceNode.type === 'COMPONENT' || instanceNode.type === 'INSTANCE')) {
                        const instanceFills = instanceNode.fills;
                        const defaultFills = defaultNode.fills;
                        const fillsEqual = JSON.stringify(instanceFills) === JSON.stringify(defaultFills);
                        // Always capture fills if present (for node types that can have fills)
                        if (('fills' in instanceNode && 'fills' in defaultNode) &&
                            (instanceNode.type === 'VECTOR' || instanceNode.type === 'BOOLEAN_OPERATION' || instanceNode.type === 'RECTANGLE' || instanceNode.type === 'ELLIPSE' || instanceNode.type === 'POLYGON' || instanceNode.type === 'STAR' || instanceNode.type === 'LINE' || instanceNode.type === 'FRAME' || instanceNode.type === 'COMPONENT' || instanceNode.type === 'INSTANCE')) {
                            const instanceFills = instanceNode.fills;
                            if (instanceFills && instanceFills.length > 0) {
                                try {
                                    overrideData.layerFills = clonePaintArray(instanceFills);
                                    hasOverride = true;
                                }
                                catch (err) { }
                            }
                        }
                    }
                    // STROKE OVERRIDES
                    if ('strokes' in instanceNode && 'strokes' in defaultNode) {
                        const instanceStrokes = instanceNode.strokes;
                        const defaultStrokes = defaultNode.strokes;
                        if (!paintsEqual(instanceStrokes, defaultStrokes)) {
                            try {
                                overrideData.layerStrokes = clonePaintArray(instanceStrokes);
                                hasOverride = true;
                            }
                            catch (err) { }
                        }
                    }
                    // INSTANCE OVERRIDES (nested components)
                    if (instanceNode.type === 'INSTANCE' && defaultNode.type === 'INSTANCE') {
                        const instNode = instanceNode;
                        const defNode = defaultNode;
                        // Variant properties override
                        if (!propertiesEqual(instNode.variantProperties || {}, defNode.variantProperties || {})) {
                            overrideData.variantProperties = cloneVariantProperties(instNode.variantProperties || {});
                            hasOverride = true;
                        }
                        // Component properties override
                        if (!propertiesEqual(instNode.componentProperties || {}, defNode.componentProperties || {})) {
                            try {
                                overrideData.componentProperties = cloneComponentProperties(instNode.componentProperties || {});
                                hasOverride = true;
                            }
                            catch (err) { }
                        }
                    }
                }
                catch (err) {
                    // Skip nodes with comparison errors
                }
                return hasOverride ? overrideData : null;
            }
            // Helper function to find corresponding node in main component (now uses signature map)
            function findCorrespondingNode(instanceNode, internalHierarchyPath, siblingIndex) {
                try {
                    if (!mainComponent)
                        return null;
                    if (!mainComponentSignatureMap) {
                        mainComponentSignatureMap = buildMainComponentSignatureMap(mainComponent);
                    }
                    // Special handling for the root instance itself - but we still need to compare it
                    if (instanceNode === instance) {
                        return mainComponent; // Return main component for comparison
                    }
                    // Build the signature for this node relative to the main component
                    const signature = createUniqueSignature(instanceNode, instance, internalHierarchyPath, siblingIndex);
                    // Look up in the main component's signature map
                    return mainComponentSignatureMap.get(signature) || null;
                }
                catch (err) { }
                return null;
            }
            // Collect actual overrides by comparing with main component
            function collectOverrides(instanceNode) {
                // Performance optimization: Use cached node collection
                const allNodes = collectAllNodesWithCache(instanceNode);
                for (const node of allNodes) {
                    try {
                        // Build hierarchy path RELATIVE TO INSTANCE ROOT
                        const hierarchyPath = buildInternalHierarchyPath(node, instanceNode);
                        const siblingIndex = getSiblingIndex(node);
                        const uniqueSignature = createUniqueSignature(node, instanceNode, hierarchyPath, siblingIndex);
                        // Find corresponding node in main component (mainComponent is guaranteed to exist here)
                        const defaultNode = findCorrespondingNode(node, hierarchyPath, siblingIndex);
                        if (defaultNode) {
                            // Detect overrides by comparison
                            const overrideData = detectOverrides(node, defaultNode);
                            if (overrideData) {
                                const override = Object.assign({ nodeId: node.id, nodeName: node.name, nodeType: node.type, hierarchyPath,
                                    siblingIndex,
                                    uniqueSignature }, overrideData);
                                overrides.push(override);
                            }
                        }
                        else {
                            // 🔄 COMPREHENSIVE FALLBACK: Capture current state when comparison fails
                            // This ensures overrides are preserved even if we can't find the default state
                            const fallbackOverrideData = {};
                            let hasFallbackData = false;
                            // FALLBACK FOR NESTED INSTANCES
                            if (node.type === 'INSTANCE') {
                                const instNode = node;
                                // Capture variant properties if they exist
                                if (instNode.variantProperties && Object.keys(instNode.variantProperties).length > 0) {
                                    fallbackOverrideData.variantProperties = {};
                                    for (const key in instNode.variantProperties) {
                                        fallbackOverrideData.variantProperties[key] = String(instNode.variantProperties[key]);
                                    }
                                    hasFallbackData = true;
                                }
                                // Capture component properties if they exist
                                if (instNode.componentProperties && Object.keys(instNode.componentProperties).length > 0) {
                                    try {
                                        fallbackOverrideData.componentProperties = JSON.parse(JSON.stringify(instNode.componentProperties));
                                        hasFallbackData = true;
                                    }
                                    catch (err) {
                                        // Skip non-serializable component properties
                                    }
                                }
                            }
                            // FALLBACK FOR TEXT NODES
                            if (node.type === 'TEXT') {
                                const textNode = node;
                                try {
                                    // Capture text content (most common override)
                                    if (textNode.characters && textNode.characters.trim() !== '') {
                                        fallbackOverrideData.characters = textNode.characters;
                                        hasFallbackData = true;
                                    }
                                    // Capture font properties if different from default
                                    if (textNode.fontName && textNode.fontName !== figma.mixed) {
                                        try {
                                            fallbackOverrideData.fontName = cloneFontName(textNode.fontName);
                                            hasFallbackData = true;
                                        }
                                        catch (err) { }
                                    }
                                    if (typeof textNode.fontSize === 'number') {
                                        fallbackOverrideData.fontSize = textNode.fontSize;
                                        hasFallbackData = true;
                                    }
                                    if (textNode.fills && textNode.fills !== figma.mixed) {
                                        try {
                                            fallbackOverrideData.fills = clonePaintArray(textNode.fills);
                                            hasFallbackData = true;
                                        }
                                        catch (err) { }
                                    }
                                }
                                catch (err) {
                                    // Skip text capture errors
                                }
                            }
                            // FALLBACK FOR VISUAL PROPERTIES
                            if ('opacity' in node && node.opacity !== 1) {
                                fallbackOverrideData.opacity = node.opacity;
                                hasFallbackData = true;
                            }
                            if ('visible' in node && !node.visible) {
                                fallbackOverrideData.visible = node.visible;
                                hasFallbackData = true;
                            }
                            // FALLBACK FOR SHAPE FILLS (for node types that can have fills)
                            if ('fills' in node &&
                                (node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION' || node.type === 'RECTANGLE' || node.type === 'ELLIPSE' || node.type === 'POLYGON' || node.type === 'STAR' || node.type === 'LINE' || node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') &&
                                node.fills) {
                                try {
                                    const fills = node.fills;
                                    if (fills && fills.length > 0) {
                                        fallbackOverrideData.layerFills = clonePaintArray(fills);
                                        hasFallbackData = true;
                                    }
                                }
                                catch (err) {
                                    // Skip fallback fill capture errors
                                }
                            }
                            // FALLBACK FOR STROKES
                            if ('strokes' in node && node.strokes) {
                                try {
                                    const strokes = node.strokes;
                                    if (strokes && strokes.length > 0) {
                                        fallbackOverrideData.layerStrokes = clonePaintArray(strokes);
                                        hasFallbackData = true;
                                    }
                                }
                                catch (err) { }
                            }
                            if (hasFallbackData) {
                                const fallbackOverride = Object.assign({ nodeId: node.id, nodeName: node.name, nodeType: node.type, hierarchyPath,
                                    siblingIndex,
                                    uniqueSignature }, fallbackOverrideData);
                                overrides.push(fallbackOverride);
                            }
                        }
                    }
                    catch (err) {
                        // Skip nodes with processing errors
                    }
                }
            }
            // Collect overrides
            // Reset the mainComponentSignatureMap before collecting overrides (in case of multiple copies)
            mainComponentSignatureMap = null;
            // Send progress update
            figma.ui.postMessage({
                type: 'operation-progress',
                operation: 'copy',
                message: 'Analyzing instance structure...'
            });
            collectOverrides(instance);
            // ✅ ENSURE ROOT INSTANCE COMPONENT PROPERTIES ARE CAPTURED
            // The root instance's component properties (like "Label") need special handling
            // because they might not be detected by the normal override detection
            if (Object.keys(componentProperties).length > 0) {
                // Check if we already captured the root instance's component properties
                const rootInstanceOverride = overrides.find(override => override.nodeId === instance.id && override.componentProperties);
                if (!rootInstanceOverride) {
                    // If not captured, add them as a fallback
                    const rootOverride = {
                        nodeId: instance.id,
                        nodeName: instance.name,
                        nodeType: instance.type,
                        hierarchyPath: [],
                        siblingIndex: 0,
                        uniqueSignature: createUniqueSignature(instance, instance, [], 0),
                        componentProperties: componentProperties
                    };
                    overrides.push(rootOverride);
                }
            }
            // Store the copied data
            copiedInstanceData = {
                sourceComponentName: mainComponent.name,
                sourceInstanceName: instance.name,
                sourceComponentSetId: (componentSet === null || componentSet === void 0 ? void 0 : componentSet.id) || null,
                sourceMainComponentId: mainComponent.id,
                variantProperties,
                componentProperties,
                overrides,
                timestamp: Date.now()
            };
            // Debug: Log what we captured
            console.log('📋 Copy Summary:', {
                componentName: mainComponent.name,
                variantProperties: Object.keys(variantProperties),
                componentProperties: Object.keys(componentProperties),
                totalOverrides: overrides.length,
                nestedInstances: overrides.filter(o => o.nodeType === 'INSTANCE').length,
                textOverrides: overrides.filter(o => o.nodeType === 'TEXT').length
            });
            // Debug: Log nested instance overrides specifically
            const nestedInstanceOverrides = overrides.filter(o => o.nodeType === 'INSTANCE');
            if (nestedInstanceOverrides.length > 0) {
                console.log('🔗 Nested Instance Overrides:', nestedInstanceOverrides.map(o => ({
                    nodeName: o.nodeName,
                    componentProperties: o.componentProperties ? Object.keys(o.componentProperties) : [],
                    variantProperties: o.variantProperties ? Object.keys(o.variantProperties) : []
                })));
            }
            figma.notify(`🎯 Copied ${overrides.length} overrides from ${mainComponent.name}`);
            yield updateComponentButtonStates();
            // Clear caches after copy to free memory
            clearAllCaches();
        }
        catch (error) {
            console.error('❌ Copy operation failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            figma.notify(`Failed to copy instance data: ${errorMessage}`);
            // Update button states to clear loading indicators even on error
            yield updateComponentButtonStates();
        }
    }
    // 🎯 PASTE INSTANCE DATA - Advanced override application with cross-variant support
    if (msg.type === 'paste-instance-data') {
        const selection = figma.currentPage.selection;
        if (!copiedInstanceData) {
            figma.notify('No instance data copied. Please copy from an instance first.');
            yield updateComponentButtonStates();
            return;
        }
        if (selection.length === 0) {
            figma.notify('Please select one or more component instances to paste to');
            yield updateComponentButtonStates();
            return;
        }
        const instances = selection.filter(node => node.type === 'INSTANCE');
        if (instances.length !== selection.length) {
            figma.notify('Please select only component instances.');
            yield updateComponentButtonStates();
            return;
        }
        // Send immediate feedback that operation has started
        figma.ui.postMessage({
            type: 'operation-started',
            operation: 'paste'
        });
        // Small delay to ensure UI updates are processed
        yield new Promise(resolve => setTimeout(resolve, 10));
        try {
            // Performance optimization: Global font batching with caching
            const fontsToLoad = new Set();
            for (const override of copiedInstanceData.overrides) {
                if (override.fontName) {
                    const fontKey = JSON.stringify(override.fontName);
                    if (!loadedFontsCache.has(fontKey)) {
                        fontsToLoad.add(fontKey);
                    }
                }
            }
            // Load only fonts that haven't been loaded before
            if (fontsToLoad.size > 0) {
                yield Promise.all(Array.from(fontsToLoad).map((fontStr) => __awaiter(void 0, void 0, void 0, function* () {
                    const font = JSON.parse(fontStr);
                    yield figma.loadFontAsync(font);
                    loadedFontsCache.add(fontStr);
                })));
            }
            // Performance optimization: Pre-filter compatible instances to avoid repeated async calls
            const compatibilityChecks = yield Promise.all(instances.map((instance) => __awaiter(void 0, void 0, void 0, function* () {
                var _b;
                try {
                    const targetMainComponent = yield instance.getMainComponentAsync();
                    if (!targetMainComponent)
                        return { instance, compatible: false };
                    const isCompatible = targetMainComponent.id === copiedInstanceData.sourceMainComponentId || // Same component
                        (copiedInstanceData.sourceComponentSetId &&
                            ((_b = targetMainComponent.parent) === null || _b === void 0 ? void 0 : _b.type) === 'COMPONENT_SET' &&
                            targetMainComponent.parent.id === copiedInstanceData.sourceComponentSetId); // Same component set
                    return { instance, compatible: isCompatible, mainComponent: targetMainComponent };
                }
                catch (err) {
                    return { instance, compatible: false };
                }
            })));
            const compatibleInstances = compatibilityChecks.filter(check => check.compatible);
            const skippedCount = instances.length - compatibleInstances.length;
            if (compatibleInstances.length === 0) {
                figma.notify('⚠️ No compatible instances found. Please select instances from the same component or component set.');
                yield updateComponentButtonStates();
                return;
            }
            // Send progress update
            figma.ui.postMessage({
                type: 'operation-progress',
                operation: 'paste',
                message: `Applying overrides to ${compatibleInstances.length} instances...`
            });
            // Performance optimization: Process compatible instances in parallel
            const results = yield Promise.all(compatibleInstances.map((_c) => __awaiter(void 0, [_c], void 0, function* ({ instance }) {
                try {
                    // ✅ FIRST: APPLY VARIANT AND COMPONENT PROPERTIES
                    // These changes can restructure the entire instance, so we do them first
                    if (copiedInstanceData && Object.keys(copiedInstanceData.variantProperties).length > 0) {
                        yield instance.setProperties(copiedInstanceData.variantProperties);
                    }
                    // ✅ SECOND: APPLY COMPONENT PROPERTIES (like "Label" text)
                    // Component properties must be applied after variant properties but before other overrides
                    if (copiedInstanceData && Object.keys(copiedInstanceData.componentProperties).length > 0) {
                        try {
                            // For the root instance, use the correct Figma API
                            for (const key of Object.keys(copiedInstanceData.componentProperties)) {
                                const propertyData = copiedInstanceData.componentProperties[key];
                                try {
                                    // Extract the actual value from the component property object
                                    // Component properties are stored as objects like {value: 'text', type: 'TEXT'}
                                    // but setProperties expects simple key-value pairs
                                    let actualValue;
                                    if (propertyData && typeof propertyData === 'object' && 'value' in propertyData) {
                                        // Extract the value field from the component property object
                                        actualValue = propertyData.value;
                                    }
                                    else {
                                        // Fallback: use the property data directly if it's not a complex object
                                        actualValue = propertyData;
                                    }
                                    // Try different approaches for root instance component properties
                                    let success = false;
                                    // Approach 1: Try setComponentPropertyValue (for nested instances)
                                    if (typeof instance.setComponentPropertyValue === 'function') {
                                        try {
                                            instance.setComponentPropertyValue(key, actualValue);
                                            success = true;
                                        }
                                        catch (setCompErr) {
                                            // setComponentPropertyValue failed, try next approach
                                        }
                                    }
                                    // Approach 2: Try setProperties with the extracted value
                                    if (!success && typeof instance.setProperties === 'function') {
                                        try {
                                            instance.setProperties({ [key]: actualValue });
                                            success = true;
                                        }
                                        catch (setPropsErr) {
                                            // setProperties failed, try next approach
                                        }
                                    }
                                    // Approach 3: Try direct assignment to componentProperties (if it's writable)
                                    if (!success) {
                                        try {
                                            const currentProps = Object.assign({}, instance.componentProperties);
                                            currentProps[key] = actualValue;
                                            instance.componentProperties = currentProps;
                                            success = true;
                                        }
                                        catch (assignErr) {
                                            // Direct assignment failed
                                        }
                                    }
                                    if (!success) {
                                        console.warn(`Cannot set component property ${key}: no available method`);
                                    }
                                }
                                catch (propErr) {
                                    // Skip problematic component properties but continue with others
                                    console.warn(`Failed to set component property ${key}:`, propErr);
                                }
                            }
                        }
                        catch (compErr) {
                            // If the entire component property operation fails, log but continue
                            console.warn('Component property application failed:', compErr);
                        }
                    }
                    // ✅ SECOND: BUILD NODE MAPPING AFTER STRUCTURAL CHANGES
                    // Performance optimization: Filter nodes by overridable types during traversal
                    const allDescendants = 'findAll' in instance
                        ? instance.findAll((node) => OVERRIDABLE_NODE_TYPES.has(node.type))
                        : [];
                    const allNodes = [instance, ...allDescendants];
                    // Helper function to create unique signature for target nodes (INTERNAL TO INSTANCE)
                    function createTargetSignature(node, instanceRoot) {
                        const hierarchyPath = buildInternalHierarchyPath(node, instanceRoot);
                        let siblingIndex = 0;
                        if (node.parent && 'children' in node.parent) {
                            const children = node.parent.children;
                            const matchingSiblings = children.filter((child) => child.name === node.name && child.type === node.type);
                            siblingIndex = matchingSiblings.indexOf(node);
                        }
                        return `${node.type}:${node.name}:${hierarchyPath.join('/')}:${siblingIndex}`;
                    }
                    // Performance optimization: Use Map instead of Object for faster lookups
                    const signatureMap = new Map();
                    for (const node of allNodes) {
                        const signature = createTargetSignature(node, instance);
                        signatureMap.set(signature, node);
                    }
                    // ✅ APPLY OVERRIDES WITH ADVANCED MATCHING - PARALLELIZED
                    // Create a clean copy of overrides for this instance to prevent shared reference issues
                    const instanceOverrides = copiedInstanceData.overrides.map(override => (Object.assign({}, override)));
                    // Performance optimization: Process all overrides in parallel for maximum speed
                    const overridePromises = instanceOverrides.map((override) => __awaiter(void 0, void 0, void 0, function* () {
                        // Primary match: Use unique signature for precise identification
                        let targetNode = signatureMap.get(override.uniqueSignature);
                        let matchMethod = 'signature';
                        // Fallback 1: Try signature without sibling index (for structural changes)
                        if (!targetNode) {
                            const fallbackSignature = `${override.nodeType}:${override.nodeName}:${override.hierarchyPath.join('/')}`;
                            for (const [sig, node] of signatureMap.entries()) {
                                if (sig.startsWith(fallbackSignature + ':')) {
                                    targetNode = node;
                                    matchMethod = 'structural';
                                    break;
                                }
                            }
                        }
                        // Fallback 2: Match by name and type only (least preferred)
                        if (!targetNode) {
                            for (const node of allNodes) {
                                if (node.type === override.nodeType && node.name === override.nodeName) {
                                    targetNode = node;
                                    matchMethod = 'name-type';
                                    break;
                                }
                            }
                        }
                        if (!targetNode) {
                            return { success: false, reason: 'no-match' }; // Skip if no match found
                        }
                        try {
                            // ✅ APPLY OVERRIDES WITH TYPE SAFETY - ALL IN PARALLEL
                            // TEXT OVERRIDES
                            if (override.characters !== undefined && targetNode.type === 'TEXT') {
                                const textNode = targetNode;
                                try {
                                    // Fonts are already loaded, so we can apply properties directly
                                    if (override.fontName) {
                                        textNode.fontName = override.fontName;
                                    }
                                    if (override.fontSize !== undefined) {
                                        textNode.fontSize = override.fontSize;
                                    }
                                    // Apply text content last to ensure all formatting is set first
                                    textNode.characters = override.characters;
                                }
                                catch (textErr) {
                                    // Skip text override errors
                                }
                            }
                            // TEXT FILL OVERRIDES
                            if (override.fills !== undefined && targetNode.type === 'TEXT') {
                                try {
                                    targetNode.fills = clonePaintArray(override.fills);
                                }
                                catch (fillErr) {
                                    // Skip text fill errors
                                }
                            }
                            // VISUAL OVERRIDES
                            if (override.opacity !== undefined && 'opacity' in targetNode) {
                                try {
                                    targetNode.opacity = override.opacity;
                                }
                                catch (opacityErr) {
                                    // Skip opacity errors
                                }
                            }
                            if (override.visible !== undefined && 'visible' in targetNode) {
                                try {
                                    targetNode.visible = override.visible;
                                }
                                catch (visErr) {
                                    // Skip visibility errors
                                }
                            }
                            // SHAPE FILL OVERRIDES
                            if (override.layerFills !== undefined && 'fills' in targetNode && targetNode.type !== 'TEXT') {
                                try {
                                    targetNode.fills = clonePaintArray(override.layerFills);
                                }
                                catch (layerFillErr) {
                                    // Skip layer fill errors
                                }
                            }
                            // STROKE OVERRIDES
                            if (override.layerStrokes !== undefined && 'strokes' in targetNode) {
                                try {
                                    targetNode.strokes = clonePaintArray(override.layerStrokes);
                                }
                                catch (strokeErr) {
                                    // Skip stroke errors
                                }
                            }
                            // NESTED INSTANCE OVERRIDES - These need to be async
                            if (override.variantProperties && targetNode.type === 'INSTANCE') {
                                try {
                                    yield targetNode.setProperties(override.variantProperties);
                                }
                                catch (varErr) {
                                    console.warn('❌ Failed to apply variant properties to:', targetNode.name, varErr);
                                }
                            }
                            if (override.componentProperties && targetNode.type === 'INSTANCE') {
                                try {
                                    // For nested instances, use setComponentPropertyValue if available
                                    if (typeof targetNode.setComponentPropertyValue === 'function') {
                                        for (const key in override.componentProperties) {
                                            const propertyData = override.componentProperties[key];
                                            // Extract the actual value from the component property object
                                            // Component properties are stored as objects like {value: 'text', type: 'TEXT'}
                                            // but setComponentPropertyValue expects just the value
                                            let actualValue;
                                            if (propertyData && typeof propertyData === 'object' && 'value' in propertyData) {
                                                // Extract the value field from the component property object
                                                actualValue = propertyData.value;
                                            }
                                            else {
                                                // Fallback: use the property data directly if it's not a complex object
                                                actualValue = propertyData;
                                            }
                                            // Apply the extracted value
                                            targetNode.setComponentPropertyValue(key, actualValue);
                                        }
                                    }
                                    else {
                                        // If setComponentPropertyValue doesn't exist, skip these properties
                                    }
                                }
                                catch (compErr) {
                                    console.warn('❌ Failed to apply component properties to:', targetNode.name, compErr);
                                }
                            }
                            return { success: true, matchMethod };
                        }
                        catch (err) {
                            // Skip override application errors
                            return { success: false, reason: 'application-error' };
                        }
                    }));
                    // Wait for all overrides to complete in parallel
                    const overrideResults = yield Promise.all(overridePromises);
                    const appliedCount = overrideResults.filter(result => result.success).length;
                    // ✅ RE-APPLY ALL FILL OVERRIDES AFTER STRUCTURAL CHANGES - PARALLELIZED
                    // This ensures fills are restored even if the structure changes after variant/component swaps
                    const fillOverrides = instanceOverrides.filter(o => o.layerFills !== undefined);
                    // Performance optimization: Apply fill overrides in parallel
                    const fillPromises = fillOverrides.map((override) => __awaiter(void 0, void 0, void 0, function* () {
                        // Try to match by unique signature first
                        let targetNode = signatureMap.get(override.uniqueSignature);
                        // Fallback: match by name/type/path if needed
                        if (!targetNode) {
                            const fallbackSignature = `${override.nodeType}:${override.nodeName}:${override.hierarchyPath.join('/')}`;
                            for (const [sig, node] of signatureMap.entries()) {
                                if (sig.startsWith(fallbackSignature + ':')) {
                                    targetNode = node;
                                    break;
                                }
                            }
                        }
                        if (!targetNode) {
                            for (const node of allNodes) {
                                if (node.type === override.nodeType && node.name === override.nodeName) {
                                    targetNode = node;
                                    break;
                                }
                            }
                        }
                        if (targetNode && 'fills' in targetNode && targetNode.type !== 'TEXT') {
                            try {
                                targetNode.fills = clonePaintArray(override.layerFills);
                                return { success: true };
                            }
                            catch (layerFillErr) {
                                // Skip layer fill errors
                                return { success: false };
                            }
                        }
                        return { success: false };
                    }));
                    // Wait for all fill overrides to complete in parallel
                    yield Promise.all(fillPromises);
                    return { success: true };
                }
                catch (err) {
                    return { success: false };
                }
            })));
            const successCount = results.filter(result => result.success).length;
            // ✅ ENHANCED SUCCESS REPORTING
            if (successCount === compatibleInstances.length) {
                const instanceWord = successCount === 1 ? 'instance' : 'instances';
                figma.notify(`🎯 Successfully transferred overrides to ${successCount} ${instanceWord}!`);
            }
            else if (successCount > 0) {
                figma.notify(`🎯 Applied to ${successCount} instances (${skippedCount} skipped due to incompatibility)`);
            }
            else {
                figma.notify('⚠️ No compatible instances found. Please select instances from the same component or component set.');
            }
            // Update button states to clear loading indicators
            yield updateComponentButtonStates();
            // Clear caches after paste to free memory
            clearAllCaches();
        }
        catch (error) {
            figma.notify('Failed to paste instance data. Please try again.');
            // Update button states to clear loading indicators even on error
            yield updateComponentButtonStates();
        }
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
            yield Promise.all(textNodes.map((textNode) => __awaiter(void 0, void 0, void 0, function* () {
                if (textNode.type === "TEXT") {
                    yield figma.loadFontAsync(textNode.fontName);
                    const newText = applyRename(textNode.characters, msg.matchPattern, msg.renameTo, msg.caseStyle);
                    textNode.characters = newText;
                }
            })));
            figma.notify('Text updated successfully');
        }
        else if (msg.mode === "Layer Mode") {
            const renameableNodeTypes = [
                "FRAME", "GROUP", "RECTANGLE", "ELLIPSE", "TEXT", "VECTOR", "STAR",
                "POLYGON", "LINE", "COMPONENT", "INSTANCE", "COMPONENT_SET", "SLICE", "BOOLEAN_OPERATION"
            ];
            const renameableNodes = selectedNodes.filter(node => {
                return renameableNodeTypes.indexOf(node.type) !== -1;
            });
            if (renameableNodes.length === 0) {
                figma.notify('Please select at least one layer');
                return;
            }
            renameableNodes.forEach(node => {
                const newName = applyRename(node.name, msg.matchPattern, msg.renameTo, msg.caseStyle);
                node.name = newName;
            });
            figma.notify(`${renameableNodes.length} layer name(s) updated successfully`);
        }
    }
    // Functions to handle character count
    if (msg.type.startsWith('char-count')) {
        let totalChars = 0;
        const selectedTextNodes = figma.currentPage.selection.filter(node => node.type === 'TEXT');
        if (selectedTextNodes.length === 0) {
            figma.notify('Please select at least one text layer');
            return;
        }
        for (const node of selectedTextNodes) {
            totalChars += node.characters.length;
        }
        figma.notify(totalChars + ' characters');
    }
    // Functions to handle object count
    if (msg.type.startsWith('object-count')) {
        const selectedNodes = figma.currentPage.selection;
        if (selectedNodes.length === 0) {
            figma.notify('Nothing is selected');
            return;
        }
        else if (selectedNodes.length === 1) {
            figma.notify(selectedNodes.length + ' object');
        }
        else {
            figma.notify(selectedNodes.length + ' objects');
        }
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
                const { width: imageWidth, height: imageHeight } = yield image.getSizeAsync();
                const fixedWidth = 320;
                const newHeight = (imageHeight / imageWidth) * fixedWidth;
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
                let newX = 0;
                let newY = 0;
                const gap = 10;
                let foundPosition = false;
                const pageWidth = 10000;
                while (!foundPosition) {
                    if (!isOverlapping(newX, newY, fixedWidth, newHeight)) {
                        foundPosition = true;
                    }
                    else {
                        newX += fixedWidth + gap;
                        if (newX + fixedWidth > pageWidth) {
                            newX = 0;
                            newY += newHeight + gap;
                        }
                    }
                }
                const memeRect = figma.createRectangle();
                memeRect.resize(fixedWidth, newHeight);
                memeRect.x = newX;
                memeRect.y = newY;
                memeRect.fills = [
                    {
                        type: 'IMAGE',
                        imageHash: image.hash,
                        scaleMode: 'FILL'
                    }
                ];
                memeRect.name = "meme";
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
        if (data.length === 0) {
            figma.notify('No data found to populate.');
            return;
        }
        for (const node of textNodes) {
            yield figma.loadFontAsync(node.fontName);
        }
        for (let i = 0; i < textNodes.length; i++) {
            const textNode = textNodes[i];
            const dataIndex = i % data.length;
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
        const layerNames = selectedNodes.map(node => node.name);
        const layerNamesText = layerNames.join('\n');
        figma.ui.postMessage({
            type: 'copy-to-clipboard',
            content: layerNamesText
        });
        const layerCount = selectedNodes.length;
        const layerWord = layerCount === 1 ? 'layer name' : 'layer names';
        figma.notify(`Copied ${layerCount} ${layerWord} to clipboard`);
    }
    // Check if the message type is 'image-click'
    if (msg.type === 'image-click') {
        const selectedNodes = figma.currentPage.selection;
        if (selectedNodes.length === 0) {
            figma.notify('Please select a shape');
            return;
        }
        if (selectedNodes.length > 0) {
            function applyImageFill(node) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (node.type === 'RECTANGLE' || node.type === 'ELLIPSE' || node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') {
                        try {
                            const imageHash = yield loadImageAsync(msg.url);
                            const imagePaint = {
                                type: 'IMAGE',
                                scaleMode: 'FILL',
                                imageHash: imageHash
                            };
                            node.fills = [imagePaint];
                        }
                        catch (error) {
                            console.error('Error applying fill:', error);
                            figma.notify('Failed to apply image as fill');
                        }
                    }
                    else {
                        figma.notify('Please select a valid shape');
                    }
                });
            }
            selectedNodes.forEach(node => {
                applyImageFill(node);
            });
        }
        else {
            figma.notify('Please select at least one shape');
        }
    }
});
// Function to load an image from a URL and return its hash
function loadImageAsync(url) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield fetch(url);
            if (!response.ok) {
                throw new Error(`Network response was not ok, status: ${response.status}`);
            }
            const image = yield response.arrayBuffer();
            const imageHash = figma.createImage(new Uint8Array(image)).hash;
            return imageHash;
        }
        catch (error) {
            console.error('Error loading image:', error);
            figma.notify('Failed to load image. Please try again.');
            throw error;
        }
    });
}
;
// In plugin code
figma.on('drop', (event) => {
    const { items, node, dropMetadata } = event;
    if (items.length > 0 && items[0].type === 'text/plain') {
        console.log(items);
        figma.createImageAsync(items[0].data).then((image) => __awaiter(void 0, void 0, void 0, function* () {
            const node = figma.createRectangle();
            const { width, height } = yield image.getSizeAsync();
            node.resize(width, height);
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
