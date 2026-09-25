/**
 * Error message formatter for consistent user-facing error messages
 * across all pages and services
 */

export const ErrorMessages = {
  // Authentication errors
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
    EMAIL_EXISTS: 'This email address is already registered. Please use a different one.',
    PHONE_EXISTS: 'This phone number is already registered. Please use a different one.',
    PASSWORD_MISMATCH: 'Passwords do not match. Please try again.',
    PASSWORD_WEAK: 'Password is too weak. Use at least 8 characters including uppercase, lowercase, and numbers.',
    VERIFICATION_FAILED: 'Verification failed. Please check your code and try again.',
  },

  // Profile errors
  PROFILE: {
    UPDATE_FAILED: 'Failed to update profile. Please try again.',
    EMAIL_EXISTS: 'This email address is already in use. Please use a different one.',
    INVALID_EMAIL: 'Please enter a valid email address.',
    REQUIRED_FIELD: (field: string) => `${field} is required.`,
    UPLOAD_FAILED: 'Failed to upload image. Please try again.',
    FILE_TOO_LARGE: 'File size is too large. Maximum size is 5MB.',
    INVALID_FILE_TYPE: 'Invalid file type. Please upload an image file.',
  },

  // Listing/Product errors
  LISTING: {
    CREATE_FAILED: 'Failed to create listing. Please try again.',
    UPDATE_FAILED: 'Failed to update listing. Please try again.',
    DELETE_FAILED: 'Failed to delete listing. Please try again.',
    REQUIRED_FIELD: (field: string) => `${field} is required to post a listing.`,
    INVALID_PRICE: 'Please enter a valid price.',
    INVALID_CATEGORY: 'Please select a valid category.',
    IMAGE_REQUIRED: 'At least one product image is required.',
    MAX_IMAGES: 'Maximum 10 images are allowed.',
    TITLE_TOO_SHORT: 'Product title must be at least 5 characters.',
    DESCRIPTION_TOO_SHORT: 'Product description must be at least 20 characters.',
  },

  // Verification errors
  VERIFICATION: {
    SUBMIT_FAILED: 'Failed to submit verification documents. Please try again.',
    DOCUMENT_REQUIRED: 'Please upload at least one verification document (National ID or Passport).',
    INVALID_DOCUMENT: 'Invalid document. Please upload a clear image of your ID.',
    ALREADY_VERIFIED: 'Your account is already verified.',
    VERIFICATION_PENDING: 'Your verification is already under review.',
    DECLINED: 'Your verification was declined. Please contact support for more information.',
  },

  // Payment errors
  PAYMENT: {
    FAILED: 'Payment processing failed. Please try again.',
    INVALID_AMOUNT: 'Please enter a valid amount.',
    INSUFFICIENT_FUNDS: 'Insufficient funds. Please check your balance.',
    DECLINED: 'Payment was declined. Please try a different payment method.',
    TIMEOUT: 'Payment request timed out. Please try again.',
  },

  // Network errors
  NETWORK: {
    NO_CONNECTION: 'No internet connection. Please check your network and try again.',
    TIMEOUT: 'Request timed out. Please try again.',
    SERVER_ERROR: 'Server error. Please try again later.',
    NOT_FOUND: 'Resource not found.',
  },

  // Generic errors
  GENERIC: {
    UNEXPECTED: 'An unexpected error occurred. Please try again.',
    PLEASE_TRY_AGAIN: 'Something went wrong. Please try again.',
    CONTACT_SUPPORT: 'An error occurred. Please contact support if the problem persists.',
  },
};

/**
 * Parse API error response and return user-friendly message
 */
export function getErrorMessage(error: any, defaultMessage: string = ErrorMessages.GENERIC.PLEASE_TRY_AGAIN): string {
  if (!error) return defaultMessage;

  // If error is already a string
  if (typeof error === 'string') return error;

  // Check API response error
  const detail = error.response?.data?.detail;
  if (detail) {
    if (typeof detail === 'string') return detail;
    if (typeof detail === 'object' && detail.message) return detail.message;
  }

  // Check message field
  if (error.message) return error.message;

  // Check status code
  if (error.response?.status === 409) return ErrorMessages.PROFILE.EMAIL_EXISTS;
  if (error.response?.status === 404) return ErrorMessages.NETWORK.NOT_FOUND;
  if (error.response?.status === 500) return ErrorMessages.NETWORK.SERVER_ERROR;

  return defaultMessage;
}

/**
 * Success messages
 */
export const SuccessMessages = {
  PROFILE_UPDATED: '✓ Profile updated successfully!',
  EMAIL_UPDATED: '✓ Email updated successfully!',
  PASSWORD_CHANGED: '✓ Password changed successfully!',
  LISTING_CREATED: '✓ Listing created successfully!',
  LISTING_UPDATED: '✓ Listing updated successfully!',
  LISTING_DELETED: '✓ Listing deleted successfully!',
  VERIFICATION_SUBMITTED: "✓ Documents submitted! We'll review them within 1-2 business days.",
  PAYMENT_SUCCESS: '✓ Payment successful!',
  DOCUMENT_UPLOADED: '✓ Document uploaded successfully!',
  SAVED: '✓ Changes saved successfully!',
};
