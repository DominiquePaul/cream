// This script suppresses specific console errors
(function() {
  const originalError = console.error;
  
  console.error = function() {
    // Check if the error is about the manifest
    if (arguments[0] && 
        (typeof arguments[0] === 'string' && arguments[0].includes('Manifest')) ||
        (typeof arguments[0] === 'object' && arguments[0].message && arguments[0].message.includes('Manifest'))) {
      // Suppress manifest errors
      return;
    }
    
    // Check if the error is about Permissions-Policy
    if (arguments[0] && 
        (typeof arguments[0] === 'string' && arguments[0].includes('Permissions-Policy')) ||
        (typeof arguments[0] === 'object' && arguments[0].message && arguments[0].message.includes('Permissions-Policy'))) {
      // Suppress Permissions-Policy errors
      return;
    }
    
    // Otherwise, pass through to the original console.error
    return originalError.apply(console, arguments);
  };
})(); 