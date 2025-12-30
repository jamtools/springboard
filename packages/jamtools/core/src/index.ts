// This file ensures module augmentations are loaded when @jamtools/core is installed
// The import below is a side-effect import that triggers the module augmentation

import './modules/macro_module/macro_module';

// Re-export nothing, this file exists only for the side effect
export {};
